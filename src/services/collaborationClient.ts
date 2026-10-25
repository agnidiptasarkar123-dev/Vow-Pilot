import { AppState } from '../types';

export type SyncStatus = 'local_only' | 'connecting' | 'synced' | 'syncing' | 'conflict' | 'offline_queued' | 'error';

export interface CollaborationState {
  status: SyncStatus;
  serverUrl: string;
  activeEventId: string | null;
  serverVersion: number;
  localVersion: number;
  role: 'owner' | 'editor' | 'viewer' | null;
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
  };
  private listeners: Set<CollaborationListener> = new Set();
  private eventSource: EventSource | null = null;
  private pendingQueue: Array<{ eventId: string; expectedVersion: number; state: AppState }> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('vowpilot_auth_token');
    }
  }

  public subscribe(listener: CollaborationListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener({ ...this.state });
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
    return { ...this.state };
  }

  public setServerUrl(url: string): void {
    this.serverUrl = url;
    this.state.serverUrl = url;
    this.notify();
  }

  public async connectToEvent(eventId: string, onRemoteUpdate?: (state: AppState) => void): Promise<void> {
    if (!this.authToken) {
      this.state.status = 'local_only';
      this.notify();
      return;
    }

    this.state.status = 'connecting';
    this.state.activeEventId = eventId;
    this.notify();

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load event: ${res.statusText}`);
      }

      const data = await res.json();
      this.state.status = 'synced';
      this.state.serverVersion = data.version;
      this.state.localVersion = data.version;
      this.state.role = data.members?.find((m: { userId: string }) => m.userId === data.ownerId)?.role || 'editor';
      this.notify();

      // Setup Server-Sent Events (SSE) for real-time collaboration updates
      if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
        if (this.eventSource) {
          this.eventSource.close();
        }
        this.eventSource = new EventSource(
          `${this.serverUrl}/api/events/${eventId}/stream?token=${encodeURIComponent(this.authToken)}`
        );

        this.eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'sync' && payload.event) {
              this.state.serverVersion = payload.version;
              this.state.localVersion = payload.version;
              this.state.status = 'synced';
              this.notify();
              if (onRemoteUpdate) {
                onRemoteUpdate(payload.event.state);
              }
            }
          } catch {
            // Ignore parse errors on ping
          }
        };

        this.eventSource.onerror = () => {
          // SSE reconnects automatically, update status indicator
          if (this.state.status !== 'conflict') {
            this.state.status = 'connecting';
            this.notify();
          }
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this.state.status = 'local_only';
      this.state.errorMessage = msg;
      this.notify();
    }
  }

  public async pushStateUpdate(
    eventId: string,
    state: AppState,
    expectedVersion: number = this.state.localVersion
  ): Promise<{ success: boolean; conflict?: CollaborationState['lastConflict'] }> {
    if (!this.authToken || this.state.status === 'local_only') {
      return { success: true };
    }

    this.state.status = 'syncing';
    this.notify();

    try {
      const res = await fetch(`${this.serverUrl}/api/events/${eventId}`, {
        method: 'PUT',
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
      // Network error -> store in pending offline queue
      this.pendingQueue.push({ eventId, expectedVersion, state });
      this.state.status = 'offline_queued';
      this.notify();
      return { success: false };
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.state.status = 'local_only';
    this.state.activeEventId = null;
    this.notify();
  }
}

export const collaborationClient = new CollaborationClient();
