import { VowPilotDatabase } from '../connection';
import { InviteToken, UserRole } from '../../types';
import { EventInvitationRow } from '../types';

export class InvitationRepository {
  private db: VowPilotDatabase;

  constructor(db: VowPilotDatabase) {
    this.db = db;
  }

  public createInvite(invite: InviteToken): void {
    const tokenHash = invite.tokenHash || invite.token;
    this.db
      .prepare<[string, string, string, string, string, string, number, string | null, number]>(`
        INSERT INTO event_invitations (token_hash, event_id, role, created_by, created_at, expires_at, used, used_by, revoked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        tokenHash,
        invite.eventId,
        invite.role,
        invite.createdBy,
        invite.createdAt,
        invite.expiresAt,
        invite.used ? 1 : 0,
        invite.usedBy || null,
        invite.revoked ? 1 : 0
      );
  }

  public getInviteByHash(tokenHash: string): InviteToken | null {
    const row = this.db
      .prepare<[string], EventInvitationRow>(`
        SELECT token_hash, event_id, role, created_by, created_at, expires_at, used, used_by, revoked
        FROM event_invitations
        WHERE token_hash = ?
      `)
      .get(tokenHash);

    if (!row) return null;
    return {
      token: `[HASHED:${row.token_hash.slice(0, 8)}]`,
      tokenHash: row.token_hash,
      eventId: row.event_id,
      role: row.role as UserRole,
      createdBy: row.created_by,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      used: row.used === 1,
      usedBy: row.used_by ?? undefined,
      revoked: row.revoked === 1,
    };
  }

  public markInviteUsed(tokenHash: string, usedByUserId: string): void {
    this.db
      .prepare('UPDATE event_invitations SET used = 1, used_by = ? WHERE token_hash = ?')
      .run(usedByUserId, tokenHash);
  }

  public revokeInvite(tokenHash: string): void {
    this.db.prepare('UPDATE event_invitations SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  }

  public listEventInvites(eventId: string): InviteToken[] {
    const rows = this.db
      .prepare<[string], EventInvitationRow>(`
        SELECT token_hash, event_id, role, created_by, created_at, expires_at, used, used_by, revoked
        FROM event_invitations
        WHERE event_id = ?
        ORDER BY created_at DESC
      `)
      .all(eventId);

    return rows.map((row) => ({
      token: `[HASHED:${row.token_hash.slice(0, 8)}]`,
      tokenHash: row.token_hash,
      eventId: row.event_id,
      role: row.role as UserRole,
      createdBy: row.created_by,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      used: row.used === 1,
      usedBy: row.used_by ?? undefined,
      revoked: row.revoked === 1,
    }));
  }

  public clearAll(): void {
    this.db.exec('DELETE FROM event_invitations;');
  }
}
