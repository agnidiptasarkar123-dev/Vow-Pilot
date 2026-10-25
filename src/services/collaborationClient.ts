import { AppState } from '../types';

export type SyncStatus = 'local_only' | 'connecting' | 'synced' | 'syncing' | 'conflict' | 'offline_queued' | 'error';

export interface CollaborationMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface PendingInvite {
  token: string;
  tokenHash: string;
  eventId: string;
  role: 'owner' | 'editor' | 'viewer';
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  revoked: boolean;
}

export interface InvitePreview {
  eventId: string;
  eventName: string;
  role: 'owner' | 'editor' | 'viewer';
  inviterName: string;
  expiresAt: string;
  status: 'valid' | 'expired' | 'revoked' | 'used';
}

export interface CollaborationState {
  status: SyncStatus;
  serverUrl: string;
  activeEventId: string | null;
  serverVersion: number;
  localVersion: number;
  role: 'owner' | 'editor' | 'viewer' | null;
  currentUserId?: string;
  currentUserName?: string;
  members: CollaborationMember[];
  lastConflict?: {
    expectedVersion: number;
    currentVersion: number;
    lastModifiedBy: string;
    serverState: AppState;
  };
  errorMessage?: string;
}

export type CollaborationListener = (state: CollaborationState) => void;

class CollaborationClient {
  private serverUrl = 'http://localhost:3001';
  private authToken: string | null = null;
  private state: CollaborationState = {
    status: 'local_only',
    serverUrl: 'http://localhost:3001',
    activeEventId: null,
    serverVersion: 1,
    localVersion: 1,
    role: null,
    members: [],
  };
  private listeners: Set<CollaborationListener> = new Set();
  private eventSource: EventSource | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private onRemoteUpdateCallback?: (state: AppState) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('vowpilot_auth_token');
      // Resolve backend server URL: custom localStorage override > Vite env variable > default origin
      const storedUrl = localStorage.getItem('vowpilot_server_url');
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const origin = window.location.origin;

