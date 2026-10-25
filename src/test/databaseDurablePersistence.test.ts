import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DatabaseContext,
  VowPilotDatabase,
  Migrator,
  MIGRATIONS,
} from '../../server/db';
import { User, AppState } from '../../server/types';
import { EventStore } from '../../server/events';
import { DEMO_STATE } from '../persistence/demoData';

describe('VowPilot Database Durable Persistence & Concurrency Engine', () => {
  const testDir = path.resolve(process.cwd(), 'data', 'test_artifacts');
  const restartDbPath = path.join(testDir, 'test_restart.db');
  const multiInstanceDbPath = path.join(testDir, 'test_multi_instance.db');
  const backupSourceDbPath = path.join(testDir, 'test_backup_source.db');
  const backupDbPath = path.join(testDir, 'test_backup.db');
  const rollbackDbPath = path.join(testDir, 'test_rollback.db');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // Clean up any stale test files
    [restartDbPath, multiInstanceDbPath, backupSourceDbPath, backupDbPath, rollbackDbPath].forEach((file) => {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
        if (fs.existsSync(`${file}-wal`)) fs.unlinkSync(`${file}-wal`);
        if (fs.existsSync(`${file}-shm`)) fs.unlinkSync(`${file}-shm`);
      } catch {
        // ignore
      }
    });
  });

  afterAll(() => {
    // Clean up test database directory
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  const testUserA: User = {
    id: 'usr_tenant_alpha',
    name: 'Aaditya Sharma',
    email: 'aaditya@vowpilot.test',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$testSalt$testHash',
    createdAt: new Date().toISOString(),
  };

  const testUserB: User = {
    id: 'usr_tenant_beta',
    name: 'Diya Verma',
    email: 'diya@vowpilot.test',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$testSalt$testHash',
    createdAt: new Date().toISOString(),
  };

  // ==========================================================================
  // Test 1: Process Restart Survival & Durable File Persistence
  // ==========================================================================
  it('survives hard process termination: data persists across distinct database connections to disk', () => {
    const testState: AppState = {
      ...DEMO_STATE,
      event: {
        ...DEMO_STATE.event,
        id: 'evt_restart_001',
        name: 'Udaipur Royal Wedding',
        guestCount: 250,
        totalBudget: 750000000, // ₹75,00,000 in paise
        currency: 'INR',
      },
      expenses: [
        {
          id: 'exp_venue_001',
          categoryId: 'cat_venue',
          title: 'Palace Courtyard Booking',
          amount: 250000000, // 25,00,000 in paise
          status: 'confirmed',
          paidAmount: 100000000,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
        {
          id: 'exp_photo_001',
          categoryId: 'cat_photo',
          title: 'Cinematic Drone Coverage',
          amount: 50000000, // 5,00,000 in paise
          status: 'quoted',
          paidAmount: 0,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    };

    // 1. Initial process: create database, seed user and event
    {
      const process1 = new DatabaseContext({ filename: restartDbPath });
      process1.users.createUser(testUserA);
      const created = process1.events.createEvent(testUserA, testState);

      expect(created.id).toBe('evt_restart_001');
      expect(created.version).toBe(1);
      expect(created.state.event.totalBudget).toBe(750000000);

      // Verify WAL mode and foreign keys are active
      const health = process1.db.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.journalMode).toBe('wal');
      expect(health.foreignKeysEnabled).toBe(true);

      // Simulate abrupt process termination by closing the file handle
      process1.close();
    }

    // Verify database file physically exists on disk
    expect(fs.existsSync(restartDbPath)).toBe(true);
    expect(fs.statSync(restartDbPath).size).toBeGreaterThan(0);

    // 2. Restarted process: open the exact same file from disk with a new context
    {
      const process2 = new DatabaseContext({ filename: restartDbPath });

      // Verify user survived intact
      const recoveredUser = process2.users.getUserById(testUserA.id);
      expect(recoveredUser).not.toBeNull();
      expect(recoveredUser?.name).toBe('Aaditya Sharma');
      expect(recoveredUser?.email).toBe('aaditya@vowpilot.test');

      // Verify event survived intact
      const recoveredEvent = process2.events.getEvent('evt_restart_001', testUserA);
      expect(recoveredEvent.id).toBe('evt_restart_001');
      expect(recoveredEvent.version).toBe(1);
      expect(recoveredEvent.state.event.name).toBe('Udaipur Royal Wedding');
      expect(recoveredEvent.state.event.totalBudget).toBe(750000000);
      expect(recoveredEvent.state.expenses.length).toBe(2);

      // Verify relational expenses survived in minor currency units
      const expenses = process2.db
        .prepare<[string], { id: string; estimated_cost_minor: number; status: string }>(`
          SELECT id, estimated_cost_minor, status FROM event_expenses WHERE event_id = ? ORDER BY estimated_cost_minor DESC
        `)
        .all('evt_restart_001');

      expect(expenses.length).toBe(2);
      expect(expenses[0].estimated_cost_minor).toBe(250000000);
      expect(expenses[0].status).toBe('confirmed');
      expect(expenses[1].estimated_cost_minor).toBe(50000000);

      process2.close();
    }
  });

  // ==========================================================================
  // Test 2: Multi-Instance Concurrency & Optimistic Concurrency Control (OCC)
  // ==========================================================================
  it('coordinates multi-instance updates safely: rejects stale overwrites across separate database connections', () => {
    // Instance A and Instance B simulate two horizontal Node.js processes sharing the database file
    const instanceA = new DatabaseContext({ filename: multiInstanceDbPath });
    const instanceB = new DatabaseContext({ filename: multiInstanceDbPath });

    try {
      // Seed initial data via Instance A
      instanceA.users.createUser(testUserA);
      instanceA.users.createUser(testUserB);

      const eventState: AppState = {
        ...DEMO_STATE,
        event: {
          ...DEMO_STATE.event,
          id: 'evt_shared_001',
          name: 'Shared Bangalore Reception',
          guestCount: 200,
        },
      };

      const initial = instanceA.events.createEvent(testUserA, eventState);
      expect(initial.version).toBe(1);

      // Add User B as collaborator
      instanceA.events.addMember('evt_shared_001', testUserB, 'editor');

      // Instance B immediately sees the event and members created by Instance A
      const eventInB = instanceB.events.getEvent('evt_shared_001', testUserB);
      expect(eventInB.id).toBe('evt_shared_001');
      expect(eventInB.version).toBe(1);
      expect(eventInB.members.length).toBe(2);

      // Both instances read version 1 concurrently
      const stateForUpdateA: AppState = {
        ...eventInB.state,
        event: { ...eventInB.state.event, guestCount: 220 },
      };
      const stateForUpdateB: AppState = {
        ...eventInB.state,
        event: { ...eventInB.state.event, guestCount: 260 },
      };

      // Instance A commits write 1 -> 2
      const resultA = instanceA.events.updateEvent('evt_shared_001', testUserA, 1, stateForUpdateA);
      expect('success' in resultA && resultA.success).toBe(true);
      if ('success' in resultA) {
        expect(resultA.event.version).toBe(2);
        expect(resultA.event.state.event.guestCount).toBe(220);
      }

      // Instance B now attempts to write based on stale version 1
      const resultB = instanceB.events.updateEvent('evt_shared_001', testUserB, 1, stateForUpdateB);

      // CONCURRENCY_CONFLICT: Must be cleanly rejected without silent overwrite
      expect('error' in resultB && resultB.error).toBe('CONCURRENCY_CONFLICT');
      if ('error' in resultB) {
        expect(resultB.expectedVersion).toBe(1);
        expect(resultB.currentVersion).toBe(2);
        expect(resultB.lastModifiedBy).toBe('Aaditya Sharma');
        expect(resultB.currentState.event.guestCount).toBe(220); // Instance A's write preserved!
      }

      // Instance B refreshes to latest version 2 and safely updates 2 -> 3
      const refreshedEvent = instanceB.events.getEvent('evt_shared_001', testUserB);
      expect(refreshedEvent.version).toBe(2);

      const stateForRetryB: AppState = {
        ...refreshedEvent.state,
        event: { ...refreshedEvent.state.event, guestCount: 260 },
      };
      const retryResultB = instanceB.events.updateEvent('evt_shared_001', testUserB, 2, stateForRetryB);
      expect('success' in retryResultB && retryResultB.success).toBe(true);
      if ('success' in retryResultB) {
        expect(retryResultB.event.version).toBe(3);
        expect(retryResultB.event.state.event.guestCount).toBe(260);
      }

      // Both instances now see version 3
      expect(instanceA.events.getEvent('evt_shared_001', testUserA).version).toBe(3);
      expect(instanceB.events.getEvent('evt_shared_001', testUserB).version).toBe(3);
    } finally {
      instanceA.close();
      instanceB.close();
    }
  });

  // ==========================================================================
  // Test 3: Transactional Rollback on Mid-Operation Failure
  // ==========================================================================
  it('rolls back atomic transactions completely when mid-operation failures occur', () => {
    const dbContext = new DatabaseContext({ filename: ':memory:' });
    dbContext.users.createUser(testUserA);

    const event = dbContext.events.createEvent(testUserA, DEMO_STATE);
    const initialVersion = event.version;

    // Count existing expenses
    const countBefore = (
      dbContext.db.prepare('SELECT COUNT(*) as cnt FROM event_expenses WHERE event_id = ?').get(event.id) as { cnt: number }
    ).cnt;
    expect(countBefore).toBeGreaterThan(0);

    // Attempt an atomic transaction that fails halfway
    expect(() => {
      const failingTx = dbContext.db.transaction(() => {
        // 1. Valid operation
        dbContext.db
          .prepare('UPDATE events SET version = version + 1 WHERE id = ?')
          .run(event.id);

        // 2. Deliberately invalid operation: violates NOT NULL or foreign key
        dbContext.db
          .prepare('INSERT INTO events (id, owner_id, name, state_json, created_at, updated_at, last_modified_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run('evt_invalid', 'non_existent_owner_9999', 'Fail', '{}', new Date().toISOString(), new Date().toISOString(), 'Tester');
      });

      failingTx();
    }).toThrow();

    // Verify complete rollback: event version was NOT incremented
    const eventAfter = dbContext.events.getEvent(event.id, testUserA);
    expect(eventAfter.version).toBe(initialVersion);

    // Verify invalid record was NOT created
    const orphan = dbContext.db.prepare('SELECT * FROM events WHERE id = ?').get('evt_invalid');
    expect(orphan).toBeUndefined();

    dbContext.close();
  });

  // ==========================================================================
  // Test 4: Strict Foreign-Key Referential Integrity
  // ==========================================================================
  it('strictly enforces foreign-key referential integrity and cascading deletes', () => {
    const dbContext = new DatabaseContext({ filename: ':memory:' });

    // 1. Attempting to insert an event with a non-existent owner fails immediately
    expect(() => {
      dbContext.db
        .prepare(`
          INSERT INTO events (id, owner_id, version, name, target_budget_minor, currency, state_json, created_at, updated_at, last_modified_by)
          VALUES (?, ?, 1, ?, 0, 'INR', '{}', ?, ?, 'Owner')
        `)
        .run('evt_orphan_fk', 'non_existent_user_xyz', 'Orphan Event', new Date().toISOString(), new Date().toISOString());
    }).toThrow(/FOREIGN KEY constraint failed/);

    // 2. Create valid user and event
    dbContext.users.createUser(testUserA);
    const validEvent = dbContext.events.createEvent(testUserA, DEMO_STATE);

    // 3. Attempt to insert invite for non-existent event fails
    expect(() => {
      dbContext.db
        .prepare(`
          INSERT INTO event_invitations (token_hash, event_id, role, created_by, created_at, expires_at)
          VALUES ('hash_xyz', 'non_existent_event_123', 'editor', ?, ?, ?)
        `)
        .run(testUserA.id, new Date().toISOString(), new Date().toISOString());
    }).toThrow(/FOREIGN KEY constraint failed/);

    // 4. Cascade delete: deleting the event cleans up all dependent tables automatically
    const eventId = validEvent.id;
    dbContext.events.deleteEvent(eventId, testUserA);

    // Verify cascade cleaned up all related entities
    const remainingMembers = dbContext.db.prepare('SELECT COUNT(*) as cnt FROM event_members WHERE event_id = ?').get(eventId) as { cnt: number };
    const remainingExpenses = dbContext.db.prepare('SELECT COUNT(*) as cnt FROM event_expenses WHERE event_id = ?').get(eventId) as { cnt: number };
    const remainingTasks = dbContext.db.prepare('SELECT COUNT(*) as cnt FROM event_tasks WHERE event_id = ?').get(eventId) as { cnt: number };
    const remainingVendors = dbContext.db.prepare('SELECT COUNT(*) as cnt FROM event_vendors WHERE event_id = ?').get(eventId) as { cnt: number };

    expect(remainingMembers.cnt).toBe(0);
    expect(remainingExpenses.cnt).toBe(0);
    expect(remainingTasks.cnt).toBe(0);
    expect(remainingVendors.cnt).toBe(0);

    dbContext.close();
  });

  // ==========================================================================
  // Test 5: Strict Cross-Tenant Data Isolation
  // ==========================================================================
  it('enforces strict tenant isolation: Tenant B cannot view, query, or modify Tenant A event records', () => {
    const dbContext = new DatabaseContext({ filename: ':memory:' });
    dbContext.users.createUser(testUserA);
    dbContext.users.createUser(testUserB);

    const eventA = dbContext.events.createEvent(testUserA, {
      ...DEMO_STATE,
      event: { ...DEMO_STATE.event, id: 'evt_tenant_a', name: 'Confidential Event A' },
    });
    expect(eventA.id).toBe('evt_tenant_a');

    const eventB = dbContext.events.createEvent(testUserB, {
      ...DEMO_STATE,
      event: { ...DEMO_STATE.event, id: 'evt_tenant_b', name: 'Private Event B' },
    });
    expect(eventB.id).toBe('evt_tenant_b');

    // Tenant A only sees Event A
    const listA = dbContext.events.listUserEvents(testUserA);
    expect(listA.length).toBe(1);
    expect(listA[0].id).toBe('evt_tenant_a');

    // Tenant B only sees Event B
    const listB = dbContext.events.listUserEvents(testUserB);
    expect(listB.length).toBe(1);
    expect(listB[0].id).toBe('evt_tenant_b');

    // Tenant B cannot access Event A
    expect(() => {
      dbContext.events.getEvent('evt_tenant_a', testUserB);
    }).toThrow(/Unauthorized: You are not a member of this event\./);

    // Tenant B cannot update Event A
    expect(() => {
      dbContext.events.updateEvent('evt_tenant_a', testUserB, 1, DEMO_STATE);
    }).toThrow(/Unauthorized: You are not a member of this event\./);

    // Tenant B cannot generate invites for Event A
    const store = new EventStore(dbContext);
    expect(() => {
      store.createInvite('evt_tenant_a', testUserB, 'editor', 24);
    }).toThrow(/Unauthorized/);

    dbContext.close();
  });

  // ==========================================================================
  // Test 6: Integer Minor Currency Units & Exact Budget Arithmetic
  // ==========================================================================
  it('avoids floating-point arithmetic errors: financial values use integer minor units (paise/cents) exclusively', () => {
    const dbContext = new DatabaseContext({ filename: ':memory:' });
    dbContext.users.createUser(testUserA);

    // In standard IEEE 754 floating point:
    // 0.1 + 0.2 = 0.30000000000000004
    // In minor currency units: 10 paise + 20 paise = 30 paise (exact integer)
    const exactBudgetMinor = 10000050; // ₹1,00,000.50

    const stateWithCents: AppState = {
      ...DEMO_STATE,
      event: {
        ...DEMO_STATE.event,
        id: 'evt_currency_exact',
        totalBudget: exactBudgetMinor,
      },
      expenses: [
        {
          id: 'exp_exact_1',
          categoryId: 'cat_flowers',
          title: 'Marigold Garlands',
          amount: 3333333, // ₹33,333.33
          status: 'confirmed',
          paidAmount: 3333333,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
        {
          id: 'exp_exact_2',
          categoryId: 'cat_flowers',
          title: 'Rose Petal Shower',
          amount: 3333333, // ₹33,333.33
          status: 'confirmed',
          paidAmount: 3333333,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
        {
          id: 'exp_exact_3',
          categoryId: 'cat_flowers',
          title: 'Jasmine Fragrance Bar',
          amount: 3333334, // ₹33,333.34
          status: 'confirmed',
          paidAmount: 3333334,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    };

    dbContext.events.createEvent(testUserA, stateWithCents);

    // Perform database integer aggregation
    const result = dbContext.db
      .prepare<[string], { total_minor: number; count: number }>(`
        SELECT SUM(estimated_cost_minor) as total_minor, COUNT(*) as count
        FROM event_expenses
        WHERE event_id = ?
      `)
      .get('evt_currency_exact');

    expect(result).toBeDefined();
    expect(result?.count).toBe(3);
    // 3333333 + 3333333 + 3333334 = 10000000 (Exact 10 million minor units, no floating point deviation)
    expect(result?.total_minor).toBe(10000000);
    expect(Number.isInteger(result?.total_minor)).toBe(true);

    dbContext.close();
  });

  // ==========================================================================
  // Test 7: Live Non-Blocking Online Backup API
  // ==========================================================================
  it('executes online non-blocking database backup while active and validates replica integrity', async () => {
    const primaryDb = new DatabaseContext({ filename: backupSourceDbPath });
    try {
      // Seed data into primary
      primaryDb.users.createUser(testUserA);
      primaryDb.events.createEvent(testUserA, DEMO_STATE);

      // Perform online native SQLite backup
      await primaryDb.db.backup(backupDbPath);

      expect(fs.existsSync(backupDbPath)).toBe(true);
      expect(fs.statSync(backupDbPath).size).toBeGreaterThan(0);

      // Open backup file and verify data
      const backupDb = new DatabaseContext({ filename: backupDbPath });
      const userInBackup = backupDb.users.getUserById(testUserA.id);
      expect(userInBackup).not.toBeNull();
      expect(userInBackup?.name).toBe('Aaditya Sharma');

      const eventsInBackup = backupDb.events.listUserEvents(testUserA);
      expect(eventsInBackup.length).toBeGreaterThanOrEqual(1);

      backupDb.close();
    } finally {
      primaryDb.close();
    }
  });

  // ==========================================================================
  // Test 8: Versioned Database Migrations & Rollback
  // ==========================================================================
  it('applies versioned migrations sequentially and supports safe rollbacks', () => {
    const rawDb = new VowPilotDatabase({ filename: rollbackDbPath });
    const migrator = new Migrator(rawDb, MIGRATIONS);

    // Initial state: no migrations applied
    expect(migrator.getCurrentVersion()).toBeNull();

    // 1. Migrate to 001
    const applied1 = migrator.migrateTo('001');
    expect(applied1.length).toBe(1);
    expect(applied1[0].version).toBe('001');
    expect(migrator.getCurrentVersion()).toBe('001');

    // Verify 001 tables exist
    const tables001 = rawDb
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t) => t.name);
    expect(tables001).toContain('users');
    expect(tables001).toContain('events');
    expect(tables001).not.toContain('event_expenses');

    // 2. Migrate to 002
    const applied2 = migrator.migrateTo('002');
    expect(applied2.length).toBe(1);
    expect(applied2[0].version).toBe('002');
    expect(migrator.getCurrentVersion()).toBe('002');

    const tables002 = rawDb
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t) => t.name);
    expect(tables002).toContain('event_expenses');
    expect(tables002).toContain('event_tasks');
    expect(tables002).toContain('event_vendors');

    // 3. Rollback 002 -> 001
    const rolledBack = migrator.rollbackTo('001');
    expect(rolledBack.length).toBe(1);
    expect(rolledBack[0].version).toBe('002');
    expect(migrator.getCurrentVersion()).toBe('001');

    // Verify 002 tables are cleanly dropped, but 001 core tables remain
    const tablesAfterRollback = rawDb
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t) => t.name);
    expect(tablesAfterRollback).toContain('users');
    expect(tablesAfterRollback).toContain('events');
    expect(tablesAfterRollback).not.toContain('event_expenses');

    // 4. Re-apply to latest
    migrator.migrateToLatest();
    expect(migrator.getCurrentVersion()).toBe('003');

    rawDb.close();
  });
});
