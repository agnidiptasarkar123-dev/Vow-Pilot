import crypto from 'node:crypto';
import type { Vendor } from '../../src/types';
import { EmailDeliveryRequest, EmailDeliveryRecord, User } from '../types';
import { EmailProvider, TestEmailProvider } from './providers';
import { EventStore } from '../events';

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class EmailDispatchService {
  private provider: EmailProvider;
  private auditLog: EmailDeliveryRecord[] = [];
  private idempotencyCache: Map<string, EmailDeliveryRecord> = new Map();
  private userRateLimits: Map<string, RateLimitEntry> = new Map();
  private maxPerUserPerWindow = 10;
  private windowMs = 10 * 60 * 1000; // 10 minutes

  constructor(provider?: EmailProvider) {
    this.provider = provider || new TestEmailProvider();
  }

  public setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  public getProvider(): EmailProvider {
    return this.provider;
  }

  public getAuditLog(eventId?: string): EmailDeliveryRecord[] {
    if (eventId) {
      return this.auditLog.filter((l) => l.eventId === eventId);
    }
    return [...this.auditLog];
  }

  /**
   * Dispatches a vendor clarification email with strict security validation:
   * - RFC 5322 address checking
   * - CRLF header injection rejection
   * - Length boundaries
   * - Event membership authorization
   * - Idempotency deduplication
   * - Rate limiting
   */
  public async dispatchVendorEmail(
    request: EmailDeliveryRequest,
    user: User,
    eventStore: EventStore
  ): Promise<EmailDeliveryRecord> {
    // 1. Idempotency Check
    if (request.idempotencyKey) {
      const cached = this.idempotencyCache.get(request.idempotencyKey);
      if (cached) {
        return cached;
      }
    }

    // 2. Validate Event Authorization & Vendor Existence
    const event = eventStore.getEvent(request.eventId, user);
    const memberRole = eventStore.getUserRole(request.eventId, user.id);
    if (memberRole === 'viewer') {
      throw new Error('Forbidden: Viewers are not permitted to dispatch vendor emails.');
    }

    const vendor = event.state.vendors.find((v: Vendor) => v.id === request.vendorId);
    if (!vendor) {
      throw new Error(`Vendor with ID "${request.vendorId}" does not belong to event "${request.eventId}".`);
    }

    // 3. Security: Header Injection & Email Validation
    this.validateEmailSecurity(request);

    // 4. Rate Limiting Check
    this.checkRateLimit(user.id);

    // 5. Send via Configured Provider
    const recordId = `eml_${crypto.randomBytes(10).toString('hex')}`;
    const now = new Date().toISOString();

    const providerResult = await this.provider.sendEmail(request);

    const record: EmailDeliveryRecord = {
      id: recordId,
      eventId: request.eventId,
      vendorId: request.vendorId,
      recipientEmail: request.recipientEmail.trim().toLowerCase(),
      subject: request.subject.trim(),
      status: providerResult.status,
      provider: this.provider.name,
      providerMessageId: providerResult.providerMessageId,
      dispatchedAt: now,
      dispatchedBy: user.name,
      idempotencyKey: request.idempotencyKey,
      error: providerResult.error,
    };

    this.auditLog.push(record);

    if (request.idempotencyKey) {
      this.idempotencyCache.set(request.idempotencyKey, record);
    }

    return record;
  }

  /**
   * Strict validation preventing CRLF header injection and malformed addresses.
   */
  public validateEmailSecurity(request: EmailDeliveryRequest): void {
    const { recipientEmail, subject, bodyText } = request;

    // Check for CRLF injection in headers
    if (/[\r\n]/.test(recipientEmail)) {
      throw new Error('Security violation: Header injection detected in recipient email.');
    }
    if (/[\r\n]/.test(subject)) {
      throw new Error('Security violation: Header injection detected in email subject.');
    }

    // Check for null bytes
    if (/\0/.test(recipientEmail) || /\0/.test(subject) || /\0/.test(bodyText)) {
      throw new Error('Security violation: Null byte detected in message content.');
    }

    // Email format RFC 5322 standard
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      throw new Error('Invalid email address format.');
    }

    // Length boundaries
    if (subject.trim().length === 0 || subject.trim().length > 120) {
      throw new Error('Subject must be between 1 and 120 characters.');
    }
    if (bodyText.trim().length === 0 || bodyText.trim().length > 10000) {
      throw new Error('Body must be between 1 and 10,000 characters.');
    }
  }

  private checkRateLimit(userId: string): void {
    const now = Date.now();
    let entry = this.userRateLimits.get(userId);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + this.windowMs };
      this.userRateLimits.set(userId, entry);
      return;
    }

    if (entry.count >= this.maxPerUserPerWindow) {
      throw new Error('Rate limit exceeded: Maximum 10 vendor emails allowed per 10-minute window.');
    }

    entry.count += 1;
  }

  public clear(): void {
    this.auditLog = [];
    this.idempotencyCache.clear();
    this.userRateLimits.clear();
    if (this.provider instanceof TestEmailProvider) {
      this.provider.clear();
    }
  }
}

export const globalEmailService = new EmailDispatchService();
