import crypto from 'node:crypto';
import { AppState } from '../src/types';
import {
  ServerEventRecord,
  UserRole,
  InviteToken,
  ConcurrencyConflict,
  User,
} from './types';
import { AuthPolicy } from './authPolicy';
import { DatabaseContext, getDatabaseContext } from './db';

export type EventSubscriber = (event: ServerEventRecord) => void;

export class EventStore {
  private dbContext: DatabaseContext;
  private subscribers: Map<string, Set<EventSubscriber>> = new Map(); // eventId -> SSE callbacks

  constructor(dbContext?: DatabaseContext) {
    this.dbContext = dbContext || getDatabaseContext();
  }

  public getDbContext(): DatabaseContext {
    return this.dbContext;
  }

  public get invites(): { has(key: string): boolean } {
    return {
      has: (key: string) => {
        return !!this.dbContext.invitations.getInviteByHash(key);
      },
    };
  }

  public createEvent(owner: User, initialState: AppState): ServerEventRecord {
    return this.dbContext.events.createEvent(owner, initialState);
  }

  public getEvent(eventId: string, requestingUser: User): ServerEventRecord {
    return this.dbContext.events.getEvent(eventId, requestingUser);
  }

  public getUserRole(eventId: string, userId: string): UserRole | null {
    return this.dbContext.events.getUserRole(eventId, userId);
  }

  public listUserEvents(user: User): Array<{ id: string; name: string; role: UserRole; version: number; updatedAt: string }> {
    return this.dbContext.events.listUserEvents(user);
  }

  /**
   * Updates event state using Optimistic Concurrency Control (OCC) backed by database transactions.
   * Rejects stale writes where expectedVersion !== currentVersion to prevent silent overwrites.
   */
  public updateEvent(
    eventId: string,
    requestingUser: User,
    expectedVersion: number,
    newState: AppState
  ): { success: true; event: ServerEventRecord } | ConcurrencyConflict {
    const result = this.dbContext.events.updateEvent(eventId, requestingUser, expectedVersion, newState);
    if ('success' in result && result.success) {
      this.notifySubscribers(eventId, result.event);
    }
    return result;
  }

