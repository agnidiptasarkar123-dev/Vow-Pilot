import crypto from 'node:crypto';
import { VowPilotDatabase } from '../connection';
import {
  ServerEventRecord,
  UserRole,
  EventMember,
  ConcurrencyConflict,
  User,
  AppState,
} from '../../types';
import { EventRow, EventMemberRow } from '../types';
import { AuthPolicy } from '../../authPolicy';

export class EventRepository {
  private db: VowPilotDatabase;

  constructor(db: VowPilotDatabase) {
    this.db = db;
  }

  /**
   * Transactionally creates a new event, establishing owner membership,
   * normalizing relational entities in integer minor units, and recording initial audit history.
   */
  public createEvent(owner: User, initialState: AppState): ServerEventRecord {
    const eventId = initialState.event.id || `evt-${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const eventName = initialState.event.name || 'Untitled Celebration';
    const eventDate = initialState.event.date || null;
    const currency = initialState.event.currency || 'INR';
    const targetBudgetMinor = initialState.event.totalBudget || 0;

    const stateToStore: AppState = {
      ...initialState,
      event: {
        ...initialState.event,
        id: eventId,
      },
    };

    const createTx = this.db.transaction(() => {
      // 1. Insert into events (10 parameters for 10 '?' placeholders)
      this.db
        .prepare<
          [
            string,
            string,
            string,
            string | null,
            number,
            string,
            string,
            string,
            string,
            string
          ]
        >(`
          INSERT INTO events (
            id, owner_id, version, name, event_date,
            target_budget_minor, currency, state_json,
            created_at, updated_at, last_modified_by
          )
          VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          eventId,
          owner.id,
          eventName,
          eventDate,
          targetBudgetMinor,
          currency,
          JSON.stringify(stateToStore),
          now,
          now,
          owner.name
        );

      // 2. Insert owner member (5 parameters for 5 '?' placeholders)
      this.db
        .prepare<[string, string, string, string, string]>(`
          INSERT INTO event_members (event_id, user_id, user_name, user_email, role, joined_at)
          VALUES (?, ?, ?, ?, 'owner', ?)
        `)
        .run(eventId, owner.id, owner.name, owner.email, now);

      // 3. Synchronize relational entities (expenses in minor units, tasks, vendors)
      this.syncRelationalEntities(eventId, stateToStore, now);

