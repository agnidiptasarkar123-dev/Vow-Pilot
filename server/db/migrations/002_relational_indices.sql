-- =============================================================================
-- Migration 002: Relational Financial Tables & Performance Indexes
-- Stores normalized budget expenses in integer minor units (cents/paise),
-- event tasks, event vendors, and comprehensive query indexes.
-- =============================================================================

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

-- Core Query Indexes
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
