import crypto from 'node:crypto';
import { AppState } from '../src/types';
import {
  ServerEventRecord,
  UserRole,
  InviteToken,
  ConcurrencyConflict,
  User,
} from './types';

export type EventSubscriber = (event: ServerEventRecord) => void;

export class EventStore {
  private events: Map<string, ServerEventRecord> = new Map();
  private invites: Map<string, InviteToken> = new Map(); // token -> InviteToken
  private subscribers: Map<string, Set<EventSubscriber>> = new Map(); // eventId -> callbacks

  public createEvent(owner: User, initialState: AppState): ServerEventRecord {
    const eventId = initialState.event.id || `evt-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const record: ServerEventRecord = {
      id: eventId,
      ownerId: owner.id,
      version: 1,
      state: {
        ...initialState,
        event: {
          ...initialState.event,
          id: eventId,
        },
      },
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

    this.events.set(eventId, record);
    return record;
  }

  public getEvent(eventId: string, requestingUser: User): ServerEventRecord {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error('Event not found.');
    }

    const member = event.members.find((m) => m.userId === requestingUser.id);
    if (!member) {
      throw new Error('Unauthorized: You are not a member of this event.');
    }

    return event;
  }

  public getUserRole(eventId: string, userId: string): UserRole | null {
    const event = this.events.get(eventId);
    if (!event) return null;
    const member = event.members.find((m) => m.userId === userId);
    return member ? member.role : null;
  }

  public listUserEvents(user: User): Array<{ id: string; name: string; role: UserRole; version: number; updatedAt: string }> {
    const result: Array<{ id: string; name: string; role: UserRole; version: number; updatedAt: string }> = [];
    for (const event of this.events.values()) {
      const member = event.members.find((m) => m.userId === user.id);
      if (member) {
        result.push({
          id: event.id,
          name: event.state.event.name,
          role: member.role,
          version: event.version,
          updatedAt: event.updatedAt,
        });
      }
    }
    return result;
  }

  /**
   * Updates event state using Optimistic Concurrency Control (OCC).
   * Rejects writes where expectedVersion !== currentVersion to prevent silent overwrites.
   */
  public updateEvent(
    eventId: string,
    requestingUser: User,
    expectedVersion: number,
    newState: AppState
  ): { success: true; event: ServerEventRecord } | ConcurrencyConflict {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error('Event not found.');
    }

    const member = event.members.find((m) => m.userId === requestingUser.id);
    if (!member) {
      throw new Error('Unauthorized: You are not a member of this event.');
    }
    if (member.role === 'viewer') {
      throw new Error('Forbidden: Viewer role does not have permission to modify event data.');
    }

    // OCC Check
    if (event.version !== expectedVersion) {
      return {
        error: 'CONCURRENCY_CONFLICT',
        message: `Version conflict: Your update was based on version ${expectedVersion}, but the server is already at version ${event.version}. Concurrent edit made by ${event.lastModifiedBy}.`,
        expectedVersion,
        currentVersion: event.version,
        lastModifiedBy: event.lastModifiedBy,
        currentState: event.state,
      };
    }

    const now = new Date().toISOString();
    event.version += 1;
    event.state = {
      ...newState,
      event: {
        ...newState.event,
        id: event.id,
        updatedAt: now,
      },
    };
    event.updatedAt = now;
    event.lastModifiedBy = requestingUser.name;

    this.notifySubscribers(eventId, event);
    return { success: true, event };
  }

  /**
   * Generates a secure invitation token for an event.
   */
  public createInvite(
    eventId: string,
    requestingUser: User,
    role: UserRole = 'editor',
    expiresInHours: number = 48
  ): InviteToken {
    const event = this.getEvent(eventId, requestingUser);
    const member = event.members.find((m) => m.userId === requestingUser.id);
    if (member?.role !== 'owner' && member?.role !== 'editor') {
      throw new Error('Forbidden: Only owners and editors can generate invitations.');
    }
    if (role !== 'owner' && role !== 'editor' && role !== 'viewer') {
      throw new Error('Invalid invitation role: Must be owner, editor, or viewer.');
    }
    if (role === 'owner' && member?.role !== 'owner') {
      throw new Error('Forbidden: Only event owners can invite another owner.');
    }

    const token = `inv_${crypto.randomBytes(20).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString();

    const invite: InviteToken = {
      token,
      eventId,
      role,
      createdBy: requestingUser.id,
      createdAt: now.toISOString(),
      expiresAt,
      used: false,
    };

    this.invites.set(token, invite);
    return invite;
  }

  /**
   * Accepts an invitation and joins the event.
   */
  public joinWithInvite(inviteToken: string, user: User): ServerEventRecord {
    const invite = this.invites.get(inviteToken);
    if (!invite) {
      throw new Error('Invalid or non-existent invitation token.');
    }
    if (invite.used) {
      throw new Error('This invitation token has already been used.');
    }
    if (new Date(invite.expiresAt) < new Date()) {
      throw new Error('This invitation token has expired.');
    }

    const event = this.events.get(invite.eventId);
    if (!event) {
      throw new Error('Associated event no longer exists.');
    }

    // Check if already a member
    const existingMember = event.members.find((m) => m.userId === user.id);
    if (!existingMember) {
      event.members.push({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        role: invite.role,
        joinedAt: new Date().toISOString(),
      });
      invite.used = true;
      invite.usedBy = user.id;
    }

    return event;
  }

  /**
   * Removes a member from an event (access revocation).
   */
  public removeMember(eventId: string, requestingUser: User, targetUserId: string): ServerEventRecord {
    const event = this.getEvent(eventId, requestingUser);
    const requester = event.members.find((m) => m.userId === requestingUser.id);
    if (requester?.role !== 'owner') {
      throw new Error('Forbidden: Only the event owner can remove members.');
    }
    if (targetUserId === event.ownerId) {
      throw new Error('Cannot remove the owner of the event.');
    }

    event.members = event.members.filter((m) => m.userId !== targetUserId);
    return event;
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
    this.events.clear();
    this.invites.clear();
    this.subscribers.clear();
  }
}

export const globalEventStore = new EventStore();
