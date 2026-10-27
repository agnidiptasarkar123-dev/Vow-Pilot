import { collaborationClient } from './collaborationClient';
import { EmailDeliveryRecord } from '../types';

export interface DispatchEmailPayload {
  eventId: string;
  vendorId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyText: string;
  replyTo?: string;
}

export type EmailDeliveryClientStatus =
  | 'queued'
  | 'sending'
  | 'accepted_by_provider'
  | 'delivered'
  | 'delivery_unknown'
  | 'failed'
  | 'rejected'
  | 'opened_in_client';

export interface DispatchEmailResponse {
  mode: 'server_dispatched' | 'manual_mailto_handoff';
  status: EmailDeliveryClientStatus;
  provider?: string;
  providerMessageId?: string;
  previewUrl?: string;
  attempts?: number;
  error?: string;
}

/**
 * Dispatches vendor inquiry email directly through VowPilot's authenticated server-side
 * delivery transport. Enforces multi-dimensional rate limiting, tenant authorization,
 * idempotency deduplication, and bounded retry policies.
 */
export async function dispatchEmailViaServer(
  payload: DispatchEmailPayload,
  options: { idempotencyKey?: string } = {}
): Promise<DispatchEmailResponse> {
  const token = collaborationClient.getToken();
  const serverUrl = collaborationClient.getState().serverUrl;

  if (!token) {
    return {
      mode: 'server_dispatched',
      status: 'failed',
      error: 'Authentication required: You must be logged in to dispatch vendor communications.',
    };
  }

  const idempotencyKey =
    options.idempotencyKey || `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    const res = await fetch(`${serverUrl}/api/vendors/dispatch-email`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...payload,
        idempotencyKey,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return {
        mode: 'server_dispatched',
        status: data.status || 'accepted_by_provider',
        provider: data.provider,
        providerMessageId: data.providerMessageId,
        previewUrl: data.previewUrl,
        attempts: data.attempts || 1,
      };
    }

    return {
      mode: 'server_dispatched',
      status: 'failed',
      error: data.error || `Server rejected delivery (HTTP ${res.status}).`,
      attempts: data.attempts,
    };
  } catch (err: unknown) {
    return {
      mode: 'server_dispatched',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Network connection failure while contacting dispatch service.',
    };
  }
}

/**
 * Manual client handoff using RFC-6068 mailto URI scheme.
 * Clearly designated as manual client handoff; never conflated with server delivery.
 */
export function launchManualMailtoHandoff(payload: {
  recipientEmail: string;
  subject: string;
  bodyText: string;
}): DispatchEmailResponse {
  try {
    const mailtoUrl = `mailto:${encodeURIComponent(payload.recipientEmail)}?subject=${encodeURIComponent(
      payload.subject
    )}&body=${encodeURIComponent(payload.bodyText)}`;

    if (typeof window !== 'undefined') {
      window.location.href = mailtoUrl;
    }

    return {
      mode: 'manual_mailto_handoff',
      status: 'opened_in_client',
    };
  } catch (err: unknown) {
    return {
      mode: 'manual_mailto_handoff',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Failed to launch system mail client.',
    };
  }
}

/**
 * Inspects provider health and transport connectivity.
 */
export async function checkEmailProviderHealth(): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const token = collaborationClient.getToken();
  const serverUrl = collaborationClient.getState().serverUrl;

  if (!token) {
    return { ok: false, error: 'Unauthenticated' };
  }

  try {
    const res = await fetch(`${serverUrl}/api/vendors/email-health`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, provider: data.provider };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false, provider: data.provider, error: data.error };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to check email health' };
  }
}

/**
 * Retrieves audit logs for the specified event.
 */
export async function getEmailAuditLogs(eventId?: string): Promise<EmailDeliveryRecord[]> {
  const token = collaborationClient.getToken();
  const serverUrl = collaborationClient.getState().serverUrl;

  if (!token) return [];

  try {
    const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
    const res = await fetch(`${serverUrl}/api/vendors/email-audit${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
    return [];
  } catch {
    return [];
  }
}
