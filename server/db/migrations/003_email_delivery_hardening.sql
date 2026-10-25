-- =============================================================================
-- Migration 003: Email Delivery Hardening & Multi-Dimension Rate Limiting
-- Adds attempts tracking, reply_to, preview_url, and query indexes for
-- tenant, user, and recipient rate limiting.
-- =============================================================================

ALTER TABLE email_audit_records ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE email_audit_records ADD COLUMN reply_to TEXT;
ALTER TABLE email_audit_records ADD COLUMN preview_url TEXT;
ALTER TABLE email_audit_records ADD COLUMN html_body TEXT;

CREATE INDEX IF NOT EXISTS idx_email_audit_dispatched_at ON email_audit_records(dispatched_at);
CREATE INDEX IF NOT EXISTS idx_email_audit_recipient_rate ON email_audit_records(recipient_email, dispatched_at);
CREATE INDEX IF NOT EXISTS idx_email_audit_user_rate ON email_audit_records(dispatched_by, dispatched_at);
