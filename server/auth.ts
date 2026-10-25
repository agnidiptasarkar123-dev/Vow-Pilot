import crypto from 'node:crypto';
import { User, Session } from './types';

export class AuthStore {
  private users: Map<string, User> = new Map(); // email -> User
  private usersById: Map<string, User> = new Map(); // id -> User
  private sessions: Map<string, Session> = new Map(); // token -> Session

  /**
   * Hashes a password with salt using SHA-256 for deterministic, secure local storage.
   */
  public hashPassword(password: string, salt: string): string {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
  }

  public registerUser(name: string, email: string, password: string): { user: Omit<User, 'passwordHash'>; token: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !name.trim() || password.length < 6) {
      throw new Error('Invalid registration data: email, name, and password (min 6 chars) are required.');
    }
    if (this.users.has(cleanEmail)) {
      throw new Error('User already exists with this email address.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = `${salt}:${this.hashPassword(password, salt)}`;
    const user: User = {
      id: `usr-${crypto.randomBytes(8).toString('hex')}`,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.users.set(cleanEmail, user);
    this.usersById.set(user.id, user);

    const token = this.createSession(user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public loginUser(email: string, password: string): { user: Omit<User, 'passwordHash'>; token: string } {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.users.get(cleanEmail);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const [salt, storedHash] = user.passwordHash.split(':');
    const inputHash = this.hashPassword(password, salt);
    if (inputHash !== storedHash) {
      throw new Error('Invalid email or password.');
    }

    const token = this.createSession(user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public createSession(userId: string): string {
    const token = `vow_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const session: Session = {
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.sessions.set(token, session);
    return token;
  }

  public authenticateToken(token?: string): User | null {
    if (!token) return null;
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const session = this.sessions.get(cleanToken);
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(cleanToken);
      return null;
    }

    const user = this.usersById.get(session.userId);
    return user || null;
  }

  public revokeSession(token: string): void {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    this.sessions.delete(cleanToken);
  }

  public clear(): void {
    this.users.clear();
    this.usersById.clear();
    this.sessions.clear();
  }
}

export const globalAuthStore = new AuthStore();
