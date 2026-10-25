import { VowPilotDatabase, DatabaseOptions } from './connection';
import { Migrator, MIGRATIONS } from './migrator';
import { UserRepository } from './repositories/userRepository';
import { SessionRepository } from './repositories/sessionRepository';
import { EventRepository } from './repositories/eventRepository';
import { InvitationRepository } from './repositories/invitationRepository';
import { EmailAuditRepository } from './repositories/emailAuditRepository';
import { ActivityRepository } from './repositories/activityRepository';

export * from './connection';
export * from './migrator';
export * from './types';
export * from './repositories/userRepository';
export * from './repositories/sessionRepository';
export * from './repositories/eventRepository';
export * from './repositories/invitationRepository';
export * from './repositories/emailAuditRepository';
export * from './repositories/activityRepository';

export class DatabaseContext {
  public db: VowPilotDatabase;
  public migrator: Migrator;
  public users: UserRepository;
  public sessions: SessionRepository;
  public events: EventRepository;
  public invitations: InvitationRepository;
  public emailAudit: EmailAuditRepository;
  public activity: ActivityRepository;

  constructor(options: DatabaseOptions = {}) {
    this.db = new VowPilotDatabase(options);
    this.migrator = new Migrator(this.db, MIGRATIONS);
    this.users = new UserRepository(this.db);
    this.sessions = new SessionRepository(this.db);
    this.events = new EventRepository(this.db);
    this.invitations = new InvitationRepository(this.db);
    this.emailAudit = new EmailAuditRepository(this.db);
    this.activity = new ActivityRepository(this.db);

    // Automatically apply versioned migrations on initialization
    this.migrator.migrateToLatest();
  }

  public close(): void {
    this.db.close();
  }

  public clearAll(): void {
    this.activity.clearAll();
    this.emailAudit.clearAll();
    this.invitations.clearAll();
    this.events.clearAll();
    this.sessions.clearAll();
    this.users.clearAll();
  }
}

// Global default persistent database context for production
let defaultDbContext: DatabaseContext | null = null;
let activeTestDbContext: DatabaseContext | null = null;

export function getDatabaseContext(options?: DatabaseOptions): DatabaseContext {
  if (options) {
    return new DatabaseContext(options);
  }
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    if (!activeTestDbContext) {
      activeTestDbContext = new DatabaseContext({ filename: ':memory:' });
    }
    return activeTestDbContext;
  }
  if (!defaultDbContext) {
    defaultDbContext = new DatabaseContext();
  }
  return defaultDbContext;
}

export function createTestDatabaseContext(): DatabaseContext {
  activeTestDbContext = new DatabaseContext({ filename: ':memory:' });
  return activeTestDbContext;
}
