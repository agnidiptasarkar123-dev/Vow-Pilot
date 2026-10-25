import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseHealthStatus } from './types';

export interface DatabaseOptions {
  filename?: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
}

export class VowPilotDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(options: DatabaseOptions = {}) {
    const defaultDir = path.resolve(process.cwd(), 'data');
    const defaultPath = path.join(defaultDir, 'vowpilot.db');
    const envPath = process.env.DATABASE_PATH || process.env.SQLITE_PATH;
    this.dbPath = options.filename || (envPath ? (envPath === ':memory:' ? ':memory:' : path.resolve(process.cwd(), envPath)) : defaultPath);

    // Ensure parent directory exists for file-based database at runtime
    if (this.dbPath !== ':memory:') {
      const parentDir = path.dirname(this.dbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        console.log(`[VowPilot Database] Active database path: ${this.dbPath}`);
      }
    }

    this.db = new Database(this.dbPath, {
      timeout: options.timeout ?? 5000, // 5 second busy timeout for concurrent multi-process writes
      verbose: options.verbose,
    });

    this.configurePragmas();
  }

  /**
   * Enforces strict production SQLite pragmas:
   * 1. foreign_keys = ON (Enforces referential integrity at the engine level)
   * 2. journal_mode = WAL (Write-Ahead Logging for multi-process concurrency)
   * 3. synchronous = NORMAL (Balances ACID durability with performance)
   * 4. busy_timeout = 5000 (Prevents SQLITE_BUSY under concurrent multi-instance operations)
   */
  private configurePragmas(): void {
    this.db.pragma('foreign_keys = ON');
    if (this.dbPath !== ':memory:') {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
    }
    this.db.pragma('busy_timeout = 5000');
  }

  public getRawDb(): Database.Database {
    return this.db;
  }

  public getPath(): string {
    return this.dbPath;
  }

  public prepare<T extends unknown[] = unknown[], R = unknown>(sql: string): Database.Statement<T, R> {
    return this.db.prepare<T, R>(sql);
  }

  public exec(sql: string): this {
    this.db.exec(sql);
    return this;
  }

  public transaction<F extends (...args: any[]) => any>(fn: F): F {
    return (this.db.transaction(fn) as unknown) as F;
  }

  /**
   * Online, non-blocking snapshot backup using SQLite's native backup API.
   * Can run while the application is actively serving queries.
   */
  public async backup(destinationPath: string): Promise<void> {
    const parentDir = path.dirname(destinationPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await this.db.backup(destinationPath);
  }

  /**
   * Operational Health Check:
   * Verifies database responsiveness, journal mode, foreign key enforcement, and migration state.
   */
  public healthCheck(): DatabaseHealthStatus {
    try {
      this.db.prepare('SELECT 1').get();
      const fk = this.db.pragma('foreign_keys', { simple: true }) as number;
      const jm = this.db.pragma('journal_mode', { simple: true }) as string;

      let migrationsCount = 0;
      try {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM schema_migrations').get() as { cnt: number };
        migrationsCount = row?.cnt ?? 0;
      } catch {
        migrationsCount = 0;
      }

      return {
        healthy: true,
        databasePath: this.dbPath,
        journalMode: jm,
        foreignKeysEnabled: fk === 1,
        migrationsCount,
      };
    } catch (err: unknown) {
      return {
        healthy: false,
        databasePath: this.dbPath,
        journalMode: 'unknown',
        foreignKeysEnabled: false,
        migrationsCount: 0,
        error: err instanceof Error ? err.message : 'Database health check failed',
      };
    }
  }

  public close(): void {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }
}
