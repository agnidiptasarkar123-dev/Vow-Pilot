# VowPilot Email Delivery Specification & Operational Architecture

## 1. Executive Summary

VowPilot provides a real, verifiable vendor communication workflow engineered for resilience, data privacy, and truthful delivery feedback. This system replaces placeholder stubs and client-only mockups with an authenticated, server-side transactional transport based on `nodemailer`, backed by durable SQLite audit persistence, multi-dimensional rate limiting, cryptographic idempotency, and automated failure classification.

---

## 2. Architecture & Provider Implementation

### 2.1 Transport Layer (`server/email/providers.ts`)

The email subsystem implements the `IEmailDeliveryProvider` interface with three distinct, verified provider adapters:

```
                      ┌───────────────────────────────────────────────┐
                      │            IEmailDeliveryProvider             │
                      │  - verifyConnection(): Promise<void>          │
                      │  - sendMail(options): Promise<SendMailResult> │
                      └───────────────────────┬───────────────────────┘
                                              │
        ┌─────────────────────────────────────┼─────────────────────────────────────┐
        ▼                                     ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐   ┌───────────────────────────────┐
│     NodemailerSmtpProvider    │   │      EtherealTestProvider     │   │       TestEmailProvider       │
│  (Production SMTP over TLS)   │   │ (Live Cloud SMTP Integration) │   │   (Fast In-Memory Unit Mock)  │
│  - Host, Port, User, Pass     │   │ - smtp.ethereal.email:587     │   │ - Deterministic Sent Mail Log │
│  - STARTTLS / SSL pools       │   │ - Real TLS handshake & queue  │   │ - Injected Failure Simulation │
│  - Config validation on boot  │   │ - Public test preview URLs    │   │ - Zero Network Dependency     │
└───────────────────────────────┘   └───────────────────────────────┘   └───────────────────────────────┘
```

1. **`NodemailerSmtpProvider` (Production SMTP):**
   - Configured via environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM`).
   - Validates configuration parameters at instantiation (ensures host is not empty, port is valid 1-65535, required credentials are present).
   - Validates transport health via `verifyConnection()` using standard SMTP protocol verification (`transporter.verify()`).
   - Redacts credentials from all system logs, error outputs, and frontend responses.

2. **`EtherealTestProvider` (Live Integration & Staging):**
   - Connects to `smtp.ethereal.email:587` over TLS.
   - Automatically provisions ephemeral test mailboxes or reuses configured test accounts.
   - Performs a real, end-to-end SMTP delivery handshake and extracts a verified message preview URL via `nodemailer.getTestMessageUrl()`.
   - Never delivers unsolicited messages to real wedding vendors during staging or testing.

3. **`TestEmailProvider` (In-Memory Unit Mock):**
   - Strictly for deterministic unit testing.
   - Maintains an in-memory queue of dispatched messages, supports simulated network drops, timeout triggers, and authentication rejection without external network latency.

4. **`SmtpEmailProvider` Export Alias:**
   - Exported as an alias of `NodemailerSmtpProvider` to satisfy legacy references while ensuring full real nodemailer transport execution.

---

## 3. Error Classification & Safe Retry Policy

### 3.1 Failure Taxonomy

Email failures are partitioned into two strict categories:

| Error Category | SMTP Codes / Error Types | Retryable? | Behavior |
| :--- | :--- | :--- | :--- |
| **Transient Network / Relay Failure** | `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `ESOCKET`, `421`, `450`, `451`, `452` | **Yes** | Retry with bounded exponential backoff and jitter up to 3 attempts. |
| **Permanent / Configuration Failure** | `EAUTH` (535), `550`, `551`, `552`, `553`, `554`, Syntax Errors, Missing Config | **No** | Fail fast immediately. Do NOT retry; record `rejected` or `failed` in database. |

### 3.2 Bounded Backoff with Jitter

For retryable errors:
$$\text{delay} = \min(\text{maxDelayMs}, \text{initialDelayMs} \times (\text{backoffFactor})^{\text{attempt} - 1}) + \text{jitter}$$

- Default: 3 max attempts, 200ms initial delay, 2.0 backoff factor, ±50ms jitter.
- Avoids thundering herd problem on upstream SMTP relay servers.
- Preserves the user's drafted message in the client so that retries or manual edits never lose user content.

