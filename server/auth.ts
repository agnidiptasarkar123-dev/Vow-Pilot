import crypto from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify, Algorithm } from '@node-rs/argon2';
import { User } from './types';
import { DatabaseContext, getDatabaseContext } from './db';

export interface Argon2Parameters {
  algorithm: Algorithm;
  memoryCost: number;
  timeCost: number;
  outputLen: number;
  parallelism: number;
}

/**
 * OWASP-compliant Argon2id parameters:
 * - Algorithm: Argon2id (hybrid data-dependent / data-independent memory access)
 * - Memory cost: 19456 KiB (19 MiB)
 * - Time cost: 2 iterations
 * - Output length: 32 bytes (256-bit tag)
 * - Parallelism: 1 lane
 */
export const SECURE_ARGON2_PARAMS: Argon2Parameters = {
  algorithm: 2 as Algorithm, // Algorithm.Argon2id
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export interface FailedLoginEntry {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

export class SecurityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityConfigurationError';
  }
}

/**
 * Production environment security pre-flight check.
 * Enforces fail-closed posture if required cryptographic secrets are absent or weak.
 */
export function validateEnvironmentSecurity(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret.trim().length < 32) {
      throw new SecurityConfigurationError(
        'FATAL: In production, SESSION_SECRET must be explicitly configured with at least 32 cryptographically random characters.'
      );
    }
    if (sessionSecret.includes('dev_synthetic_secret') || sessionSecret.includes('change_in_production')) {
      throw new SecurityConfigurationError(
        'FATAL: In production, SESSION_SECRET cannot use the development placeholder value.'
      );
    }
  }
}

/**
 * Builds standard HttpOnly, SameSite=Lax session cookie header.
 */
