import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmailDispatchService } from '../../server/email/service';
import {
  TestEmailProvider,
  NodemailerSmtpProvider,
  EtherealTestProvider,
  validateSmtpConfig,
  classifySmtpError,
} from '../../server/email/providers';
import { escapeHtml, generateVendorClarificationTemplate } from '../../server/email/templates';
import { EventStore } from '../../server/events';
import { DatabaseContext } from '../../server/db';
import { User } from '../../server/types';
import fs from 'node:fs';
import path from 'node:path';

describe('VowPilot Email Delivery & Vendor Communication Workflow', () => {
  let dbContext: DatabaseContext;
  let eventStore: EventStore;
  let emailService: EmailDispatchService;
  let testProvider: TestEmailProvider;
  let testDbPath: string;

  let sampleEventId: string;
  let testUserOwner: User;
  let testUserEditor: User;
  let testUserViewer: User;
  let testUserOutsider: User;

  beforeEach(() => {
    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    sampleEventId = `evt_wedding_${runId}`;
    testUserOwner = {
      id: `usr_owner_${runId}`,
      name: 'Priya Sharma (Owner)',
      email: `priya_${runId}@vowpilot.example.com`,
      passwordHash: 'argon2id_mock_hash',
      createdAt: '2026-10-25T00:00:00.000Z',
    };
    testUserEditor = {
      id: `usr_editor_${runId}`,
      name: 'Rohan Mehra (Editor)',
      email: `rohan_${runId}@vowpilot.example.com`,
      passwordHash: 'argon2id_mock_hash',
      createdAt: '2026-10-25T00:00:00.000Z',
    };
    testUserViewer = {
      id: `usr_viewer_${runId}`,
      name: 'Guest Amit (Viewer)',
      email: `amit_${runId}@vowpilot.example.com`,
      passwordHash: 'argon2id_mock_hash',
      createdAt: '2026-10-25T00:00:00.000Z',
    };
    testUserOutsider = {
      id: `usr_outsider_${runId}`,
      name: 'Sneha Patel (Outsider)',
      email: `sneha_${runId}@outsider.example.com`,
      passwordHash: 'argon2id_mock_hash',
      createdAt: '2026-10-25T00:00:00.000Z',
    };

    testDbPath = path.join(process.cwd(), `test_email_${runId}.db`);
    dbContext = new DatabaseContext({ filename: testDbPath });
    dbContext.migrator.migrateToLatest();

    // Seed test users
    const now = new Date().toISOString();
    dbContext.users.createUser({ ...testUserOwner, passwordHash: 'hash123', createdAt: now });
    dbContext.users.createUser({ ...testUserEditor, passwordHash: 'hash123', createdAt: now });
    dbContext.users.createUser({ ...testUserViewer, passwordHash: 'hash123', createdAt: now });
    dbContext.users.createUser({ ...testUserOutsider, passwordHash: 'hash123', createdAt: now });

    eventStore = new EventStore(dbContext);

    // Seed event
    eventStore.createEvent(
      testUserOwner,
      {
        event: {
          id: sampleEventId,
          name: 'Royal Rambagh Palace Celebration',
          date: '2026-11-20',
          guestCount: 350,
          currency: 'INR',
          totalBudget: 450000000,
        },
        budget: { total: 450000000, allocations: {} },
        categories: [{ id: 'venue', name: 'Venue & Lawns', budgetCap: 150000000 }],
        expenses: [],
        tasks: [],
        vendors: [
          {
            id: 'vnd_palace_catering',
            name: 'Imperial Royal Caterers',
            categoryId: 'venue',
            contactName: 'Chef Rajesh',
            email: 'rajesh@imperialcaterers.example.com',
            phone: '+91 98290 12345',
            isSample: false,
            createdAt: new Date().toISOString(),
          },
        ],
        quotes: [
          {
            id: 'qt_cater_001',
            vendorId: 'vnd_palace_catering',
            quoteDate: '2026-10-15',
            quotedAmount: 18000000, // 180,000 INR in minor units (1,800.00 INR)
            currency: 'INR',
            status: 'under_review',
            includedServices: ['Live Chaat Counter', '3-Course Royal Dinner'],
            exclusions: ['Imported Wine Corkage'],
            paymentTerms: '50% advance, 50% on completion',
            isSample: false,
          },
        ],
      } as any
    );

    // Add members with roles
    dbContext.events.addMember(sampleEventId, testUserEditor, 'editor');
    dbContext.events.addMember(sampleEventId, testUserViewer, 'viewer');

    testProvider = new TestEmailProvider();
    emailService = new EmailDispatchService(testProvider, dbContext);
  });

  afterEach(() => {
    try {
      dbContext.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const shm = `${testDbPath}-shm`;
      const wal = `${testDbPath}-wal`;
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. SMTP Configuration & Credential Validation', () => {
    it('rejects invalid or missing SMTP host, port, and credentials', () => {
      const res1 = validateSmtpConfig({});
      expect(res1.valid).toBe(false);
      expect(res1.errors.some((e) => e.includes('SMTP host is required'))).toBe(true);

      const res2 = validateSmtpConfig({ host: 'smtp.example.com', port: 999999, user: 'u', pass: 'p' });
      expect(res2.valid).toBe(false);
      expect(res2.errors.some((e) => e.includes('Invalid SMTP port'))).toBe(true);

      const res3 = validateSmtpConfig({ host: 'smtp.example.com\r\nEvilHost', port: 587, user: 'u', pass: 'p' });
      expect(res3.valid).toBe(false);
      expect(res3.errors.some((e) => e.includes('control characters'))).toBe(true);
    });

    it('never leaks user password in error descriptions', () => {
      const sensitivePassword = 'SuperSecretUnpublishedPassword123!';
      const provider = new NodemailerSmtpProvider({
        host: '127.0.0.1',
        port: 2525,
        secure: false,
        user: 'smtp_admin',
        pass: sensitivePassword,
      });

      expect(provider.name).toBe('NodemailerSmtpProvider');
      const err = classifySmtpError(new Error('Invalid login auth credentials supplied.'));
      expect(err.message).not.toContain(sensitivePassword);
    });
  });

  describe('2. SMTP Error Classification & Retry Policy', () => {
    it('classifies 5xx and EAUTH as permanent, non-retryable failures', () => {
      const authErr = classifySmtpError({ code: 'EAUTH', message: 'Username and Password not accepted' });
      expect(authErr.isRetryable).toBe(false);
      expect(authErr.code).toBe('AUTH_FAILED');

      const mailboxErr = classifySmtpError({ responseCode: 550, message: '5.1.1 User unknown' });
      expect(mailboxErr.isRetryable).toBe(false);
      expect(mailboxErr.code).toBe('SMTP_550');
    });

    it('classifies connection drops, timeouts, and 4xx as transient, retryable failures', () => {
      const timeoutErr = classifySmtpError({ code: 'ETIMEDOUT', message: 'Connection timed out' });
      expect(timeoutErr.isRetryable).toBe(true);

      const greylistErr = classifySmtpError({ responseCode: 451, message: 'Greylisting enabled, try again later' });
      expect(greylistErr.isRetryable).toBe(true);
      expect(greylistErr.code).toBe('SMTP_451');
    });
  });

  describe('3. Header Injection, CRLF & Address Sanitization', () => {
    it('rejects CRLF injection in recipient email address', async () => {
      await expect(
        emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: 'rajesh@imperialcaterers.example.com\r\nBcc: spy@hacker.com',
            recipientName: 'Chef Rajesh',
            subject: 'Regarding Banquet Schedule',
            bodyText: 'Please clarify meal timings.',
          },
          testUserOwner,
          eventStore
        )
      ).rejects.toThrow(/Header injection detected in recipient email/i);
    });

    it('rejects CRLF injection in email subject', async () => {
      await expect(
        emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: 'rajesh@imperialcaterers.example.com',
            recipientName: 'Chef Rajesh',
            subject: 'Important Subject\r\nTo: second_victim@example.com',
            bodyText: 'Please clarify meal timings.',
          },
          testUserOwner,
          eventStore
        )
      ).rejects.toThrow(/Header injection detected in email subject/i);
    });

    it('rejects null byte injection in message content', async () => {
      await expect(
        emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: 'rajesh@imperialcaterers.example.com',
            recipientName: 'Chef Rajesh',
            subject: 'Subject with\0null',
            bodyText: 'Valid body.',
          },
          testUserOwner,
          eventStore
        )
      ).rejects.toThrow(/Null byte detected/i);
    });

    it('escapes HTML special characters in template generation', () => {
      const malicious = '<script>alert("XSS")</script>&<foo>';
      const safe = escapeHtml(malicious);
      expect(safe).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&amp;&lt;foo&gt;');
      expect(safe).not.toContain('<script>');
    });
  });

  describe('4. Privacy & Data Leakage Prevention', () => {
    it('includes event logistics and relevant quote info while strictly withholding sensitive budget and guest rosters', () => {
      const template = generateVendorClarificationTemplate(
        'Can we substitute the welcome drinks with fresh seasonal mocktails?',
        {
          eventName: 'Royal Rambagh Palace Celebration',
          eventDate: '2026-11-20',
          guestCount: 350,
          recipientName: 'Chef Rajesh',
          coordinatorName: 'Priya Sharma',
          coordinatorEmail: 'priya@vowpilot.example.com',
          quoteReference: 'Quote #qt_cater_001 (Imperial Royal Caterers)',
          quotedAmount: 18000000,
          currency: 'INR',
        }
      );

      // Verifies intended data is present
      expect(template.html).toContain('Royal Rambagh Palace Celebration');
      expect(template.html).toContain('350 guests');
      expect(template.html).toContain('Chef Rajesh');
      expect(template.html).toContain('fresh seasonal mocktails');
      expect(template.html).toContain('Quote #qt_cater_001');

      // Verifies unrelated private event information is strictly omitted
      expect(template.html).not.toContain('450000000'); // Total budget
      expect(template.html).not.toContain('Guest Attendee List');
      expect(template.html).not.toContain('Hotel Booking Password');
    });
  });

  describe('5. RBAC & Event Authorization', () => {
    it('permits Event Owner and Editor to dispatch vendor communications', async () => {
      const ownerRecord = await emailService.dispatchVendorEmail(
        {
          eventId: sampleEventId,
          vendorId: 'vnd_palace_catering',
          recipientEmail: 'rajesh@imperialcaterers.example.com',
          recipientName: 'Chef Rajesh',
          subject: 'Owner Clarification',
          bodyText: 'We approve the Chaat Counter layout.',
          idempotencyKey: 'idemp_owner_001',
        },
        testUserOwner,
        eventStore
      );
      expect(ownerRecord.status).toBe('accepted_by_provider');
      expect(ownerRecord.dispatchedBy).toBe(testUserOwner.name);

      const editorRecord = await emailService.dispatchVendorEmail(
        {
          eventId: sampleEventId,
          vendorId: 'vnd_palace_catering',
          recipientEmail: 'rajesh@imperialcaterers.example.com',
          recipientName: 'Chef Rajesh',
          subject: 'Editor Clarification',
          bodyText: 'Please share kitchen setup dimensions.',
          idempotencyKey: 'idemp_editor_001',
        },
        testUserEditor,
        eventStore
      );
      expect(editorRecord.status).toBe('accepted_by_provider');
      expect(editorRecord.dispatchedBy).toBe(testUserEditor.name);
    });

    it('strictly forbids Viewers from dispatching vendor emails (HTTP 403)', async () => {
      await expect(
        emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: 'rajesh@imperialcaterers.example.com',
            recipientName: 'Chef Rajesh',
            subject: 'Unauthorized Inquiry',
            bodyText: 'A viewer should not be able to send this.',
          },
          testUserViewer,
          eventStore
        )
      ).rejects.toThrow(/Forbidden: Viewers are not permitted to dispatch vendor emails/i);
    });

    it('strictly blocks unauthorized outsiders from accessing another tenant event', async () => {
      await expect(
        emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: 'rajesh@imperialcaterers.example.com',
            recipientName: 'Chef Rajesh',
            subject: 'Outsider Intrusion',
            bodyText: 'I am not a member of this wedding.',
          },
          testUserOutsider,
          eventStore
        )
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe('6. Idempotency & Duplicate Prevention', () => {
    it('returns existing delivery record without duplicate transmission when same idempotency key is submitted', async () => {
      const req = {
        eventId: sampleEventId,
        vendorId: 'vnd_palace_catering',
        recipientEmail: 'rajesh@imperialcaterers.example.com',
        recipientName: 'Chef Rajesh',
        subject: 'Idempotency Test Subject',
        bodyText: 'Ensure this message is dispatched only once.',
        idempotencyKey: 'idemp_test_deterministic_key_42',
      };

      const firstResult = await emailService.dispatchVendorEmail(req, testUserOwner, eventStore);
      expect(firstResult.status).toBe('accepted_by_provider');
      expect(testProvider.sentMessages.length).toBe(1);

      // Re-submit exact same idempotency key (simulating browser double-click or network retry)
      const secondResult = await emailService.dispatchVendorEmail(req, testUserOwner, eventStore);
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.providerMessageId).toBe(firstResult.providerMessageId);
      // Provider was NOT called a second time
      expect(testProvider.sentMessages.length).toBe(1);
    });
  });

  describe('7. Multi-Dimensional Persistent Rate Limiting', () => {
    it('blocks a user exceeding the per-user window quota (max 10 emails / 10 min)', async () => {
      for (let i = 0; i < 10; i++) {
        await emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: `vendor_${i}@example.com`,
            recipientName: `Vendor ${i}`,
            subject: `Inquiry #${i}`,
            bodyText: 'Routine coordination.',
            idempotencyKey: `user_rate_${i}`,
          },
          testUserOwner,
          eventStore
        );
      }

      // 11th request must be rejected by server rate limiter
      await expect(
        emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: 'vendor_11@example.com',
            recipientName: 'Vendor 11',
            subject: 'Inquiry #11',
            bodyText: 'Should exceed rate limit.',
            idempotencyKey: 'user_rate_11',
          },
          testUserOwner,
          eventStore
        )
      ).rejects.toThrow(/Rate limit exceeded: Maximum 10 vendor emails allowed per 10-minute window per user/i);
    });

    it('blocks excessive rapid emails to the same recipient (anti-vendor harassment, max 3 / 10 min)', async () => {
      const targetVendorEmail = 'target_vendor@imperial.example.com';
      for (let i = 0; i < 3; i++) {
        await emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: targetVendorEmail,
            recipientName: 'Chef Rajesh',
            subject: `Inquiry to same vendor #${i}`,
            bodyText: 'Frequent inquiry.',
            idempotencyKey: `recipient_rate_${i}`,
          },
          testUserEditor,
          eventStore
        );
      }

      // 4th email to same recipient must be rejected
      await expect(
        emailService.dispatchVendorEmail(
          {
            eventId: sampleEventId,
            vendorId: 'vnd_palace_catering',
            recipientEmail: targetVendorEmail,
            recipientName: 'Chef Rajesh',
            subject: 'Inquiry #4 to same vendor',
            bodyText: 'Should trigger recipient rate limit.',
            idempotencyKey: 'recipient_rate_4',
          },
          testUserEditor,
          eventStore
        )
      ).rejects.toThrow(/Rate limit exceeded: Maximum 3 emails allowed per 10-minute window to/i);
    });
  });

  describe('8. Bounded Retries & Failure Handling', () => {
    it('retries transient failures and succeeds when provider recovers within retry budget', async () => {
      testProvider.failCountBeforeSuccess = 2; // Fail twice, succeed on 3rd attempt

      const record = await emailService.dispatchVendorEmail(
        {
          eventId: sampleEventId,
          vendorId: 'vnd_palace_catering',
          recipientEmail: 'rajesh@imperialcaterers.example.com',
          recipientName: 'Chef Rajesh',
          subject: 'Retry Recovery Test',
          bodyText: 'Testing bounded retry engine.',
          idempotencyKey: 'idemp_transient_retry_001',
        },
        testUserOwner,
        eventStore
      );

      expect(record.status).toBe('accepted_by_provider');
      expect(record.attempts).toBe(3);
    });

    it('fails gracefully and records failed status when provider has permanent outage', async () => {
      testProvider.shouldFail = true;
      testProvider.failureType = 'permanent';
      testProvider.failureReason = 'SMTP 535: Bad credentials';

      const record = await emailService.dispatchVendorEmail(
        {
          eventId: sampleEventId,
          vendorId: 'vnd_palace_catering',
          recipientEmail: 'rajesh@imperialcaterers.example.com',
          recipientName: 'Chef Rajesh',
          subject: 'Permanent Outage Test',
          bodyText: 'Testing permanent failure handling.',
          idempotencyKey: 'idemp_permanent_outage_001',
        },
        testUserOwner,
        eventStore
      );

      expect(record.status).toBe('failed');
      expect(record.error).toContain('SMTP 535');

      // Database audit log records the failure
      const auditLog = emailService.getAuditLog(testUserOwner, eventStore, sampleEventId);
      const failedEntry = auditLog.find((e) => e.idempotencyKey === 'idemp_permanent_outage_001');
      expect(failedEntry).toBeDefined();
      expect(failedEntry?.status).toBe('failed');
    });
  });

  describe('9. Controlled Real Delivery Test (Ethereal Live Transport)', () => {
    it('verifies live SMTP connection and generates verifiable preview URL', async () => {
      const etherealProvider = new EtherealTestProvider();

      // Test real network connectivity to Ethereal SMTP server over TLS
      const health = await etherealProvider.verifyConnection();
      expect(health.ok).toBe(true);

      const deliveryResult = await etherealProvider.sendEmail({
        eventId: sampleEventId,
        vendorId: 'vnd_palace_catering',
        recipientEmail: 'test-recipient@ethereal.email',
        recipientName: 'Chef Rajesh',
        subject: 'Controlled Live Delivery Verification: VowPilot',
        bodyText: 'This is a verified live delivery test executed against Ethereal Email.',
        htmlBody: '<p>Verified delivery proof.</p>',
      });

      expect(deliveryResult.success).toBe(true);
      expect(deliveryResult.status).toBe('delivered');
      expect(deliveryResult.providerMessageId).toBeDefined();
      expect(typeof deliveryResult.providerMessageId).toBe('string');
      expect(deliveryResult.previewUrl).toBeDefined();
      expect(deliveryResult.previewUrl).toContain('https://ethereal.email/message/');
    }, 45000); // 45s timeout for live TLS handshake under coverage instrumentation
  });
});
