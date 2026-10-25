import { collaborationClient } from './collaborationClient';

export interface DispatchEmailPayload {
  eventId: string;
  vendorId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyText: string;
}

export interface DispatchEmailResponse {
  mode: 'server_dispatched' | 'mailto_client_fallback';
  status: 'accepted_by_provider' | 'opened_in_client' | 'failed';
  providerMessageId?: string;
  error?: string;
}

/**
 * Dispatches vendor email using server delivery when connected,
 * gracefully falling back to RFC-6068 mailto: when server is unconfigured or offline.
 */
export async function sendVendorClarificationEmail(
  payload: DispatchEmailPayload
): Promise<DispatchEmailResponse> {
  const token = collaborationClient.getToken();
  const serverUrl = collaborationClient.getState().serverUrl;

  // If authenticated with collaboration server, attempt server-side delivery
  if (token) {
    try {
      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const res = await fetch(`${serverUrl}/api/vendors/dispatch-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...payload,
          idempotencyKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          mode: 'server_dispatched',
          status: 'accepted_by_provider',
          providerMessageId: data.providerMessageId,
        };
      }
    } catch {
      // Fallback to client mailto below on network or server outage
    }
  }

  // Graceful RFC-6068 mailto: fallback
  try {
    const mailtoUrl = `mailto:${encodeURIComponent(payload.recipientEmail)}?subject=${encodeURIComponent(
      payload.subject
    )}&body=${encodeURIComponent(payload.bodyText)}`;

    if (typeof window !== 'undefined') {
      window.location.href = mailtoUrl;
    }

    return {
      mode: 'mailto_client_fallback',
      status: 'opened_in_client',
    };
  } catch (err: unknown) {
    return {
      mode: 'mailto_client_fallback',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Failed to launch email client.',
    };
  }
}