export function buildSessionCookie(token: string, isProduction: boolean = process.env.NODE_ENV === 'production'): string {
  const parts = [
    `vowpilot_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 60 * 60}`, // 7 days
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Builds cookie invalidation header for explicit session logout.
 */
export function buildLogoutCookie(isProduction: boolean = process.env.NODE_ENV === 'production'): string {
  const parts = [
    'vowpilot_session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Extracts session token from Cookie header.
 */
export function parseSessionFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...valParts] = cookie.trim().split('=');
    if (name === 'vowpilot_session') {
      return decodeURIComponent(valParts.join('='));
    }
  }
  return null;
}

export class AuthStore {
  private dbContext: DatabaseContext;

  constructor(dbContext?: DatabaseContext) {
    this.dbContext = dbContext || getDatabaseContext();
  }

  public getDbContext(): DatabaseContext {
    return this.dbContext;
  }

  /**
   * Hashes a password using Argon2id with unique cryptographically random salt per invocation.
   */
  public async hashPassword(password: string): Promise<string> {
    return argon2Hash(password, SECURE_ARGON2_PARAMS);
  }

  /**
   * Verifies a password against stored hash.
   * If the account utilizes a legacy scrypt hash, it safely verifies the credentials using constant-time
   * scrypt comparison and returns needsRehash=true with the upgraded Argon2id hash.
   */
  public async verifyAndRehashPassword(
    storedHash: string,
    inputPassword: string
  ): Promise<{ isValid: boolean; needsRehash: boolean; newHash?: string }> {
    if (!storedHash || !inputPassword) {
      return { isValid: false, needsRehash: false };
    }

    // 1. Modern Argon2id PHC format ($argon2id$v=19$...)
    if (storedHash.startsWith('$argon2id$')) {
      try {
        const isValid = await argon2Verify(storedHash, inputPassword);
        return { isValid, needsRehash: false };
      } catch {
        return { isValid: false, needsRehash: false };
      }
    }

    // 2. Legacy scrypt format (salt:hexHash)
    if (storedHash.includes(':')) {
      const [salt, expectedHex] = storedHash.split(':');
      if (!salt || !expectedHex) {
        return { isValid: false, needsRehash: false };
      }

      try {
        const computedHex = crypto.scryptSync(inputPassword, salt, 64).toString('hex');
        const computedBuf = Buffer.from(computedHex, 'hex');
        const expectedBuf = Buffer.from(expectedHex, 'hex');

        if (computedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(computedBuf, expectedBuf)) {
          return { isValid: false, needsRehash: false };
        }

        // Credentials matched legacy scrypt! Perform transparent rehash to Argon2id.
        const newHash = await this.hashPassword(inputPassword);
        return { isValid: true, needsRehash: true, newHash };
      } catch {
        return { isValid: false, needsRehash: false };
      }
    }

    // Unknown/unsupported hashing algorithm: fail closed.
    return { isValid: false, needsRehash: false };
  }

  /**
   * Checks brute-force lockout status for an email identifier.
   */
  private checkBruteForceLockout(cleanEmail: string): void {
    const entry = this.dbContext.users.getFailedLogins(cleanEmail);
    if (!entry) return;

    const now = Date.now();
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const remainingMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
      throw new Error(
        `Rate limit exceeded: Account temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      );
    }
  }

  public async registerUser(
    name: string,
    email: string,
    password: string
  ): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !cleanName) {
      throw new Error('Invalid registration data: email and name are required.');
    }

    // Email format RFC 5322 check
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Invalid registration data: Invalid email format.');
    }

    if (password.length < 8) {
      throw new Error('Invalid registration data: password must be at least 8 characters.');
    }
    if (password.length > 128) {
      throw new Error('Invalid registration data: password exceeds maximum length of 128 characters.');
    }

    const existingUser = this.dbContext.users.getUserByEmail(cleanEmail);
    if (existingUser) {
      throw new Error('User already exists with this email address.');
    }

    const passwordHash = await this.hashPassword(password);
    const user: User = {
      id: `usr-${crypto.randomBytes(8).toString('hex')}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.dbContext.users.createUser(user);

    const token = this.createSession(user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public async loginUser(
    email: string,
    password: string,
    existingSessionToken?: string
  ): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Brute-force protection
    this.checkBruteForceLockout(cleanEmail);

    const user = this.dbContext.users.getUserByEmail(cleanEmail);
    if (!user) {
      this.dbContext.users.recordFailedLogin(cleanEmail);
      throw new Error('Invalid email or password.');
    }

    // 2. Timing-safe verification & safe rehashing
    const { isValid, needsRehash, newHash } = await this.verifyAndRehashPassword(user.passwordHash, password);
    if (!isValid) {
      this.dbContext.users.recordFailedLogin(cleanEmail);
      throw new Error('Invalid email or password.');
    }

    // 3. Clear failed login counter on success
    this.dbContext.users.clearFailedLogins(cleanEmail);

    // 4. Safe migration / transparent rehashing if needed
    if (needsRehash && newHash) {
      this.dbContext.users.updatePasswordHash(user.id, newHash);
      user.passwordHash = newHash;
    }

    // 5. Session rotation: rotate token to prevent session fixation
    const token = this.rotateSession(existingSessionToken, user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  /**
   * Generates a cryptographically secure 192-bit CSPRNG session token.
   */
  public createSession(userId: string): string {
    const token = `vow_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    this.dbContext.sessions.createSession(token, userId, expiresAt);
    return token;
  }

  /**
   * Rotates session token after authentication or privilege change to mitigate session fixation.
   */
  public rotateSession(oldToken: string | undefined, userId: string): string {
    if (oldToken) {
      this.revokeSession(oldToken);
    }
    return this.createSession(userId);
  }

  public authenticateToken(token?: string): User | null {
    if (!token) return null;
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const session = this.dbContext.sessions.getSession(cleanToken);
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      this.dbContext.sessions.revokeSession(cleanToken);
      return null;
    }

    return this.dbContext.users.getUserById(session.userId);
  }

  public revokeSession(token: string): void {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    this.dbContext.sessions.revokeSession(cleanToken);
  }

  public seedUserWithRawHash(user: User): void {
    this.dbContext.users.createUser(user);
  }

  public getUser(email: string): User | undefined {
    return this.dbContext.users.getUserByEmail(email) || undefined;
  }

  public clear(): void {
    this.dbContext.clearAll();
  }
}

export const globalAuthStore = new AuthStore();
