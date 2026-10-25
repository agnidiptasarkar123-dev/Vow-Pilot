import { VowPilotDatabase } from '../connection';
import { Session } from '../../types';
import { SessionRow } from '../types';

export class SessionRepository {
  private db: VowPilotDatabase;

  constructor(db: VowPilotDatabase) {
    this.db = db;
  }

  public createSession(token: string, userId: string, expiresAt: string): Session {
    const now = new Date().toISOString();
    this.db
      .prepare<[string, string, string, string]>(`
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(token, userId, now, expiresAt);

    return {
      token,
      userId,
      createdAt: now,
      expiresAt,
    };
  }

  public getSession(token: string): Session | null {
    const row = this.db
      .prepare<[string], SessionRow>('SELECT token, user_id, created_at, expires_at FROM sessions WHERE token = ?')
      .get(token);

    if (!row) return null;
    return {
      token: row.token,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  public revokeSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  public revokeUserSessions(userId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  public cleanupExpired(): number {
    const now = new Date().toISOString();
    const result = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    return result.changes;
  }

  public clearAll(): void {
    this.db.exec('DELETE FROM sessions;');
  }
}