      if (storedUrl && storedUrl.trim()) {
        this.serverUrl = storedUrl.trim().replace(/\/+$/, '');
      } else if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
        this.serverUrl = envUrl.trim().replace(/\/+$/, '');
      } else if (origin.includes('localhost:5173') || origin.includes('localhost:3000')) {
        this.serverUrl = 'http://localhost:3001';
      } else {
        this.serverUrl = origin;
      }
      this.state.serverUrl = this.serverUrl;
    }
  }

  public subscribe(listener: CollaborationListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = { ...this.state, members: [...this.state.members] };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Suppress listener error
      }
    }
  }

  public setToken(token: string | null): void {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('vowpilot_auth_token', token);
      } else {
        localStorage.removeItem('vowpilot_auth_token');
      }
    }
  }

  public getToken(): string | null {
    return this.authToken;
  }

  public getState(): CollaborationState {
    return { ...this.state, members: [...this.state.members] };
  }

  public setServerUrl(url: string): void {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    this.serverUrl = cleanUrl;
    this.state.serverUrl = cleanUrl;
    if (typeof window !== 'undefined') {
      if (cleanUrl) {
        localStorage.setItem('vowpilot_server_url', cleanUrl);
      } else {
        localStorage.removeItem('vowpilot_server_url');
      }
    }
    this.notify();
  }

  public setCurrentUser(id: string, name: string): void {
    this.state.currentUserId = id;
    this.state.currentUserName = name;
    this.notify();
  }

  /**
   * Connects to a remote event and establishes real-time live synchronization via SSE.
   * Pulls authoritative persisted event state first, then listens for versioned broadcasts.
   */
  public async connectToEvent(eventId: string, onRemoteUpdate?: (state: AppState) => void): Promise<void> {
    this.onRemoteUpdateCallback = onRemoteUpdate;
    if (!this.authToken) {
      this.state.status = 'local_only';
      this.notify();
      return;
    }

    this.state.status = 'connecting';
    this.state.activeEventId = eventId;
    this.state.errorMessage = undefined;
    this.notify();

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}`, {
        credentials: 'include',
        headers: {
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication expired. Please sign in again.');
        }
        if (res.status === 403) {
          throw new Error('You do not have permission to view or collaborate on this event.');
        }
        if (res.status === 404) {
          throw new Error('Event not found.');
        }
        throw new Error(`Failed to load event: ${res.statusText}`);
      }

      const data = await res.json();
      this.state.status = 'synced';
      this.state.serverVersion = data.version;
      this.state.localVersion = data.version;
      this.state.members = data.members || [];
      this.state.role = data.userRole || 'editor';
      this.reconnectAttempt = 0;
      this.notify();

      if (onRemoteUpdate && data.state) {
        onRemoteUpdate(data.state);
      }

      // Establish real-time SSE connection with cursor
      this.setupEventSource(eventId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this.state.status = 'error';
      this.state.errorMessage = msg;
      this.notify();
    }
  }

  /**
   * Configures SSE listener with Last-Event-ID reconnection cursor and automated backoff recovery.
   */
  private setupEventSource(eventId: string): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const streamUrl = `${this.serverUrl}/api/events/${eventId}/stream?token=${encodeURIComponent(
      this.authToken || ''
    )}&sinceVersion=${this.state.localVersion}`;

    this.eventSource = new EventSource(streamUrl);

    this.eventSource.onopen = () => {
      this.reconnectAttempt = 0;
      if (this.state.status !== 'conflict') {
        this.state.status = 'synced';
        this.notify();
      }
    };

    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'sync' && payload.event) {
          const incomingVersion = payload.version;

          // Prevent duplicate or stale message processing
          if (incomingVersion > this.state.localVersion) {
            this.state.serverVersion = incomingVersion;
            this.state.localVersion = incomingVersion;
            this.state.status = 'synced';
            this.state.lastConflict = undefined;
            if (payload.event.members) {
              this.state.members = payload.event.members;
            }
            this.notify();

            if (this.onRemoteUpdateCallback && payload.event.state) {
              this.onRemoteUpdateCallback(payload.event.state);
            }
          }
        }
      } catch {
        // Ignore unparseable ping frames
      }
    };

    this.eventSource.onerror = () => {
      if (this.state.status !== 'conflict') {
        this.state.status = 'connecting';
        this.notify();
      }

      // Exponential backoff reconnection guard for server restart recovery
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      const backoffMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempt), 10000);
      this.reconnectAttempt++;

      this.reconnectTimeout = setTimeout(async () => {
        if (this.state.activeEventId === eventId && this.authToken) {
          try {
            // Verify latest server state and refresh
            const res = await fetch(`${this.serverUrl}/api/events/${eventId}`, {
              credentials: 'include',
              headers: { Authorization: `Bearer ${this.authToken}` },
            });
            if (res.ok) {
              const fresh = await res.json();
              if (fresh.version > this.state.localVersion) {
                this.state.serverVersion = fresh.version;
                this.state.localVersion = fresh.version;
                this.state.members = fresh.members || [];
                if (this.onRemoteUpdateCallback && fresh.state) {
                  this.onRemoteUpdateCallback(fresh.state);
                }
              }
              this.state.status = 'synced';
              this.notify();
            }
          } catch {
            // Server still recovering
          }
        }
      }, backoffMs);
    };
  }

  /**
   * Pushes a local state change using Optimistic Concurrency Control (OCC).
   * Rejects stale writes with explicit 409 Conflict without silent overwriting.
   */
  public async pushStateUpdate(
    eventId: string,
    state: AppState,
    expectedVersion: number = this.state.localVersion
  ): Promise<{ success: boolean; conflict?: CollaborationState['lastConflict']; error?: string }> {
    // If not connected or local only, accept locally
    if (!this.authToken || this.state.status === 'local_only') {
      return { success: true };
    }

    // Role check: viewers are strictly read-only
    if (this.state.role === 'viewer') {
      return {
        success: false,
        error: 'Forbidden: Viewer role does not have permission to modify event data.',
      };
    }

    this.state.status = 'syncing';
    this.notify();

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
          'X-Expected-Version': String(expectedVersion),
        },
        body: JSON.stringify({
          expectedVersion,
          state,
        }),
      });

      if (res.status === 409) {
        // Concurrency conflict detected!
        const conflictData = await res.json();
        this.state.status = 'conflict';
        this.state.lastConflict = {
          expectedVersion: conflictData.expectedVersion,
          currentVersion: conflictData.currentVersion,
          lastModifiedBy: conflictData.lastModifiedBy,
          serverState: conflictData.currentState,
        };
        this.notify();
        return { success: false, conflict: this.state.lastConflict };
      }

      if (res.status === 403) {
        const errData = await res.json();
        this.state.status = 'error';
        this.state.errorMessage = errData.error || 'Permission denied.';
        this.notify();
        return { success: false, error: this.state.errorMessage };
      }

      if (!res.ok) {
        throw new Error(`Sync error: ${res.statusText}`);
      }

      const data = await res.json();
      this.state.serverVersion = data.event.version;
      this.state.localVersion = data.event.version;
      this.state.status = 'synced';
      this.state.lastConflict = undefined;
      this.notify();
      return { success: true };
    } catch (err: unknown) {
      // Network interruption
      this.state.status = 'offline_queued';
      this.notify();
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Conflict Resolution: Accept server version, replacing local stale edits.
   */
  public resolveConflictWithServer(onRemoteUpdate?: (state: AppState) => void): void {
    if (!this.state.lastConflict) return;
    const serverState = this.state.lastConflict.serverState;
    const newVersion = this.state.lastConflict.currentVersion;

    this.state.serverVersion = newVersion;
    this.state.localVersion = newVersion;
    this.state.status = 'synced';
    this.state.lastConflict = undefined;
    this.notify();

    if (onRemoteUpdate) {
      onRemoteUpdate(serverState);
    } else if (this.onRemoteUpdateCallback) {
      this.onRemoteUpdateCallback(serverState);
    }
  }

  /**
   * Conflict Resolution: Overwrite remote with local changes by advancing past the conflict version.
   */
  public async resolveConflictWithLocal(
    eventId: string,
    localState: AppState
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.state.lastConflict) return { success: false, error: 'No active conflict' };
    const latestVersion = this.state.lastConflict.currentVersion;

    // Retry with latestVersion as expectedVersion
    return this.pushStateUpdate(eventId, localState, latestVersion);
  }

  /**
   * Generates a secure invitation token for an event.
   */
  public async createInvite(
    eventId: string,
    role: 'owner' | 'editor' | 'viewer',
    expiresInHours = 48
  ): Promise<{ success: boolean; invite?: PendingInvite; error?: string }> {
    if (!this.authToken) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}/invites`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ role, expiresInHours }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to generate invitation' };
      }

      const invite = await res.json();
      return { success: true, invite };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Lists all invitations for the active event (owners and editors).
   */
  public async listInvites(eventId: string): Promise<{ success: boolean; invites?: PendingInvite[]; error?: string }> {
    if (!this.authToken) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}/invites`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${this.authToken}` },
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to list invites' };
      }

      const data = await res.json();
      return { success: true, invites: data.invites };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Revokes an active invitation token (owner-only).
   */
  public async revokeInvite(eventId: string, token: string): Promise<{ success: boolean; error?: string }> {
    if (!this.authToken) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}/invites/revoke`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to revoke invite' };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Previews an invitation before accepting or declining.
   */
  public async inspectInvite(
    token: string
  ): Promise<{ success: boolean; preview?: InvitePreview; error?: string }> {
    try {
      const res = await fetch(`${this.serverUrl}/api/events/invitations/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to inspect invitation' };
      }

      const preview = await res.json();
      return { success: true, preview };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Accepts an invitation and joins the event.
   */
  public async joinEvent(token: string): Promise<{ success: boolean; event?: { id: string; name: string }; error?: string }> {
    if (!this.authToken) return { success: false, error: 'Please sign in first to join an event' };

    try {
      const res = await fetch(`${this.serverUrl}/api/events/join`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to accept invitation' };
      }

      const event = await res.json();
      return { success: true, event };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Declines an invitation token.
   */
  public async declineInvite(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.serverUrl}/api/events/decline`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to decline invitation' };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Removes a member from an event (owner-only).
   */
  public async removeMember(eventId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.authToken) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}/members/${targetUserId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${this.authToken}` },
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to remove member' };
      }

      const updated = await res.json();
      if (updated.members) {
        this.state.members = updated.members;
        this.notify();
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.state.status = 'local_only';
    this.state.activeEventId = null;
    this.state.members = [];
    this.state.role = null;
    this.state.lastConflict = undefined;
    this.notify();
  }
}

export const collaborationClient = new CollaborationClient();
if (typeof window !== 'undefined') {
  (window as unknown as { collaborationClient: unknown }).collaborationClient = collaborationClient;
}
