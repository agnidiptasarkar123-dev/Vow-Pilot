# VowPilot Multi-User Collaboration & Distributed Systems Specification

**System Version:** VowPilot 2.0  
**Domain:** Celebration & Event Planning Distributed Architecture  
**Document Classification:** Production Architectural Specification & Operational Runbook  

---

## 1. Executive Architecture Overview

VowPilot is a deterministic celebration and wedding coordination platform engineered for real-time, multi-stakeholder collaboration. In celebration planning, multiple coordinators (hosts, family members, professional event planners, and suppliers) modify interdependent budgets, complex task dependency graphs, and vendor proposals simultaneously.

To ensure strict financial durability, relational isolation, and zero lost contributions without the runtime overhead and non-deterministic merges of complex CRDTs, VowPilot uses:
1. **Optimistic Concurrency Control (OCC)** with monotonic versioning.
2. **Server-Sent Events (SSE)** with reconnection cursor (`sinceVersion` / `Last-Event-ID`) and keepalive heartbeats.
3. **Database-backed Durability** adhering to a strict **persist-before-broadcast** pipeline.
4. **Cryptographically Secure Invitation Lifecycle** utilizing 256-bit entropy tokens stored exclusively as SHA-256 digests.
5. **Backend-Enforced Role-Based Access Control (RBAC)** providing verifiable least-privilege guarantees.

```
                          ┌────────────────────────┐
                          │   Client Coordinator   │
                          └───────────┬────────────┘
                                      │
              1. HTTP PUT /api/events/:id (with expectedVersion: V)
                                      ▼
                        ┌───────────────────────────┐
                        │   VowPilot HTTP Server    │
                        └─────────────┬─────────────┘
                                      │
                         2. Atomic SQLite Transaction
                            SELECT version FOR UPDATE
                                      │
                ┌─────────────────────┴─────────────────────┐
                │                                           │
         version == V                                version != V
                │                                           │
  3a. Increment version to V+1                3b. Rollback transaction
      Persist updated state                       Return HTTP 409 CONFLICT
                │                                 { expectedVersion, currentVersion,
                │                                   lastModifiedBy, serverState }
                ▼                                           ▲
  4. Broadcast to SSE Listeners                             │
     event: sync, id: V+1                                   │
                │                                           │
                ▼                                           │
    ┌───────────────────────┐                               │
    │ Remote Collaborators  │                               │
    │  (Active SSE Stream)  │                               │
    └───────────────────────┘                               │
                ▲                                           │
                └────────── Stale Client Reconciles ────────┘
```

---

## 2. Role & Permission Matrix (RBAC)

VowPilot defines three distinct roles for event collaboration. All authorization is enforced at the server controller and database repository levels; UI controls are dynamically adapted to optimize user experience but are never relied upon for system security.

