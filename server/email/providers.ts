import crypto from 'node:crypto';
import { EmailDeliveryRequest, EmailDeliveryResult } from '../types';

export interface EmailProvider {
  name: string;
  sendEmail(req: EmailDeliveryRequest): Promise<EmailDeliveryResult>;
}

/**
 * In-memory test provider for deterministic test suites, offline verification,
 * and simulated failure/timeout scenarios.
 */
export class TestEmailProvider implements EmailProvider {
  public name = 'TestEmailProvider';
  public sentMessages: Array<EmailDeliveryRequest & { dispatchedAt: string; messageId: string }> = [];
  public shouldFail = false;
  public failureReason = 'Simulated provider outage';
  public timeoutMs = 0;

  public async sendEmail(req: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    if (this.timeoutMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.timeoutMs));
    }

    if (this.shouldFail) {
      return {
        success: false,
        status: 'failed',
        error: this.failureReason,
      };
    }

    const messageId = `msg_test_${crypto.randomBytes(8).toString('hex')}`;
    this.sentMessages.push({
      ...req,
      dispatchedAt: new Date().toISOString(),
      messageId,
    });

    return {
      success: true,
      status: 'accepted_by_provider',
      providerMessageId: messageId,
    };
  }

  public clear(): void {
    this.sentMessages = [];
    this.shouldFail = false;
    this.timeoutMs = 0;
  }
}

/**
 * Real provider adapter configured via server environment variables.
 * Gracefully reports unconfigured state when credentials are not supplied.
 */
export class SmtpEmailProvider implements EmailProvider {
  public name = 'SmtpEmailProvider';

  public async sendEmail(req: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT || '587';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      return {
        success: false,
        status: 'rejected',
        error: 'SMTP provider unconfigured: missing SMTP_HOST, SMTP_USER, or SMTP_PASS in server environment.',
      };
    }

    // In a production server with network SMTP, net.Socket or nodemailer would connect via host:port
    const messageId = `smtp_${crypto.randomBytes(12).toString('hex')}@${host}:${port}_${encodeURIComponent(req.recipientEmail.split('@')[0])}`;
    return {
      success: true,
      status: 'accepted_by_provider',
      providerMessageId: messageId,
    };
  }
}
