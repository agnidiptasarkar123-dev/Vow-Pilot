import crypto from 'node:crypto';
import type { Vendor, VendorQuote } from '../../src/types';
import { EmailDeliveryRequest, EmailDeliveryRecord, User } from '../types';
import { EmailProvider, createEmailProviderFromEnv, TestEmailProvider } from './providers';
import { generateVendorClarificationTemplate } from './templates';
import { EventStore } from '../events';
import { DatabaseContext, getDatabaseContext } from '../db';

export class EmailDispatchService {
  private provider: EmailProvider;
  private dbContext: DatabaseContext;

  // Multi-dimensional server-side rate limits (persisted in database)
  private maxPerUserPerWindow = 10;
  private maxPerEventPerWindow = 25;
  private maxPerRecipientPerWindow = 3;
  private windowMs = 10 * 60 * 1000; // 10 minutes

  constructor(provider?: EmailProvider, dbContext?: DatabaseContext) {
    this.provider = provider || createEmailProviderFromEnv();
    this.dbContext = dbContext || getDatabaseContext();
  }

  public setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  public getProvider(): EmailProvider {
    return this.provider;
  }

  public getDbContext(): DatabaseContext {
    return this.dbContext;
  }

  public async verifyProviderConnection(): Promise<{ ok: boolean; provider: string; error?: string }> {
    if (this.provider.verifyConnection) {
      const res = await this.provider.verifyConnection();
      return { ok: res.ok, provider: this.provider.name, error: res.error };
    }
    return { ok: true, provider: this.provider.name };
  }

  public getAuditLog(user?: User, eventStore?: EventStore, eventId?: string): EmailDeliveryRecord[] {
    if (user && eventStore) {
      if (eventId) {
        eventStore.getEvent(eventId, user); // Throws 403/Unauthorized if user does not belong to event
        return this.dbContext.emailAudit.getAuditLog(eventId);
      }
      const userEventIds = new Set(eventStore.listUserEvents(user).map((e) => e.id));
      return this.dbContext.emailAudit.getAuditLog(undefined, userEventIds);
    }

    if (eventId) {
      return this.dbContext.emailAudit.getAuditLog(eventId);
    }
    return this.dbContext.emailAudit.getAuditLog();
  }

  /**
   * Dispatches a vendor clarification email with strict security validation:
   * - RFC 5322 address checking
   * - CRLF header injection rejection
   * - Length boundaries
   * - Event membership authorization
   * - Privilege escalation guard (Viewer prohibited)
   * - Multi-dimension database-backed rate limiting (User, Event, Recipient)
   * - Idempotency deduplication
   * - Data leakage prevention (Only relevant event & quote details included)
   * - Multi-part text and HTML delivery with bounded retries
   */
  public async dispatchVendorEmail(
    request: EmailDeliveryRequest,
    user: User,
    eventStore: EventStore
  ): Promise<EmailDeliveryRecord> {
    // 1. Database-backed Idempotency Check
    if (request.idempotencyKey) {
      const cached = this.dbContext.emailAudit.getRecordByIdempotencyKey(request.idempotencyKey);
      if (cached) {
        // If already accepted or delivered, return without duplicate dispatch
        if (cached.status === 'accepted_by_provider' || cached.status === 'delivered') {
          return cached;
        }
      }
    }

    // 2. Validate Event Authorization & Membership
    const event = eventStore.getEvent(request.eventId, user);
    const memberRole = eventStore.getUserRole(request.eventId, user.id);
    if (memberRole === 'viewer') {
      throw new Error('Forbidden: Viewers are not permitted to dispatch vendor emails.');
    }

    // 3. Validate Vendor Existence within Event Tenant
    const vendor = event.state.vendors.find((v: Vendor) => v.id === request.vendorId);
    if (!vendor) {
      throw new Error(`Vendor with ID "${request.vendorId}" does not belong to event "${request.eventId}".`);
    }

    // 4. Security: CRLF Injection, Address Syntax & Boundaries
    this.validateEmailSecurity(request);

    // 5. Multi-Dimensional Rate Limiting
    this.checkRateLimits(user.name, request.eventId, request.recipientEmail);

    // 6. Build Privacy-Preserving Content (Event logistics & quote context only)
    // Never leaks overall budgets, unrelated vendor contracts, or guest lists
    const activeQuote = event.state.quotes.find((q: VendorQuote) => q.vendorId === vendor.id);
    const { html, text } = generateVendorClarificationTemplate(request.bodyText, {
      eventName: event.state.event.name,
      eventDate: event.state.event.date,
      guestCount: event.state.event.guestCount,
      recipientName: request.recipientName || vendor.name,
      coordinatorName: user.name,
      coordinatorEmail: user.email,
      quoteReference: activeQuote ? `Quote #${activeQuote.id.slice(0, 8)} (${vendor.name})` : undefined,
      quotedAmount: activeQuote ? activeQuote.quotedAmount : undefined,
      currency: activeQuote ? activeQuote.currency : event.state.event.currency,
    });

    const fullRequest: EmailDeliveryRequest = {
      ...request,
      bodyText: text,
      htmlBody: html,
      replyTo: request.replyTo || user.email,
    };

    // 7. Dispatch via Configured Provider with Bounded Retries
    const recordId = `eml_${crypto.randomBytes(10).toString('hex')}`;
    const now = new Date().toISOString();

    const providerResult = await this.provider.sendEmail(fullRequest, { maxRetries: 3 });

    const record: EmailDeliveryRecord = {
      id: recordId,
      eventId: request.eventId,
      vendorId: request.vendorId,
      recipientEmail: request.recipientEmail.trim().toLowerCase(),
      subject: request.subject.trim(),
      status: providerResult.status,
      provider: this.provider.name,
      providerMessageId: providerResult.providerMessageId,
      previewUrl: providerResult.previewUrl,
      dispatchedAt: now,
      dispatchedBy: user.name,
      idempotencyKey: request.idempotencyKey,
      attempts: providerResult.attempts || 1,
      replyTo: fullRequest.replyTo,
      htmlBody: html,
      error: providerResult.error,
    };

    // 8. Persist Record to Durable Database
    this.dbContext.emailAudit.recordEmail(record);

    return record;
  }

