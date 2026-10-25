import type { AppState } from '../src/types';
export type { AppState };

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface EventMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  joinedAt: string;
}

export interface InviteToken {
  token: string;
  eventId: string;
  role: UserRole;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedBy?: string;
}

export interface ServerEventRecord {
  id: string;
  ownerId: string;
  version: number;
  state: AppState;
  members: EventMember[];
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
}

export interface ConcurrencyConflict {
  error: 'CONCURRENCY_CONFLICT';
  message: string;
  expectedVersion: number;
  currentVersion: number;
  lastModifiedBy: string;
  currentState: AppState;
}

export type EmailDeliveryStatus =
  | 'draft'
  | 'queued'
  | 'accepted_by_provider'
  | 'delivery_confirmed'
  | 'failed'
  | 'rejected';

export interface EmailDeliveryRecord {
  id: string;
  eventId: string;
  vendorId: string;
  recipientEmail: string;
  subject: string;
  status: EmailDeliveryStatus;
  provider: string;
  providerMessageId?: string;
  dispatchedAt: string;
  dispatchedBy: string;
  idempotencyKey?: string;
  error?: string;
}

export interface EmailDeliveryRequest {
  eventId: string;
  vendorId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyText: string;
  idempotencyKey?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  status: EmailDeliveryStatus;
  providerMessageId?: string;
  error?: string;
}
