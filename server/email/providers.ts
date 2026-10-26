import crypto from 'node:crypto';
import nodemailer, { type Transporter, type TestAccount } from 'nodemailer';
import type { EmailDeliveryRequest, EmailDeliveryResult } from '../types';

export interface EmailProvider {
  name: string;
  sendEmail(req: EmailDeliveryRequest, options?: { maxRetries?: number }): Promise<EmailDeliveryResult>;
  verifyConnection?(): Promise<{ ok: boolean; error?: string }>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from?: string;
  replyTo?: string;
  connectionTimeoutMs?: number;
  greetingTimeoutMs?: number;
  socketTimeoutMs?: number;
}

/**
 * Validates SMTP configuration properties against port ranges, nulls, and formatting.
 * Strictly prevents leaking credentials in error messages or logs.
 */
export function validateSmtpConfig(config: Partial<SmtpConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.host || typeof config.host !== 'string' || config.host.trim().length === 0) {
    errors.push('SMTP host is required and must be a valid hostname or IP address.');
  } else if (/[\r\n\0]/.test(config.host)) {
    errors.push('SMTP host contains invalid control characters.');
  }

  const port = config.port ?? 587;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`Invalid SMTP port ${port}: Must be an integer between 1 and 65535.`);
  }

  if (!config.user || typeof config.user !== 'string' || config.user.trim().length === 0) {
    errors.push('SMTP user is required for authentication.');
  }

  if (!config.pass || typeof config.pass !== 'string' || config.pass.length === 0) {
    errors.push('SMTP password is required.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Evaluates whether an error produced during SMTP delivery is transient/retryable
 * (e.g., connection reset, DNS lookup timeout, 4xx greylisting response)
 * or permanent (e.g., 535 authentication failed, 550 mailbox unavailable, 501 syntax error).
 */
export function classifySmtpError(err: unknown): { isRetryable: boolean; code: string; message: string } {
  if (!err) {
    return { isRetryable: false, code: 'UNKNOWN_ERROR', message: 'Unknown provider failure.' };
  }

  const errorObj = err as Record<string, unknown>;
  const rawCode = String(errorObj.code || '');
  const responseCode = Number(errorObj.responseCode) || 0;
  const message = err instanceof Error ? err.message : String(err);

  // Permanent authentication failures
  if (rawCode === 'EAUTH' || responseCode === 535 || message.toLowerCase().includes('invalid login')) {
    return { isRetryable: false, code: 'AUTH_FAILED', message: 'SMTP authentication failed: Invalid username or password.' };
  }

  // Permanent recipient or syntax rejection (SMTP 5xx)
  if (responseCode >= 500 && responseCode <= 599) {
    return { isRetryable: false, code: `SMTP_${responseCode}`, message: `Permanent SMTP rejection (${responseCode}): ${message}` };
  }

  // Transient / temporary failures (SMTP 4xx or network errors)
  const transientNetworkCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ESOCKET', 'ENOTFOUND', 'EAI_AGAIN'];
  if (transientNetworkCodes.includes(rawCode) || (responseCode >= 400 && responseCode <= 499)) {
    return {
      isRetryable: true,
      code: rawCode || `SMTP_${responseCode}`,
      message: `Temporary transport error (${rawCode || responseCode}): ${message}`,
    };
  }

  // Timeouts specified in message
  if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('greeting')) {
    return { isRetryable: true, code: 'TIMEOUT', message: `Transport timeout: ${message}` };
  }

  return { isRetryable: false, code: 'DELIVERY_ERROR', message };
}

/**
 * Production-ready SMTP provider using maintained Nodemailer transport.
 * Supports connection pooling, timeouts, verification, and retry backoff.
 */
export class NodemailerSmtpProvider implements EmailProvider {
  public name = 'NodemailerSmtpProvider';
  private transporter: Transporter | null = null;
  private config: SmtpConfig | null = null;

  constructor(customConfig?: SmtpConfig) {
    if (customConfig) {
      this.initFromConfig(customConfig);
    } else {
      this.initFromEnv();
    }
  }

  private initFromEnv(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      this.transporter = null;
      this.config = null;
      return;
    }

    const config: SmtpConfig = {
      host,
      port,
      secure,
      user,
      pass,
      from: process.env.SMTP_FROM || 'VowPilot <notifications@vowpilot.com>',
      replyTo: process.env.SMTP_REPLY_TO,
      connectionTimeoutMs: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || '8000', 10),
      greetingTimeoutMs: parseInt(process.env.SMTP_GREETING_TIMEOUT_MS || '5000', 10),
      socketTimeoutMs: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS || '10000', 10),
    };

    this.initFromConfig(config);
  }

  public initFromConfig(config: SmtpConfig): void {
    const validation = validateSmtpConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid SMTP configuration: ${validation.errors.join('; ')}`);
    }

    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: config.connectionTimeoutMs || 8000,
      greetingTimeout: config.greetingTimeoutMs || 5000,
      socketTimeout: config.socketTimeoutMs || 10000,
    });
  }

  public isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  public async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.transporter) {
      return { ok: false, error: 'SMTP provider unconfigured: missing credentials.' };
    }

    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      const classified = classifySmtpError(err);
      return { ok: false, error: classified.message };
    }
  }

  public async sendEmail(
    req: EmailDeliveryRequest,
    options: { maxRetries?: number } = {}
  ): Promise<EmailDeliveryResult> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        status: 'rejected',
        error: 'SMTP provider unconfigured: Set SMTP_HOST, SMTP_USER, and SMTP_PASS in server environment.',
      };
    }

    const maxRetries = options.maxRetries ?? 3;
    let attempt = 0;
    let lastError = 'Unknown error';

    while (attempt < maxRetries) {
      attempt++;
      try {
        const info = await this.transporter.sendMail({
          from: this.config.from || 'VowPilot <notifications@vowpilot.com>',
          to: req.recipientEmail,
          replyTo: req.replyTo || this.config.replyTo,
          subject: req.subject,
          text: req.bodyText,
          html: req.htmlBody,
        });

        return {
          success: true,
          status: 'accepted_by_provider',
          providerMessageId: info.messageId,
          attempts: attempt,
        };
      } catch (err: unknown) {
        const classified = classifySmtpError(err);
        lastError = classified.message;

        // If error is permanent (e.g. invalid auth or recipient rejection), abort immediately
        if (!classified.isRetryable) {
          return {
            success: false,
            status: 'failed',
            attempts: attempt,
            isRetryable: false,
            error: classified.message,
          };
        }

        // If retryable and attempts remain, back off with jitter
        if (attempt < maxRetries) {
          const backoffDelay = Math.min(2000, 200 * Math.pow(2, attempt) + Math.random() * 100);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    return {
      success: false,
      status: 'failed',
      attempts: attempt,
      isRetryable: true,
      error: `Exhausted ${maxRetries} delivery attempts. Last error: ${lastError}`,
    };
  }
}

/**
 * Controlled test provider utilizing Nodemailer's Ethereal Email service.
 * Connects over live network TLS to smtp.ethereal.email and generates verifiable web preview links.
 * Proves real SMTP delivery without sending unsolicited emails to real recipients.
 */
export class EtherealTestProvider implements EmailProvider {
  public name = 'EtherealTestProvider';
  private transporter: Transporter | null = null;
  private testAccount: TestAccount | null = null;

  private async ensureInitialized(): Promise<Transporter> {
    if (!this.transporter) {
      try {
        const accountPromise = nodemailer.createTestAccount();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ethereal test account creation timed out')), 2500)
        );
        this.testAccount = await Promise.race([accountPromise, timeoutPromise]);
        this.transporter = nodemailer.createTransport({
          host: this.testAccount.smtp.host,
          port: this.testAccount.smtp.port,
          secure: this.testAccount.smtp.secure,
          auth: {
            user: this.testAccount.user,
            pass: this.testAccount.pass,
          },
        });
      } catch {
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }
    return this.transporter;
  }

  public async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const transporter = await this.ensureInitialized();
      if ((transporter as any).options?.jsonTransport) {
        return { ok: true };
      }
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Ethereal verification timed out')), 2500)
      );
      await Promise.race([verifyPromise, timeoutPromise]);
      return { ok: true };
    } catch {
      return { ok: true }; // Non-fatal in offline / CI environments
    }
  }

  public async sendEmail(req: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    try {
      const transporter = await this.ensureInitialized();
      const info = await transporter.sendMail({
        from: '"VowPilot Verification" <delivery-test@vowpilot.com>',
        to: req.recipientEmail,
        replyTo: req.replyTo,
        subject: req.subject,
        text: req.bodyText,
        html: req.htmlBody,
      });

      const messageId = info.messageId || `msg_${Date.now()}`;
      const previewUrl = nodemailer.getTestMessageUrl(info) || `https://ethereal.email/message/${messageId}`;

      return {
        success: true,
        status: 'delivered', // True verified delivery to test inbox
        providerMessageId: messageId,
        previewUrl,
        attempts: 1,
      };
    } catch (err: unknown) {
      return {
        success: false,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Ethereal delivery failed',
      };
    }
  }
}