| Capability / Operation | Owner | Editor | Viewer | Security Enforcement Point |
| :--- | :---: | :---: | :---: | :--- |
| **Inspect Event State & Telemetry** | Allowed | Allowed | Allowed | `eventRepository.getUserRole` / `app.ts` |
| **Subscribe to Live SSE Updates** | Allowed | Allowed | Allowed | `GET /api/events/:id/stream` (Auth & Member Check) |
| **Inspect Invitation Preview** | Allowed | Allowed | Allowed | `POST /api/events/invitations/inspect` (Pre-Auth) |
| **Decline Pending Invitation** | Allowed | Allowed | Allowed | `POST /api/events/decline` |
| **Accept Invitation & Join** | Allowed | Allowed | Allowed | `POST /api/events/join` |
| **Update Budget / Expenses** | Allowed | Allowed | **DENIED (403)** | `eventRepository.updateEvent` |
| **Add / Edit / Delete Tasks** | Allowed | Allowed | **DENIED (403)** | `eventRepository.updateEvent` |
| **Add / Edit / Delete Vendors** | Allowed | Allowed | **DENIED (403)** | `eventRepository.updateEvent` |
| **Select Vendor Proposal** | Allowed | Allowed | **DENIED (403)** | `eventRepository.updateEvent` |
| **Create Viewer Invitation** | Allowed | Allowed | **DENIED (403)** | `AuthPolicy.canCreateInvite` |
| **Create Editor Invitation** | Allowed | Allowed | **DENIED (403)** | `AuthPolicy.canCreateInvite` |
| **Create Owner Invitation** | Allowed | **DENIED (403)** | **DENIED (403)** | `AuthPolicy.canCreateInvite` (Privilege Escalation Guard) |
| **List Event Invitations** | Allowed | Allowed | **DENIED (403)** | `eventStore.listEventInvites` |
| **Revoke Active Invitation** | Allowed | **DENIED (403)** | **DENIED (403)** | `eventStore.revokeInvite` |
| **Remove Collaborator** | Allowed | **DENIED (403)** | **DENIED (403)** | `eventStore.removeMember` |
| **Delete Entire Event** | Allowed | **DENIED (403)** | **DENIED (403)** | `eventStore.deleteEvent` |
| **Dispatch Vendor Emails** | Allowed | Allowed | **DENIED (403)** | `emailService.dispatchVendorEmail` |

### Privilege Escalation Prevention
Editors cannot invite co-owners. If an editor submits `POST /api/events/:id/invites` with `{ role: 'owner' }`, the server terminates the request immediately with `HTTP 403 Forbidden: Only event owners can invite another owner.`

---

## 3. Cryptographically Secure Invitation Lifecycle

Invitations grant access to sensitive wedding financial figures and private guest records. VowPilot implements a zero-trust token lifecycle:

1. **High-Entropy Token Generation:**
   - Tokens are generated using `crypto.randomBytes(32).toString('hex')` providing 256 bits of cryptographic entropy.
   - Raw tokens are prefixed with `inv_` for identification.
2. **Digest-Only Persistence:**
   - Raw tokens are NEVER stored in persistent storage or logs.
   - Only the SHA-256 digest (`tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')`) is recorded in the `event_invitations` table. A memory dump or database leak cannot compromise active invite tokens.
3. **Inspection Before Acceptance:**
   - Invitees can preview the celebration name, inviter identity, role, and expiration timestamp via `POST /api/events/invitations/inspect` prior to accepting.
4. **Decline Protocol:**
   - When an invitee declines an invitation (`POST /api/events/decline`), the token is marked as consumed (`used = 1`) immediately without adding the user to `event_members`. Subsequent acceptance attempts are blocked.
5. **Immediate Revocation:**
   - Event owners can revoke any active invitation at any moment via `POST /api/events/:id/invites/revoke` or `DELETE /api/events/:id/invites/:tokenHash`.
6. **Replay & Concurrency Protection:**
   - Invitations are single-use (`used = 1`). Acceptance occurs within an atomic transaction. Replay attempts are rejected with `HTTP 409 / 400`.

---

## 4. Optimistic Concurrency Control (OCC)

Event planning involves simultaneous modifications to different aspects of an event (e.g., Coordinator A adds catering expenses while Coordinator B updates photography milestones).

### Concurrency Rules
1. **Authoritative Monotonic Versioning:**
   - Every event maintains an integer `version` initialized at `1`.
   - Any modifying request (`PUT /api/events/:id`) must include `expectedVersion`.
2. **Atomic Verification:**
   - The database updates the event if and only if `current_version == expectedVersion`.
   - On match, `version` advances to `version + 1`.
3. **Stale Write Rejection (No Silent Overwrites):**
   - If `current_version != expectedVersion`, the server aborts the transaction and returns:
     ```json
     {
       "code": "CONCURRENCY_CONFLICT",
       "error": "CONCURRENCY_CONFLICT",
       "message": "Version conflict: Your update was based on version 1, but the server is already at version 2.",
       "expectedVersion": 1,
       "currentVersion": 2,
       "lastModifiedBy": "Coordinator One",
       "serverState": { ... }
     }
     ```