      // 4. Record audit history (6 parameters for 6 '?' placeholders)
      this.db
        .prepare<[string, string, string, string, string, string]>(`
          INSERT INTO event_activity_history (id, event_id, user_id, user_name, action, version, details_json, created_at)
          VALUES (?, ?, ?, ?, 'event_created', 1, ?, ?)
        `)
        .run(
          `act_${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          owner.id,
          owner.name,
          JSON.stringify({ name: eventName, budget: targetBudgetMinor }),
          now
        );
    });

    createTx();

    return {
      id: eventId,
      ownerId: owner.id,
      version: 1,
      state: stateToStore,
      members: [
        {
          userId: owner.id,
          userName: owner.name,
          userEmail: owner.email,
          role: 'owner',
          joinedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      lastModifiedBy: owner.name,
    };
  }

  public getEvent(eventId: string, requestingUser: User): ServerEventRecord {
    const row = this.db
      .prepare<[string], EventRow>(`
        SELECT id, owner_id, version, name, event_date, target_budget_minor, currency,
               state_json, created_at, updated_at, last_modified_by
        FROM events
        WHERE id = ?
      `)
      .get(eventId);

    if (!row) {
      throw new Error('Event not found.');
    }

    const members = this.getEventMembers(eventId);
    const member = members.find((m) => m.userId === requestingUser.id);
    if (!member) {
      throw new Error('Unauthorized: You are not a member of this event.');
    }

    return {
      id: row.id,
      ownerId: row.owner_id,
      version: row.version,
      state: JSON.parse(row.state_json),
      members,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastModifiedBy: row.last_modified_by,
    };
  }

  public getUserRole(eventId: string, userId: string): UserRole | null {
    const row = this.db
      .prepare<[string, string], { role: string }>(`
        SELECT role FROM event_members WHERE event_id = ? AND user_id = ?
      `)
      .get(eventId, userId);

    return (row?.role as UserRole) || null;
  }

  public getEventMetadata(eventId: string): { id: string; name: string } | null {
    const row = this.db
      .prepare<[string], { id: string; name: string }>('SELECT id, name FROM events WHERE id = ?')
      .get(eventId);
    return row || null;
  }

  public listUserEvents(
    user: User
  ): Array<{ id: string; name: string; role: UserRole; version: number; updatedAt: string }> {
    const rows = this.db
      .prepare<[string], { id: string; name: string; role: string; version: number; updated_at: string }>(`
        SELECT e.id, e.name, m.role, e.version, e.updated_at
        FROM events e
        INNER JOIN event_members m ON e.id = m.event_id
        WHERE m.user_id = ?
        ORDER BY e.updated_at DESC
      `)
      .all(user.id);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role as UserRole,
      version: r.version,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Executes atomic Optimistic Concurrency Control (OCC) update in a database transaction.
   * Prevents lost updates and concurrent overwrites across all server instances.
   */
  public updateEvent(
    eventId: string,
    requestingUser: User,
    expectedVersion: number,
    newState: AppState
  ): { success: true; event: ServerEventRecord } | ConcurrencyConflict {
    const eventRow = this.db
      .prepare<[string], EventRow>(`
        SELECT id, owner_id, version, name, state_json, updated_at, last_modified_by
        FROM events
        WHERE id = ?
      `)
      .get(eventId);

    if (!eventRow) {
      throw new Error('Event not found.');
    }

    const memberRole = this.getUserRole(eventId, requestingUser.id);
    if (!memberRole) {
      throw new Error('Unauthorized: You are not a member of this event.');
    }
    if (memberRole === 'viewer') {
      throw new Error('Forbidden: Viewer role does not have permission to modify event data.');
    }

    // Database OCC check
    if (eventRow.version !== expectedVersion) {
      return {
        error: 'CONCURRENCY_CONFLICT',
        message: `Version conflict: Your update was based on version ${expectedVersion}, but the server is already at version ${eventRow.version}. Concurrent edit made by ${eventRow.last_modified_by}.`,
        expectedVersion,
        currentVersion: eventRow.version,
        lastModifiedBy: eventRow.last_modified_by,
        currentState: JSON.parse(eventRow.state_json),
      };
    }

    const now = new Date().toISOString();
    const newVersion = eventRow.version + 1;
    const eventName = newState.event?.name || eventRow.name;
    const eventDate = newState.event?.date || null;
    const currency = newState.event?.currency || 'INR';
    const targetBudgetMinor = newState.event?.totalBudget || 0;

    const updatedState: AppState = {
      ...newState,
      event: {
        ...newState.event,
        id: eventId,
        updatedAt: now,
      },
    };

    let conflictResult: ConcurrencyConflict | null = null;

    const updateTx = this.db.transaction(() => {
      // Atomic compare-and-swap at SQL level
      const result = this.db
        .prepare<[number, string, string | null, number, string, string, string, string, string, number]>(`
          UPDATE events
          SET version = ?, name = ?, event_date = ?, target_budget_minor = ?,
              currency = ?, state_json = ?, updated_at = ?, last_modified_by = ?
          WHERE id = ? AND version = ?
        `)
        .run(
          newVersion,
          eventName,
          eventDate,
          targetBudgetMinor,
          currency,
          JSON.stringify(updatedState),
          now,
          requestingUser.name,
          eventId,
          expectedVersion
        );

      if (result.changes === 0) {
        // Another concurrent worker committed between our SELECT and UPDATE
        const latest = this.db.prepare<[string], EventRow>('SELECT * FROM events WHERE id = ?').get(eventId)!;
        conflictResult = {
          error: 'CONCURRENCY_CONFLICT',
          message: `Version conflict: Your update was based on version ${expectedVersion}, but the server is already at version ${latest.version}. Concurrent edit made by ${latest.last_modified_by}.`,
          expectedVersion,
          currentVersion: latest.version,
          lastModifiedBy: latest.last_modified_by,
          currentState: JSON.parse(latest.state_json),
        };
        return;
      }

      // Synchronize normalized relational entities
      this.syncRelationalEntities(eventId, updatedState, now);

      // Record activity history (7 parameters for 7 '?' placeholders)
      this.db
        .prepare<[string, string, string, string, number, string | null, string]>(`
          INSERT INTO event_activity_history (id, event_id, user_id, user_name, action, version, details_json, created_at)
          VALUES (?, ?, ?, ?, 'event_updated', ?, ?, ?)
        `)
        .run(
          `act_${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          requestingUser.id,
          requestingUser.name,
          newVersion,
          JSON.stringify({ modifiedBy: requestingUser.name, version: newVersion }),
          now
        );
    });

    updateTx();

    if (conflictResult) {
      return conflictResult;
    }

    const members = this.getEventMembers(eventId);
    return {
      success: true,
      event: {
        id: eventId,
        ownerId: eventRow.owner_id,
        version: newVersion,
        state: updatedState,
        members,
        createdAt: eventRow.created_at,
        updatedAt: now,
        lastModifiedBy: requestingUser.name,
      },
    };
  }

  public addMember(eventId: string, user: User, role: UserRole): ServerEventRecord {
    const now = new Date().toISOString();
    this.db
      .prepare<[string, string, string, string, string, string]>(`
        INSERT INTO event_members (event_id, user_id, user_name, user_email, role, joined_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id, user_id) DO UPDATE SET role = excluded.role
      `)
      .run(eventId, user.id, user.name, user.email, role, now);

    return this.getEvent(eventId, user);
  }

  public updateMemberRole(
    eventId: string,
    requestingUser: User,
    targetUserId: string,
    newRole: UserRole
  ): ServerEventRecord {
    const event = this.getEvent(eventId, requestingUser);
    AuthPolicy.authorize(event, requestingUser, 'manage_members');

    if (newRole !== 'owner' && newRole !== 'editor' && newRole !== 'viewer') {
      throw new Error('Invalid role: Must be owner, editor, or viewer.');
    }

    if (targetUserId === event.ownerId && newRole !== 'owner') {
      throw new Error('Cannot change the role of the primary event owner.');
    }

    const members = this.getEventMembers(eventId);
    const targetMember = members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new Error('Target user is not a member of this event.');
    }

    const updateTx = this.db.transaction(() => {
      this.db
        .prepare<[string, string, string]>('UPDATE event_members SET role = ? WHERE event_id = ? AND user_id = ?')
        .run(newRole, eventId, targetUserId);

      this.db
        .prepare<[string, string, string, string, number, string, string]>(`
          INSERT INTO event_activity_history (id, event_id, user_id, user_name, action, version, details_json, created_at)
          VALUES (?, ?, ?, ?, 'member_role_updated', ?, ?, ?)
        `)
        .run(
          `act_${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          requestingUser.id,
          requestingUser.name,
          event.version,
          JSON.stringify({ targetUserId, oldRole: targetMember.role, newRole }),
          new Date().toISOString()
        );
    });

    updateTx();
    return this.getEvent(eventId, requestingUser);
  }

  public removeMember(eventId: string, requestingUser: User, targetUserId: string): ServerEventRecord {
    const event = this.getEvent(eventId, requestingUser);
    AuthPolicy.authorize(event, requestingUser, 'manage_members');

    if (targetUserId === event.ownerId) {
      throw new Error('Cannot remove the owner of the event.');
    }

    const removeTx = this.db.transaction(() => {
      this.db
        .prepare<[string, string]>('DELETE FROM event_members WHERE event_id = ? AND user_id = ?')
        .run(eventId, targetUserId);

      // 7 parameters for 7 '?' placeholders
      this.db
        .prepare<[string, string, string, string, number, string, string]>(`
          INSERT INTO event_activity_history (id, event_id, user_id, user_name, action, version, details_json, created_at)
          VALUES (?, ?, ?, ?, 'member_removed', ?, ?, ?)
        `)
        .run(
          `act_${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          requestingUser.id,
          requestingUser.name,
          event.version,
          JSON.stringify({ removedUserId: targetUserId }),
          new Date().toISOString()
        );
    });

    removeTx();
    return this.getEvent(eventId, requestingUser);
  }

  public deleteEvent(eventId: string, requestingUser: User): void {
    const role = this.getUserRole(eventId, requestingUser.id);
    if (role !== 'owner') {
      throw new Error('Forbidden: Only the event owner can delete this event.');
    }

    const deleteTx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    });

    deleteTx();
  }

  public getEventMembers(eventId: string): EventMember[] {
    const rows = this.db
      .prepare<[string], EventMemberRow>(`
        SELECT event_id, user_id, user_name, user_email, role, joined_at
        FROM event_members
        WHERE event_id = ?
        ORDER BY joined_at ASC
      `)
      .all(eventId);

    return rows.map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      role: r.role as UserRole,
      joinedAt: r.joined_at,
    }));
  }

  /**
   * Synchronizes normalized tables with strict minor integer currency values.
   */
  private syncRelationalEntities(eventId: string, state: AppState, now: string): void {
    // 1. Sync expenses in integer minor units
    this.db.prepare('DELETE FROM event_expenses WHERE event_id = ?').run(eventId);
    if (state.expenses && state.expenses.length > 0) {
      const insertExpense = this.db.prepare<
        [string, string, string, string, number, number, number, string, string | null, string | null, string | null, string]
      >(`
        INSERT INTO event_expenses (
          id, event_id, category_id, name,
          estimated_cost_minor, actual_cost_minor, paid_amount_minor,
          status, vendor_id, due_date, notes, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const exp of state.expenses) {
        insertExpense.run(
          exp.id,
          eventId,
          exp.categoryId,
          exp.title,
          exp.amount,
          exp.amount,
          exp.paidAmount || 0,
          exp.status || 'estimated',
          exp.vendorId || null,
          exp.dueDate || null,
          exp.notes || null,
          now
        );
      }
    }

    // 2. Sync tasks
    this.db.prepare('DELETE FROM event_tasks WHERE event_id = ?').run(eventId);
    if (state.tasks && state.tasks.length > 0) {
      const insertTask = this.db.prepare<
        [string, string, string, string, string, string | null, string, number, string | null, number, number]
      >(`
        INSERT INTO event_tasks (
          id, event_id, title, category, phase, due_date, priority,
          completed, assigned_to, estimated_cost_minor, actual_cost_minor
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const t of state.tasks) {
        insertTask.run(
          t.id,
          eventId,
          t.title,
          t.categoryId,
          t.priorityReason || 'planning',
          t.dueDate || null,
          t.priority || 'medium',
          t.status === 'completed' ? 1 : 0,
          t.assignedTo || null,
          0,
          0
        );
      }
    }

    // 3. Sync vendors
    this.db.prepare('DELETE FROM event_vendors WHERE event_id = ?').run(eventId);
    if (state.vendors && state.vendors.length > 0) {
      const insertVendor = this.db.prepare<[string, string, string, string, string, string | null, string | null]>(`
        INSERT INTO event_vendors (id, event_id, name, category, status, contact_email, contact_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const v of state.vendors) {
        insertVendor.run(
          v.id,
          eventId,
          v.name,
          v.categoryId,
          v.isSample ? 'sample' : 'active',
          v.email || null,
          v.phone || null
        );
      }
    }
  }

  public clearAll(): void {
    this.db.exec(`
      DELETE FROM event_activity_history;
      DELETE FROM event_vendors;
      DELETE FROM event_tasks;
      DELETE FROM event_expenses;
      DELETE FROM event_invitations;
      DELETE FROM event_members;
      DELETE FROM events;
    `);
  }
}
