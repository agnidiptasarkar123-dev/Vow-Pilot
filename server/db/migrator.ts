import { VowPilotDatabase } from './connection';

export interface MigrationDefinition {
  version: string;
  name: string;
  upSql: string;
  downSql?: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  applied_at: string;
}

export const MIGRATIONS: MigrationDefinition[] = [
  {
    version: '001',
    name: 'initial_schema',
    upSql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        version INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        event_date TEXT,
        target_budget_minor INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR',
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_modified_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS event_members (
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
        joined_at TEXT NOT NULL,
        PRIMARY KEY (event_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS event_invitations (
        token_hash TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        used_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        revoked INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS email_audit_records (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        vendor_id TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_message_id TEXT,
        dispatched_at TEXT NOT NULL,
        dispatched_by TEXT NOT NULL,
        idempotency_key TEXT UNIQUE,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS failed_logins (
        identifier TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        first_attempt INTEGER NOT NULL,
        locked_until INTEGER
      );

      CREATE TABLE IF NOT EXISTS event_activity_history (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        version INTEGER NOT NULL,
        details_json TEXT,
        created_at TEXT NOT NULL
      );
    `,
    downSql: `
      DROP TABLE IF EXISTS event_activity_history;
      DROP TABLE IF EXISTS failed_logins;
      DROP TABLE IF EXISTS email_audit_records;
      DROP TABLE IF EXISTS event_invitations;
      DROP TABLE IF EXISTS event_members;
      DROP TABLE IF EXISTS events;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS users;
    `,
  },
  {
    version: '002',
    name: 'relational_indices',
    upSql: `
      CREATE TABLE IF NOT EXISTS event_expenses (
        id TEXT NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        estimated_cost_minor INTEGER NOT NULL DEFAULT 0,
        actual_cost_minor INTEGER NOT NULL DEFAULT 0,
        paid_amount_minor INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('estimated', 'quoted', 'confirmed', 'actual')),
        vendor_id TEXT,
        due_date TEXT,
        notes TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (event_id, id)
      );

      CREATE TABLE IF NOT EXISTS event_tasks (
        id TEXT NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        phase TEXT NOT NULL,
        due_date TEXT,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        completed INTEGER NOT NULL DEFAULT 0,
        assigned_to TEXT,
        estimated_cost_minor INTEGER NOT NULL DEFAULT 0,
        actual_cost_minor INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (event_id, id)
      );

      CREATE TABLE IF NOT EXISTS event_vendors (
        id TEXT NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        contact_email TEXT,
        contact_phone TEXT,
        PRIMARY KEY (event_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

      CREATE INDEX IF NOT EXISTS idx_events_owner_id ON events(owner_id);
      CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events(updated_at);

      CREATE INDEX IF NOT EXISTS idx_event_members_user_id ON event_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_event_invitations_event_id ON event_invitations(event_id);

      CREATE INDEX IF NOT EXISTS idx_email_audit_event_id ON email_audit_records(event_id);
      CREATE INDEX IF NOT EXISTS idx_email_audit_idempotency ON email_audit_records(idempotency_key);

      CREATE INDEX IF NOT EXISTS idx_event_expenses_event_id ON event_expenses(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON event_tasks(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_vendors_event_id ON event_vendors(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_activity_event_version ON event_activity_history(event_id, version);
    `,
    downSql: `
      DROP INDEX IF EXISTS idx_event_activity_event_version;
      DROP INDEX IF EXISTS idx_event_vendors_event_id;
      DROP INDEX IF EXISTS idx_event_tasks_event_id;
      DROP INDEX IF EXISTS idx_event_expenses_event_id;
      DROP INDEX IF EXISTS idx_email_audit_idempotency;
      DROP INDEX IF EXISTS idx_email_audit_event_id;
      DROP INDEX IF EXISTS idx_event_invitations_event_id;
      DROP INDEX IF EXISTS idx_event_members_user_id;
      DROP INDEX IF EXISTS idx_events_updated_at;
      DROP INDEX IF EXISTS idx_events_owner_id;
      DROP INDEX IF EXISTS idx_sessions_expires_at;
      DROP INDEX IF EXISTS idx_sessions_user_id;

      DROP TABLE IF EXISTS event_vendors;
      DROP TABLE IF EXISTS event_tasks;
      DROP TABLE IF EXISTS event_expenses;
    `,
  },
  {
    version: '003',
    name: 'email_delivery_hardening',
    upSql: `
      ALTER TABLE email_audit_records ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE email_audit_records ADD COLUMN reply_to TEXT;
      ALTER TABLE email_audit_records ADD COLUMN preview_url TEXT;
      ALTER TABLE email_audit_records ADD COLUMN html_body TEXT;

      CREATE INDEX IF NOT EXISTS idx_email_audit_dispatched_at ON email_audit_records(dispatched_at);
      CREATE INDEX IF NOT EXISTS idx_email_audit_recipient_rate ON email_audit_records(recipient_email, dispatched_at);
      CREATE INDEX IF NOT EXISTS idx_email_audit_user_rate ON email_audit_records(dispatched_by, dispatched_at);
    `,
    downSql: `
      DROP INDEX IF EXISTS idx_email_audit_user_rate;
      DROP INDEX IF EXISTS idx_email_audit_recipient_rate;
      DROP INDEX IF EXISTS idx_email_audit_dispatched_at;
    `,
  },
];

export class Migrator {
  private db: VowPilotDatabase;
  private migrations: MigrationDefinition[];

  constructor(db: VowPilotDatabase, migrations: MigrationDefinition[] = MIGRATIONS) {
    this.db = db;
    this.migrations = migrations;
  }

  /**
   * Ensures the migration tracking table exists before reading migration state.
   */
  public ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  public getAppliedMigrations(): AppliedMigration[] {
    this.ensureMigrationsTable();
    return this.db
      .prepare<[], AppliedMigration>('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
      .all();
  }

  public getPendingMigrations(): MigrationDefinition[] {
    const appliedVersions = new Set(this.getAppliedMigrations().map((m) => m.version));
    return this.migrations.filter((m) => !appliedVersions.has(m.version));
  }

  /**
   * Runs all pending migrations in sequential order.
   * Each migration runs inside an isolated ACID transaction.
   */
  public migrateToLatest(): { appliedCount: number; appliedVersions: string[] } {
    this.ensureMigrationsTable();
    const pending = this.getPendingMigrations();
    const appliedVersions: string[] = [];

    for (const migration of pending) {
      const applyMigrationTx = this.db.transaction(() => {
        // Execute the migration DDL
        this.db.exec(migration.upSql);

        // Record migration in schema_migrations
        this.db
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
      });

      applyMigrationTx();
      appliedVersions.push(migration.version);
    }

    return {
      appliedCount: appliedVersions.length,
      appliedVersions,
    };
  }

  public getCurrentVersion(): string | null {
    const applied = this.getAppliedMigrations();
    return applied.length > 0 ? applied[applied.length - 1].version : null;
  }

  /**
   * Migrates forward up to the specified target version.
   */
  public migrateTo(targetVersion: string): AppliedMigration[] {
    this.ensureMigrationsTable();
    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));
    const targetIndex = this.migrations.findIndex((m) => m.version === targetVersion);
    if (targetIndex === -1) {
      throw new Error(`Target migration version ${targetVersion} not found in registered migrations.`);
    }

    const newlyApplied: AppliedMigration[] = [];
    for (let i = 0; i <= targetIndex; i++) {
      const migration = this.migrations[i];
      if (!appliedVersions.has(migration.version)) {
        const applyTx = this.db.transaction(() => {
          this.db.exec(migration.upSql);
          this.db
            .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
            .run(migration.version, migration.name, new Date().toISOString());
        });
        applyTx();
        newlyApplied.push({
          version: migration.version,
          name: migration.name,
          applied_at: new Date().toISOString(),
        });
      }
    }

    return newlyApplied;
  }

  /**
   * Rolls back migrations until the specified target version is the active version.
   */
  public rollbackTo(targetVersion: string): AppliedMigration[] {
    this.ensureMigrationsTable();
    const rolledBack: AppliedMigration[] = [];

    while (true) {
      const current = this.getCurrentVersion();
      if (!current || current === targetVersion) {
        break;
      }

      const applied = this.getAppliedMigrations();
      const last = applied[applied.length - 1];
      const def = this.migrations.find((m) => m.version === last.version);
      if (!def || !def.downSql) {
        throw new Error(`Cannot rollback migration ${last.version}: downSql not defined.`);
      }

      const rollbackTx = this.db.transaction(() => {
        this.db.exec(def.downSql!);
        this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(last.version);
      });
      rollbackTx();
      rolledBack.push(last);
    }

    return rolledBack;
  }

  /**
   * Rolls back the latest applied migration.
   */
  public rollbackLastMigration(): { rolledBackVersion?: string } {
    this.ensureMigrationsTable();
    const applied = this.getAppliedMigrations();
    if (applied.length === 0) {
      return {};
    }

    const last = applied[applied.length - 1];
    const def = this.migrations.find((m) => m.version === last.version);
    if (!def || !def.downSql) {
      throw new Error(`Cannot rollback migration ${last.version}: downSql not defined.`);
    }

    const rollbackTx = this.db.transaction(() => {
      this.db.exec(def.downSql!);
      this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(last.version);
    });

    rollbackTx();
    return { rolledBackVersion: last.version };
  }
}
