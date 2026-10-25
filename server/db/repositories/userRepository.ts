import { VowPilotDatabase } from '../connection';
import { User } from '../../types';
import { UserRow, FailedLoginRow } from '../types';
import { FailedLoginEntry } from '../../auth';

export class UserRepository {
  private db: VowPilotDatabase;

  constructor(db: VowPilotDatabase) {
    this.db = db;
  }

  public createUser(user: User): User {
    const stmt = this.db.prepare<[string, string, string, string, string]>(`
      INSERT INTO users (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(user.id, user.name, user.email.toLowerCase(), user.passwordHash, user.createdAt);
    return user;
  }

  public getUserById(id: string): User | null {
    const row = this.db
      .prepare<[string], UserRow>('SELECT id, name, email, password_hash, created_at FROM users WHERE id = ?')
      .get(id);

    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  }

  public getUserByEmail(email: string): User | null {
    const row = this.db
      .prepare<[string], UserRow>(
        'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ? COLLATE NOCASE'
      )
      .get(email.trim().toLowerCase());

    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  }

  public updatePasswordHash(userId: string, newHash: string): void {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
  }

  public getFailedLogins(identifier: string): FailedLoginEntry | null {
    const cleanId = identifier.trim().toLowerCase();
    const row = this.db
      .prepare<[string], FailedLoginRow>(
        'SELECT identifier, count, first_attempt, locked_until FROM failed_logins WHERE identifier = ?'
      )
      .get(cleanId);

    if (!row) return null;
    return {
      count: row.count,
      firstAttempt: row.first_attempt,
      lockedUntil: row.locked_until ?? undefined,
    };
  }

  public recordFailedLogin(identifier: string, lockoutDurationMs: number = 15 * 60 * 1000): void {
    const cleanId = identifier.trim().toLowerCase();
    const now = Date.now();
    const existing = this.getFailedLogins(cleanId);

    if (!existing || now - existing.firstAttempt > lockoutDurationMs) {
      this.db
        .prepare(`
          INSERT INTO failed_logins (identifier, count, first_attempt, locked_until)
          VALUES (?, 1, ?, NULL)
          ON CONFLICT(identifier) DO UPDATE SET count = 1, first_attempt = excluded.first_attempt, locked_until = NULL
        `)
        .run(cleanId, now);
      return;
    }

    const newCount = existing.count + 1;
    const lockedUntil = newCount >= 5 ? now + lockoutDurationMs : null;

    this.db
      .prepare('UPDATE failed_logins SET count = ?, locked_until = ? WHERE identifier = ?')
      .run(newCount, lockedUntil, cleanId);
  }

  public clearFailedLogins(identifier: string): void {
    const cleanId = identifier.trim().toLowerCase();
    this.db.prepare('DELETE FROM failed_logins WHERE identifier = ?').run(cleanId);
  }

  public clearAll(): void {
    this.db.exec('DELETE FROM users; DELETE FROM failed_logins;');
  }
}
