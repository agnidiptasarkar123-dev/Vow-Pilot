import { VowPilotDatabase } from '../connection';
import { EmailDeliveryRecord } from '../../types';
import { EmailAuditRow } from '../types';

export class EmailAuditRepository {
  private db: VowPilotDatabase;

  constructor(db: VowPilotDatabase) {
    this.db = db;
  }

  public recordEmail(record: EmailDeliveryRecord): void {
    this.db
      .prepare<
        [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string | null,
          string,
          string,
          string | null,
          number,
          string | null,
          string | null,
          string | null,
          string | null
        ]
      >(`
        INSERT INTO email_audit_records (
          id, event_id, vendor_id, recipient_email, subject, status,
          provider, provider_message_id, dispatched_at, dispatched_by,
          idempotency_key, attempts, reply_to, preview_url, html_body, error
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.eventId,
        record.vendorId,
        record.recipientEmail,
        record.subject,
        record.status,
        record.provider,
        record.providerMessageId || null,
        record.dispatchedAt,
        record.dispatchedBy,
        record.idempotencyKey || null,
        record.attempts || 1,
        record.replyTo || null,
        record.previewUrl || null,
        record.htmlBody || null,
        record.error || null
      );
  }

  public updateEmailRecord(
    id: string,
    updates: Partial<Pick<EmailDeliveryRecord, 'status' | 'providerMessageId' | 'previewUrl' | 'attempts' | 'error'>>
  ): void {
    const existing = this.db
      .prepare<[string], EmailAuditRow>('SELECT * FROM email_audit_records WHERE id = ?')
      .get(id);

    if (!existing) return;

    this.db
      .prepare<[string, string | null, string | null, number, string | null, string]>(`
        UPDATE email_audit_records
        SET status = ?, provider_message_id = ?, preview_url = ?, attempts = ?, error = ?
        WHERE id = ?
      `)
      .run(
        updates.status ?? existing.status,
        updates.providerMessageId !== undefined ? updates.providerMessageId : existing.provider_message_id,
        updates.previewUrl !== undefined ? updates.previewUrl : existing.preview_url,
        updates.attempts !== undefined ? updates.attempts : existing.attempts,
        updates.error !== undefined ? updates.error : existing.error,
        id
      );
  }

  public getRecordByIdempotencyKey(key: string): EmailDeliveryRecord | null {
    const row = this.db
      .prepare<[string], EmailAuditRow>(`
        SELECT *
        FROM email_audit_records
        WHERE idempotency_key = ?
      `)
      .get(key);

    if (!row) return null;
    return this.mapRowToRecord(row);
  }

  public getAuditLog(eventId?: string, authorizedEventIds?: Set<string>): EmailDeliveryRecord[] {
    let rows: EmailAuditRow[];
    if (eventId) {
      rows = this.db
        .prepare<[string], EmailAuditRow>(`
          SELECT *
          FROM email_audit_records
          WHERE event_id = ?
          ORDER BY dispatched_at ASC
        `)
        .all(eventId);
    } else {
      rows = this.db
        .prepare<[], EmailAuditRow>(`
          SELECT *
          FROM email_audit_records
          ORDER BY dispatched_at ASC
        `)
        .all();

      if (authorizedEventIds) {
        rows = rows.filter((r) => authorizedEventIds.has(r.event_id));
      }
    }

    return rows.map((r) => this.mapRowToRecord(r));
  }

  public getUserRateLimitCount(dispatchedBy: string, windowStartIso: string): number {
    const row = this.db
      .prepare<[string, string], { cnt: number }>(`
        SELECT COUNT(*) as cnt
        FROM email_audit_records
        WHERE dispatched_by = ? AND dispatched_at >= ?
      `)
      .get(dispatchedBy, windowStartIso);

    return row?.cnt ?? 0;
  }

  public getEventRateLimitCount(eventId: string, windowStartIso: string): number {
    const row = this.db
      .prepare<[string, string], { cnt: number }>(`
        SELECT COUNT(*) as cnt
        FROM email_audit_records
        WHERE event_id = ? AND dispatched_at >= ?
      `)
      .get(eventId, windowStartIso);

    return row?.cnt ?? 0;
  }

  public getRecipientRateLimitCount(recipientEmail: string, windowStartIso: string): number {
    const row = this.db
      .prepare<[string, string], { cnt: number }>(`
        SELECT COUNT(*) as cnt
        FROM email_audit_records
        WHERE recipient_email = ? AND dispatched_at >= ?
      `)
      .get(recipientEmail.toLowerCase(), windowStartIso);

    return row?.cnt ?? 0;
  }

  private mapRowToRecord(row: EmailAuditRow): EmailDeliveryRecord {
    return {
      id: row.id,
      eventId: row.event_id,
      vendorId: row.vendor_id,
      recipientEmail: row.recipient_email,
      subject: row.subject,
      status: row.status as any,
      provider: row.provider,
      providerMessageId: row.provider_message_id ?? undefined,
      previewUrl: row.preview_url ?? undefined,
      dispatchedAt: row.dispatched_at,
      dispatchedBy: row.dispatched_by,
      idempotencyKey: row.idempotency_key ?? undefined,
      attempts: row.attempts ?? 1,
      replyTo: row.reply_to ?? undefined,
      htmlBody: row.html_body ?? undefined,
      error: row.error ?? undefined,
    };
  }

  public clearAll(): void {
    this.db.exec('DELETE FROM email_audit_records;');
  }
}
