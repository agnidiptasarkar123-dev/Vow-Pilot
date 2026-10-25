import { UserRole } from '../types';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface EventRow {
  id: string;
  owner_id: string;
  version: number;
  name: string;
  event_date: string | null;
  target_budget_minor: number;
  currency: string;
  state_json: string;
  created_at: string;
  updated_at: string;
  last_modified_by: string;
}

export interface EventMemberRow {
  event_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: UserRole;
  joined_at: string;
}

export interface EventInvitationRow {
  token_hash: string;
  event_id: string;
  role: UserRole;
  created_by: string;
  created_at: string;
  expires_at: string;
  used: number; // 0 or 1
  used_by: string | null;
  revoked: number; // 0 or 1
}

export interface EmailAuditRow {
  id: string;
  event_id: string;
  vendor_id: string;
  recipient_email: string;
  subject: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  dispatched_at: string;
  dispatched_by: string;
  idempotency_key: string | null;
  attempts: number;
  reply_to: string | null;
  preview_url: string | null;
  html_body: string | null;
  error: string | null;
}

export interface FailedLoginRow {
  identifier: string;
  count: number;
  first_attempt: number;
  locked_until: number | null;
}

export interface EventActivityRow {
  id: string;
  event_id: string;
  user_id: string;
  user_name: string;
  action: string;
  version: number;
  details_json: string | null;
  created_at: string;
}

export interface EventExpenseRow {
  id: string;
  event_id: string;
  category_id: string;
  name: string;
  estimated_cost_minor: number;
  actual_cost_minor: number;
  paid_amount_minor: number;
  status: string;
  vendor_id: string | null;
  due_date: string | null;
  notes: string | null;
  updated_at: string;
}

export interface DatabaseHealthStatus {
  healthy: boolean;
  databasePath: string;
  journalMode: string;
  foreignKeysEnabled: boolean;
  migrationsCount: number;
  error?: string;
}