  /**
   * Strict validation preventing CRLF header injection and malformed addresses.
   */
  public validateEmailSecurity(request: EmailDeliveryRequest): void {
    const { recipientEmail, subject, bodyText, replyTo } = request;

    // Check for CRLF injection in headers
    if (/[\r\n]/.test(recipientEmail)) {
      throw new Error('Security violation: Header injection detected in recipient email.');
    }
    if (/[\r\n]/.test(subject)) {
      throw new Error('Security violation: Header injection detected in email subject.');
    }
    if (replyTo && /[\r\n]/.test(replyTo)) {
      throw new Error('Security violation: Header injection detected in reply-to header.');
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
    if (replyTo && !emailRegex.test(replyTo.trim())) {
      throw new Error('Invalid reply-to email address format.');
    }

    // Length boundaries
    if (subject.trim().length === 0 || subject.trim().length > 120) {
      throw new Error('Subject must be between 1 and 120 characters.');
    }
    if (bodyText.trim().length === 0 || bodyText.trim().length > 10000) {
      throw new Error('Body must be between 1 and 10,000 characters.');
    }
  }

  /**
   * Multi-dimensional rate limit enforcement backed by persistent database storage.
   */
  private checkRateLimits(userName: string, eventId: string, recipientEmail: string): void {
    const windowStartIso = new Date(Date.now() - this.windowMs).toISOString();

    // 1. User Rate Limit
    const userCount = this.dbContext.emailAudit.getUserRateLimitCount(userName, windowStartIso);
    if (userCount >= this.maxPerUserPerWindow) {
      throw new Error('Rate limit exceeded: Maximum 10 vendor emails allowed per 10-minute window per user.');
    }

    // 2. Event Tenant Rate Limit
    const eventCount = this.dbContext.emailAudit.getEventRateLimitCount(eventId, windowStartIso);
    if (eventCount >= this.maxPerEventPerWindow) {
      throw new Error('Rate limit exceeded: Maximum 25 vendor emails allowed per 10-minute window for this celebration.');
    }

    // 3. Recipient Destination Rate Limit (Anti-harassment)
    const recipientCount = this.dbContext.emailAudit.getRecipientRateLimitCount(recipientEmail, windowStartIso);
    if (recipientCount >= this.maxPerRecipientPerWindow) {
      throw new Error(`Rate limit exceeded: Maximum ${this.maxPerRecipientPerWindow} emails allowed per 10-minute window to ${recipientEmail}.`);
    }
  }

  public clear(): void {
    this.dbContext.emailAudit.clearAll();
    if (this.provider instanceof TestEmailProvider) {
      this.provider.clear();
    }
  }
}

export const globalEmailService = new EmailDispatchService();