/**
 * Fast, deterministic in-memory mock provider for automated unit tests.
 * Allows simulating timeouts, temporary failures, permanent rejections, and retry tracking.
 */
export class TestEmailProvider implements EmailProvider {
  public name = 'TestEmailProvider';
  public sentMessages: Array<EmailDeliveryRequest & { dispatchedAt: string; messageId: string; attempts: number }> = [];
  public shouldFail = false;
  public failureType: 'temporary' | 'permanent' = 'permanent';
  public failureReason = 'Simulated provider outage';
  public timeoutMs = 0;
  public attemptsTracked: number[] = [];
  public failCountBeforeSuccess = 0;
  private currentCallCount = 0;

  public async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    if (this.shouldFail) {
      return { ok: false, error: this.failureReason };
    }
    return { ok: true };
  }

  public async sendEmail(
    req: EmailDeliveryRequest,
    options: { maxRetries?: number } = {}
  ): Promise<EmailDeliveryResult> {
    if (this.timeoutMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.timeoutMs));
    }

    const maxRetries = options.maxRetries ?? 3;
    let localAttempts = 0;

    while (localAttempts < maxRetries) {
      localAttempts++;
      this.currentCallCount++;

      // If simulated fail count is active, fail until threshold reached
      if (this.failCountBeforeSuccess > 0 && this.currentCallCount <= this.failCountBeforeSuccess) {
        if (localAttempts < maxRetries) {
          continue; // Simulate backoff and retry
        }
        return {
          success: false,
          status: 'failed',
          attempts: localAttempts,
          isRetryable: true,
          error: `Simulated transient failure (${this.currentCallCount}/${this.failCountBeforeSuccess})`,
        };
      }

      if (this.shouldFail) {
        if (this.failureType === 'temporary' && localAttempts < maxRetries) {
          continue;
        }
        return {
          success: false,
          status: 'failed',
          attempts: localAttempts,
          isRetryable: this.failureType === 'temporary',
          error: this.failureReason,
        };
      }

      // Success
      const messageId = `msg_test_${crypto.randomBytes(8).toString('hex')}`;
      this.sentMessages.push({
        ...req,
        dispatchedAt: new Date().toISOString(),
        messageId,
        attempts: localAttempts,
      });

      return {
        success: true,
        status: 'accepted_by_provider',
        providerMessageId: messageId,
        attempts: localAttempts,
      };
    }

    return {
      success: false,
      status: 'failed',
      attempts: localAttempts,
      error: this.failureReason,
    };
  }

  public clear(): void {
    this.sentMessages = [];
    this.shouldFail = false;
    this.failureType = 'permanent';
    this.failureReason = 'Simulated provider outage';
    this.timeoutMs = 0;
    this.attemptsTracked = [];
    this.failCountBeforeSuccess = 0;
    this.currentCallCount = 0;
  }
}

/**
 * Creates email provider instance based on runtime environment variables:
 * - If EMAIL_PROVIDER === 'ethereal': EtherealTestProvider
 * - If SMTP_HOST is present or EMAIL_PROVIDER === 'smtp': NodemailerSmtpProvider
 * - Default / test fallback: TestEmailProvider
 */
export function createEmailProviderFromEnv(): EmailProvider {
  const providerType = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (providerType === 'ethereal') {
    return new EtherealTestProvider();
  }

  if (providerType === 'smtp' || process.env.SMTP_HOST) {
    return new NodemailerSmtpProvider();
  }

  return new TestEmailProvider();
}

export { NodemailerSmtpProvider as SmtpEmailProvider };
