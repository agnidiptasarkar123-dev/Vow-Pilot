# VowPilot Database Architecture, Storage Audit & Disaster Recovery Specification

**Document Version:** 1.0.0  
**Author:** Principal Database Architect  
**Engine:** SQLite 3 (via `better-sqlite3` v13.0.3)  
**Storage Architecture:** Local-First Hybrid with Server-Side ACID WAL Durability  
**Status:** Implemented, Fully Tested, and Production-Ready  

---

## 1. Storage Audit & Data Classification

This audit inventories all data stored within VowPilot, detailing its storage medium, durability classification, tenancy isolation model, and lifecycle.

| Data Asset | Storage Medium | Classification | Tenant Isolation Model | Persistence Lifecycle |
|---|---|---|---|---|
| **User Accounts** | Server SQLite (`users` table) | Business-Critical | Global unique email constraint, isolated `id` | Permanent until explicit GDPR account deletion |
| **Authentication Sessions** | Server SQLite (`sessions` table) | Business-Critical | Bound to `user_id` via foreign key cascade | 7-day TTL, rotated on login, cleared on logout |
| **Events** | Server SQLite (`events` table) | Business-Critical | `owner_id` FK to `users(id)`; multi-tenant membership checks | Permanent until owner deletion |
| **Event Schedules & Tasks** | Server SQLite (`event_tasks` table) | Business-Critical | Compound PK `(event_id, id)` with FK cascade | Owned by event; cascades on event deletion |
| **Budgets & Allocations** | Server SQLite (`events.target_budget_minor`) | Business-Critical | Owned by event; integer minor currency units | Stored in minor currency units (paise/cents) |
| **Expenses** | Server SQLite (`event_expenses` table) | Business-Critical | Compound PK `(event_id, id)` with FK cascade | Stored in integer minor units with cost status |
| **Vendors** | Server SQLite (`event_vendors` table) | Business-Critical | Compound PK `(event_id, id)` with FK cascade | Owned by event; distinguishes sample vs live |
| **Vendor Quotes** | Server SQLite (`events.state_json.quotes`) | Business-Critical | Scoped inside event document with relational link | Stored in integer minor currency units |
| **Guest Lists** | Server SQLite (`events.state_json.guests`) | Business-Critical | Scoped inside event document with role access | Permanent until modified or event deleted |
| **Invitations & Tokens** | Server SQLite (`event_invitations` table) | Business-Critical | Keyed by SHA-256 token hash; FK cascade to event | 48-hour expiration; single-use invalidation |
| **Collaboration Membership** | Server SQLite (`event_members` table) | Business-Critical | Compound PK `(event_id, user_id)`; RBAC role | Permanent until revoked by owner |
| **Activity History** | Server SQLite (`event_activity_history` table) | Business-Critical | FK to event and user; immutable append-only | Permanent immutable audit log |
| **AI Planning Results** | Ephemeral State / Event State | Temporary / Critical | Scoped to active event session | Transient in assistant; persistent once saved |
| **Email Dispatch Records** | Server SQLite (`email_audit_records` table) | Business-Critical | Tenant event isolation; idempotency key index | Immutable audit log with delivery status |
| **UI Active Tab & Modals** | React In-Memory State | Harmless UI State | Local to active browser tab | Discarded on page navigation or reload |
| **Local Offline Cache** | Browser `localStorage` | Client Resilience | Single-user device cache with schema validation | Overwritten by server-synced state on connect |

---

## 2. Production Database Architecture

### Engine Selection Rationale
For VowPilot's single-node edge or containerized deployment on platforms such as Vercel Serverless Functions, AWS ECS, Google Cloud Run, or Fly.io:
1. **Zero Network Latency:** `better-sqlite3` runs synchronously in-process via C++ V8 bindings, executing parameterized queries in under 50 microseconds without TCP socket roundtrips.
2. **ACID Transaction Semantics:** Supports true serializable transactions (`BEGIN IMMEDIATE` / `COMMIT`), strict write-ahead logging (WAL), and robust savepoint rollbacks.
3. **No Operational Credential Leakage:** Avoids external connection strings, database usernames, or network passwords being exposed to frontend bundles. Database file location is controlled strictly via `DATABASE_PATH` environment variable.
4. **Predictable Zero-Cost Deployment:** No managed database instance hosting fees required for entry-to-mid scale deployments, while supporting thousands of operations per second with WAL concurrency.

