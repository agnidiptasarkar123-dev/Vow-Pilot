import crypto from 'node:crypto';
import { VowPilotDatabase } from '../connection';
import { EventActivityRow } from '../types';

export class ActivityRepository {
  private db: VowPilotDatabase;

  constructor(db: VowPilotDatabase) {
    this.db = db;
  }

  public recordActivity(
    eventId: string,
    userId: string,
    userName: string,
    action: string,
    version: number,
    details?: unknown
  ): void {
    const id = `act_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const detailsJson = details ? JSON.stringify(details) : null;

    this.db
      .prepare<[string, string, string, string, string, number, string | null, string]>(`
        INSERT INTO event_activity_history (id, event_id, user_id, user_name, action, version, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(id, eventId, userId, userName, action, version, detailsJson, now);
  }

  public getActivityHistory(eventId: string): EventActivityRow[] {
    return this.db
      .prepare<[string], EventActivityRow>(`
        SELECT id, event_id, user_id, user_name, action, version, details_json, created_at
        FROM event_activity_history
        WHERE event_id = ?
        ORDER BY version ASC, created_at ASC
      `)
      .all(eventId);
  }

  public clearAll(): void {
    this.db.exec('DELETE FROM event_activity_history;');
  }
}