  /**
   * Generates a cryptographically secure 256-bit invitation token.
   * Stores only the SHA-256 digest in server storage to prevent token theft from memory or database dumps.
   */
  public createInvite(
    eventId: string,
    requestingUser: User,
    role: UserRole = 'editor',
    expiresInHours: number = 48
  ): InviteToken {
    this.getEvent(eventId, requestingUser);
    const requesterRole = this.getUserRole(eventId, requestingUser.id);
    if (!requesterRole) {
      throw new Error('Unauthorized: You are not a member of this event.');
    }

    if (role !== 'owner' && role !== 'editor' && role !== 'viewer') {
      throw new Error('Invalid invitation role: Must be owner, editor, or viewer.');
    }

    if (!AuthPolicy.canCreateInvite(requesterRole, role)) {
      if (requesterRole === 'editor' && role === 'owner') {
        throw new Error('Forbidden: Only event owners can invite another owner.');
      }
      throw new Error('Forbidden: Only owners and editors can generate invitations.');
    }

    // 256 bits of cryptographically secure entropy
    const rawToken = `inv_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString();

    const storedInvite: InviteToken = {
      token: `[HASHED:${tokenHash.slice(0, 8)}]`,
      tokenHash,
      eventId,
      role,
      createdBy: requestingUser.id,
      createdAt: now.toISOString(),
      expiresAt,
      used: false,
      revoked: false,
    };

    this.dbContext.invitations.createInvite(storedInvite);

    // Return the unhashed token only once to the issuing caller
    return {
      ...storedInvite,
      token: rawToken,
    };
  }

  /**
   * Accepts an invitation, validates single-use token consumption, and joins the event.
   */
  public joinWithInvite(rawToken: string, user: User): ServerEventRecord {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('Invalid or non-existent invitation token.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const invite = this.dbContext.invitations.getInviteByHash(tokenHash);

    if (!invite) {
      throw new Error('Invalid or non-existent invitation token.');
    }
    if (invite.revoked) {
      throw new Error('This invitation token has been revoked.');
    }
    if (invite.used) {
      throw new Error('This invitation token has already been used.');
    }
    if (new Date(invite.expiresAt) < new Date()) {
      throw new Error('This invitation token has expired.');
    }

    // Add member to event
    const event = this.dbContext.events.addMember(invite.eventId, user, invite.role);

    // Mark as consumed immediately to prevent replay
    this.dbContext.invitations.markInviteUsed(tokenHash, user.id);

    return event;
  }

  /**
   * Declines an active invitation. Marks token as consumed without adding user to event members.
   */
  public declineInvite(rawToken: string, user?: User): { success: true; message: string } {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('Invalid or non-existent invitation token.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const invite = this.dbContext.invitations.getInviteByHash(tokenHash);

    if (!invite) {
      throw new Error('Invalid or non-existent invitation token.');
    }
    if (invite.revoked) {
      throw new Error('This invitation token has been revoked.');
    }
    if (invite.used) {
      throw new Error('This invitation token has already been used.');
    }
    if (new Date(invite.expiresAt) < new Date()) {
      throw new Error('This invitation token has expired.');
    }

    this.dbContext.invitations.markInviteUsed(tokenHash, user?.id || 'declined_user');
    return { success: true, message: 'Invitation declined successfully.' };
  }

  /**
   * Previews an invitation before accepting or declining.
   */
  public inspectInvite(rawToken: string): {
    eventId: string;
    eventName: string;
    role: UserRole;
    inviterName: string;
    expiresAt: string;
    status: 'valid' | 'expired' | 'revoked' | 'used';
  } {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('Invalid or non-existent invitation token.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const invite = this.dbContext.invitations.getInviteByHash(tokenHash);

    if (!invite) {
      throw new Error('Invitation token not found.');
    }

    let status: 'valid' | 'expired' | 'revoked' | 'used' = 'valid';
    if (invite.revoked) {
      status = 'revoked';
    } else if (invite.used) {
      status = 'used';
    } else if (new Date(invite.expiresAt) < new Date()) {
      status = 'expired';
    }

    const event = this.dbContext.events.getEventMetadata(invite.eventId);
    const inviter = this.dbContext.users.getUserById(invite.createdBy);

    return {
      eventId: invite.eventId,
      eventName: event?.name || 'VowPilot Celebration',
      role: invite.role,
      inviterName: inviter?.name || 'Event Coordinator',
      expiresAt: invite.expiresAt,
      status,
    };
  }

  /**
   * Lists all invitations for an event.
   */
  public listEventInvites(eventId: string, requestingUser: User): InviteToken[] {
    const role = this.getUserRole(eventId, requestingUser.id);
    if (!role || (role !== 'owner' && role !== 'editor')) {
      throw new Error('Forbidden: Only event owners and editors can view invitations.');
    }

    return this.dbContext.invitations.listEventInvites(eventId);
  }

  /**
   * Proactively revokes an active invitation token.
   * Accepts either rawToken or tokenHash.
   */
  public revokeInvite(eventId: string, requestingUser: User, rawTokenOrHash: string): void {
    const event = this.getEvent(eventId, requestingUser);
    const requesterRole = this.getUserRole(eventId, requestingUser.id);
    if (requesterRole !== 'owner') {
      throw new Error('Forbidden: Only the event owner can revoke invitations.');
    }

    const trimmed = rawTokenOrHash.trim();
    let invite = this.dbContext.invitations.getInviteByHash(trimmed);
    let resolvedHash = trimmed;

    if (!invite) {
      resolvedHash = crypto.createHash('sha256').update(trimmed).digest('hex');
      invite = this.dbContext.invitations.getInviteByHash(resolvedHash);
    }

    if (!invite || invite.eventId !== event.id) {
      throw new Error('Invitation token not found.');
    }

    this.dbContext.invitations.revokeInvite(resolvedHash);
  }

  /**
   * Removes a member from an event (access revocation).
   */
  public removeMember(eventId: string, requestingUser: User, targetUserId: string): ServerEventRecord {
    return this.dbContext.events.removeMember(eventId, requestingUser, targetUserId);
  }

  public deleteEvent(eventId: string, requestingUser: User): void {
    this.dbContext.events.deleteEvent(eventId, requestingUser);
    this.subscribers.delete(eventId);
  }

  public subscribe(eventId: string, callback: EventSubscriber): () => void {
    const set = this.subscribers.get(eventId) || new Set();
    set.add(callback);
    this.subscribers.set(eventId, set);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(eventId);
      }
    };
  }

  private notifySubscribers(eventId: string, event: ServerEventRecord): void {
    const set = this.subscribers.get(eventId);
    if (set) {
      for (const cb of set) {
        try {
          cb(event);
        } catch {
          // Ignore subscriber delivery error
        }
      }
    }
  }

  public clear(): void {
    this.dbContext.clearAll();
    this.subscribers.clear();
  }
}

export const globalEventStore = new EventStore();