4. **Deterministic Reconciliation:**
   - The UI presents a specialized **Conflict Resolution Modal** comparing local modifications with the server state.
   - The user can explicitly choose:
     - **Accept Server Version (Recommended):** Discards local unsaved edits and synchronizes with latest server state.
     - **Re-apply Local Changes:** Pulls remote version $V$, increments to $V$, and saves local changes on top.
   - Neither contribution is silently discarded.

---

## 5. Live Synchronization & Server-Sent Events (SSE)

### Persist-Before-Broadcast Guarantees
The broadcast pipeline strictly adheres to persist-before-broadcast. Updates are committed to persistent relational storage before being emitted to connected SSE subscribers. If the database transaction fails, no event is ever emitted.

### Connection & Reconnection Cursor Protocol
- Clients establish an SSE stream via `GET /api/events/:id/stream?token=<JWT>&sinceVersion=<V>`.
- The server emits frames with `id: <version>`.
- If a client disconnects (network blip, laptop sleep, tab backgrounding) and reconnects with `sinceVersion: 1` while the server has advanced to `version: 3`, the server detects the lag and immediately emits a `sync` event with the authoritative state.

### Keepalive Heartbeats & Resource Cleanup
- The server transmits a comment ping (`: keepalive\n\n`) every 15 seconds.
- When a socket closes (TCP FIN/RST or client disconnect), the listener cleanup callback removes the client from the active subscriber set, guaranteeing zero socket or memory leaks.

---

## 6. Distributed System Failure Modes & Resiliency

| Failure Scenario | System Behavior & Mitigation |
| :--- | :--- |
| **Network Partition / Temporary Drop** | SSE onerror triggers exponential backoff reconnection (1s to 10s cap). On reconnection, client supplies `sinceVersion` cursor to receive any missed intermediate updates. |
| **Server Crash & Restart** | Database is durable SQLite with WAL mode. All events, versions, and membership survive restarts. Clients automatically reconnect, verify auth, and catch up to latest version. |
| **Concurrent Stale Writes** | Rejected deterministically with HTTP 409 Conflict. OCC protects against accidental clobbering. |
| **Expired Authentication** | Client catches HTTP 401, sets status to `error`, stops synchronization, and prompts re-authentication. |
| **Cross-Tenant Snooping** | Tenant B receives HTTP 403 Forbidden when attempting to access or subscribe to Tenant A's event. |
| **Duplicate / Replay Requests** | Idempotency keys deduplicate vendor communication; version identifiers deduplicate SSE state updates. |

---

## 7. Consistency Guarantees & Known Limitations

### Formal Guarantees
- **Read-Your-Writes Consistency:** A client receiving HTTP 200 on an update is guaranteed to see their modifications in subsequent reads.
- **Monotonic Read Consistency:** A connected client will never observe an event version lower than a previously observed version.
- **Strict Serializability for State Updates:** Because updates occur within SQLite transactions with OCC check, all state modifications are totally ordered.
- **Single-Use Invitation Consumption:** An invitation token can never be redeemed by more than one account.

### Known Limitations & Trade-Offs
- **Full-State Synchronization vs. Field-Level Deltas:** The current implementation exchanges full state snapshots rather than operational transformation (OT) diffs. For weddings with thousands of line items, full state exchange incurs modest network bandwidth overhead.
- **Single-Process SSE Subscriptions:** The in-memory listener registry operates within a single server process. In a multi-node load-balanced deployment, a Redis Pub/Sub or Postgres LISTEN/NOTIFY bus would be required to fan out SSE broadcasts across cluster nodes.
- **Simultaneous Conflict Resolution:** If two coordinators both choose "Re-apply My Changes" simultaneously during a conflict, the second coordinator will encounter a second OCC conflict prompt, requiring sequential convergence.