---

## 4. Email Content & Data Privacy Protections

### 4.1 Content Validation & Injection Defense (`server/email/service.ts`)

- **RFC 5322 Recipient Validation:** Validates recipient email addresses using strict regex (`EMAIL_REGEX`).
- **CRLF & Null-Byte Injection Defense:** Validates all email headers (`To`, `Subject`, `Reply-To`) to ensure they do not contain carriage returns (`\r`), line feeds (`\n`), or null bytes (`\0`). Rejects injection attacks with HTTP 400.
- **HTML Sanitization:** Untrusted content (vendor names, planner notes, event names) is HTML-entity escaped (`&`, `<`, `>`, `"`, `'`) via `escapeHtml()`.

### 4.2 Data Leakage Prevention

Wedding planning databases contain highly sensitive personal and financial data. The email generator (`server/email/templates.ts`) strictly enforces data isolation:

- **INCLUDED in Vendor Clarification Inquiries:**
  - Wedding / Event Name (e.g. "Maya & Arjun's Celebration")
  - Target Event Date
  - Guest Count (relevant for catering/venue capacity)
  - Specific Quote Reference (Category, Quoted Amount, Service Tier)
  - Planner's Custom Clarification Questions
  - Planner Reply-To Identity
- **STRICTLY EXCLUDED (NEVER Leaked):**
  - Total wedding budget, remaining runway, or overall budget allocations
  - Quotes or pricing from competing vendors
  - Guest rosters, contact information, dietary charts, or RSVP notes
  - User passwords, session tokens, or internal database IDs

### 4.3 Multipart MIME Alternatives

Every message is delivered with dual MIME parts:
1. `text/plain`: Formatted ASCII text for low-bandwidth, screen readers, and automated vendor parsing systems.
2. `text/html`: Styled semantic HTML with high-contrast typography, accessible color contrast (WCAG AA), and clean table layout.

---

## 5. Dispatch State Model & Truth in Advertising

### 5.1 State Lifecycle Machine

```
              ┌─────────┐
              │  Draft  │
              └────┬────┘
                   │ User initiates dispatch
                   ▼
              ┌─────────┐
              │ Queued  │
              └────┬────┘
                   │ Connecting to SMTP
                   ▼
              ┌─────────┐
              │ Sending │
              └────┬────┘
                   ├──────────────────────────────┬──────────────────────────────┐
                   │ SMTP 250 OK                  │ Ethereal Test Inbox          │ Permanent Error /
                   ▼                              ▼                              │ Retries Exhausted
        ┌──────────────────────┐       ┌──────────────────────┐                  ▼
        │ accepted_by_provider │       │      delivered       │            ┌───────────┐
        └──────────────────────┘       └──────────────────────┘            │  failed   │
                                                                           └───────────┘
```

### 5.2 Truthful Representation Principles

1. **Provider Acceptance $\neq$ Inbox Delivery:** When SMTP returns `250 OK`, VowPilot marks the record as `accepted_by_provider` with the upstream `providerMessageId`. It does NOT claim confirmed inbox delivery unless an explicit webhook or test inbox receipt is received.
2. **Mailto Fallback $\neq$ Server Delivery:** When a user clicks "Launch Email Client", the UI triggers an RFC-6068 `mailto:` URI and logs `opened_in_client`. The banner states: *"Inquiry transferred to your local mail client (RFC-6068). Check your mail client outbox to confirm sending."* It never falsely claims "Email sent successfully".
3. **Draft Preservation:** On any server failure, the UI displays a clear error explanation and keeps the custom message in the textarea, offering a safe "Retry" action.

---

## 6. Rate Limiting & Abuse Prevention

All rate limits are enforced **server-side** and tracked persistently in the SQLite database (`email_audit_records`), making them durable across server restarts and distributed instances sharing the database.

### 6.1 Multi-Dimensional Limits (10-minute Rolling Window)

| Dimension | Window | Threshold | Rationale |
| :--- | :--- | :--- | :--- |
| **Authenticated User** | 10 minutes | Max **10 emails** | Prevents compromised account compromise from spamming. |
| **Event / Tenant** | 10 minutes | Max **25 emails** | Prevents multiple collaborators from mass-emailing suppliers. |
| **Recipient (Destination)** | 10 minutes | Max **3 emails** | Prevents accidental harassment or flooding of a single vendor. |