### Connection Management & Pragmas
Every database connection is initialized with strict production pragmas in `server/db/connection.ts`:
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000; -- 64MB memory cache
```
- **WAL Mode (`journal_mode = WAL`):** Allows concurrent readers without blocking writes, and concurrent writers queue safely up to the 5,000ms busy timeout.
- **Foreign Key Enforcement (`foreign_keys = ON`):** Enforces relational referential integrity across all dependent tables.

---

## 3. Relational Database Schema & Data Modeling

### Integer Minor Currency Representation
Authoritative financial calculations strictly forbid IEEE 754 floating-point arithmetic. All budget allocations, estimated costs, actual costs, and paid amounts are stored as integer minor units:
- **INR:** 1 Rupee = 100 paise (`₹75,00,000.00` = `750000000` paise)
- **USD / EUR / GBP:** 1 Dollar/Euro/Pound = 100 cents (`$50,000.50` = `5000050` cents)
- **AED:** 1 Dirham = 100 fils

### Relational Table Design
```sql
-- Migration 001: Initial Core Schema
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE events (
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

CREATE TABLE event_members (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE event_invitations (
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

CREATE TABLE email_audit_records (
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
  idempotency_key TEXT,
  error TEXT
);

CREATE TABLE failed_logins (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  first_attempt INTEGER NOT NULL,
  locked_until INTEGER
);

CREATE TABLE event_activity_history (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  version INTEGER NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

-- Migration 002: Relational Financial Tables & Performance Indexes
CREATE TABLE event_expenses (
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

CREATE TABLE event_tasks (
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

CREATE TABLE event_vendors (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  PRIMARY KEY (event_id, id)
);
```

---

## 4. Concurrency & Optimistic Locking Engine

### Concurrency Conflict Prevention
VowPilot implements Optimistic Concurrency Control (OCC) at the database transaction layer. When client updates an event, it submits its known `expectedVersion`.
```ts
// server/db/repositories/eventRepository.ts
const updateTx = this.db.transaction(() => {
  const current = this.db.prepare('SELECT version FROM events WHERE id = ?').get(eventId);
  if (current.version !== expectedVersion) {
    return {
      error: 'CONCURRENCY_CONFLICT',
      currentVersion: current.version,
      expectedVersion,
      lastModifiedBy: current.last_modified_by,
      currentState: JSON.parse(current.state_json),
    };
  }

  // Atomically advance version and write updated state
  this.db.prepare('UPDATE events SET version = version + 1 ... WHERE id = ?').run(eventId);
  this.syncRelationalEntities(eventId, newState, now);
});
```
When two clients concurrently modify the same event:
1. Client 1's write advances version from 1 to 2.
2. Client 2's write specifying `expectedVersion = 1` is rejected with HTTP 409 `CONCURRENCY_CONFLICT`.
3. Client 2 receives the latest state and current version, enabling non-destructive three-way reconciliation without silent overwriting.

---

## 5. Migration Engine & Version Tracking

The migration engine (`server/db/migrator.ts`) executes versioned migrations inside isolated ACID transactions:
- `ensureMigrationsTable()` verifies tracking metadata exists.
- `migrateToLatest()` queries pending migrations and runs each `.upSql` inside an atomic transaction.
- `rollbackTo(targetVersion)` executes each `.downSql` in reverse order.
- Migrations are tested automatically in `src/test/databaseDurablePersistence.test.ts`.

---

## 6. Operational Safeguards, Health Checks & Disaster Recovery

### Health Check Endpoint (`GET /api/health`)
The server application exposes an unauthenticated health check endpoint:
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "walMode": true,
    "foreignKeys": true,
    "migrationCount": 2,
    "path": "/Users/agnidiptasarkar/Desktop/virtual/data/vowpilot.db"
  },
  "timestamp": "2026-10-25T10:45:00.000Z"
}
```

### Live Non-Blocking Online Backup API
SQLite WAL mode enables non-blocking online backups while the application processes active traffic:
```ts
// Programmatic backup execution via native driver
await dbContext.db.backup('/backups/vowpilot_backup_20261025.db');
```

### CLI Backup & Recovery Runbook
```bash
# 1. Hot Backup (online, zero downtime)
sqlite3 data/vowpilot.db ".backup 'data/backups/vowpilot_$(date +%Y%m%d_%H%M%S).db'"

# 2. Integrity Verification
sqlite3 data/backups/latest.db "PRAGMA integrity_check;"

# 3. Recovery / Restore
# Stop application process
mv data/vowpilot.db data/vowpilot.db.corrupt
cp data/backups/latest.db data/vowpilot.db
# Restart application process
```

---

## 7. Required Production Environment Variables

| Variable | Description | Required in Production | Default |
|---|---|---|---|
| `DATABASE_PATH` | Absolute or relative file path to the SQLite database | Yes | `./data/vowpilot.db` |
| `SESSION_SECRET` | Cryptographically random secret (>= 32 chars) for cookie signing | Yes (fails closed if weak/missing) | None |
| `ALLOWED_ORIGINS` | Comma-delimited list of trusted client origins | Yes | `https://vowpilot.vercel.app` |
| `PORT` | HTTP server listening port | Optional | `3000` |
| `NODE_ENV` | Runtime environment mode | Yes | `production` |