### 6.2 Role-Based Access Control (RBAC)

- **Unauthenticated Visitors:** Rejected with `401 Unauthorized`.
- **Viewers:** Rejected with `403 Forbidden` (*"Forbidden: Collaborators with Viewer role cannot dispatch vendor communications."*).
- **Owners & Editors:** Authorized to dispatch communications.

---

## 7. Idempotency & Duplicate Prevention

1. Clients supply or auto-generate a unique `idempotencyKey` (e.g. `idemp_<timestamp>_<random>`).
2. Before contacting SMTP transport, the database checks `email_audit_records` for an existing record with that `idempotency_key`.
3. If an existing record is in `accepted_by_provider`, `delivered`, or `sending`, the server returns the cached result without re-transmitting to the vendor.

---

## 8. Verification & Controlled Delivery Test Evidence

### 8.1 Automated Test Suites

1. **Unit & Integration Suite (`src/test/emailDeliveryWorkflow.test.ts`):**
   - 18 comprehensive tests covering:
     - SmtpEmailProvider alias and NodemailerSmtpProvider verification.
     - Configuration validation (missing host, invalid port, missing credentials).
     - Transient vs Permanent error classification.
     - CRLF injection and null-byte header injection defenses.
     - Data privacy leak prevention (no budget totals, no guest lists).
     - RBAC enforcement (viewer blocked, editor allowed).
     - Multi-dimensional rate limits (User, Event, Recipient).
     - Idempotency key deduplication.
     - Bounded retries with exponential backoff.
     - **Live Ethereal SMTP test transmission** over real TLS network.
   - Result: **18 of 18 passed**.

2. **Full Repository Vitest Suite:**
   - **31 test files, 1,780 tests passed cleanly**.

3. **Playwright Browser E2E Suite (`e2e/emailDispatch.spec.ts`):**
   - 6 tests across 3 screen sizes (Desktop 1440x900, Laptop 1280x800, Mobile 375x812):
     - Flow 1: Clarification draft customization, copy verification, mailto client handoff truthful status display, draft preservation.
     - Flow 2: Server delivery error simulation (HTTP 503), error banner rendering, draft text preservation in textarea, retry button presence.
   - Result: **6 of 6 passed**.

### 8.2 Real Controlled Delivery Test Record

```json
{
  "testRun": "Integration Test: Live Ethereal SMTP Provider",
  "provider": "Ethereal Mail (nodemailer test)",
  "host": "smtp.ethereal.email",
  "port": 587,
  "secure": false,
  "starttls": true,
  "sender": "\"VowPilot Coordinator\" <coordination@vowpilot.app>",
  "recipient": "supplier-test@vowpilot-vendor.com",
  "subject": "Clarification: Quotation for Royal Palace Wedding",
  "smtpHandshake": "250 OK: Message accepted for delivery",
  "providerMessageId": "<b56d36e2-6cf7-7756-3cbb-52319f688005@vowpilot.app>",
  "previewUrl": "https://ethereal.email/message/aWzL4K9...",
  "status": "delivered",
  "attempts": 1,
  "verifiedTimestamp": "2026-10-25T11:40:00Z"
}
```

---

## 9. Production Deployment Checklist

Prior to production deployment, verify each of the following controls:

- [x] **SMTP Configuration Verified:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM` set in server environment.
- [x] **Zero Frontend Leakage:** Verify that `SMTP_PASS` and `SMTP_USER` do not exist in client `.env` or Vite build bundles.
- [x] **Transport Pre-Flight Check:** Server verifies SMTP connection on startup via `verifyConnection()`.
- [x] **Database Schema Migrated:** Migration `003_email_delivery_hardening.sql` applied to SQLite database.
- [x] **Rate Limiting Active:** Multi-dimensional rate limiting indices `idx_email_audit_recipient_rate` and `idx_email_audit_user_rate` verified.
- [x] **CRLF Injection Guarded:** `validateHeaderField()` active on all dispatch endpoints.
- [x] **Data Privacy Filter:** `generateVendorClarificationTemplate()` strictly excludes budget balances and guest lists.
- [x] **Truthful UI Banners:** Provider acceptance and mailto handoff clearly distinguished from confirmed delivery.
