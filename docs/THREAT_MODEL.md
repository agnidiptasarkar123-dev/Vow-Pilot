# VowPilot: Threat Model & Application Attack Surface Analysis

**Application:** VowPilot (Client-Side Event Planning & Coordination)  
**Methodology:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)  
**Security Posture:** Zero-Trust Client-Side Architecture  
**Date:** October 24, 2026  

---

## 1. System Architecture & Trust Boundaries

```
[Untrusted External Sources]
   │
   ├── User Manual Form Inputs (Event Name, Notes, Custom Categories)
   ├── Imported JSON Backup Files (.json)
   └── Browser LocalStorage State (Unencrypted client store)
   │
   ▼
┌────────────────────────────────────────────────────────┐
│ APPLICATION TRUST BOUNDARY                             │
│                                                        │
│  1. Ingress Sanitization Layer                        │
│     - MAX_IMPORT_BYTES (5 MB Ceiling)                  │
│     - sanitizeText (Strips HTML tags & javascript: URI)│
│     - Prototype Pollution Key Guard                    │
│                                                        │
│  2. Structural & Relational Schema Validation          │
│     - validateStateSchema (Types, Enums, Uniqueness)   │
│     - Relational Foreign Key Integrity (Tasks, Quotes) │
│     - Dependency Cycle & Self-Cycle Checks             │
│                                                        │
│  3. Deterministic Domain Engines                       │
│     - Minor Unit Arithmetic (Paise / Cents)            │
│     - MAX_SAFE_MAJOR_AMOUNT Numeric Clamping           │
│     - Status Segregation & Capacity Checking           │
│                                                        │
│  4. Safe UI Presentation Layer                         │
│     - AST Tokenized Text Parser (renderSafeInline)     │
│     - Zero dangerouslySetInnerHTML                    │
│     - Sandboxed Modal Dialog Focus Traps               │
└────────────────────────────────────────────────────────┘
```

---

## 2. STRIDE Threat Analysis

| Threat Class | Potential Vector | Impact | Implemented Mitigation | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Tampering** | Malicious JSON backup modifying schema or injecting negative/overflow amounts | State corruption, unexpected zero division, mathematical drift | `validateStateSchema` enforces non-negative bounds, enum constraints, and relational consistency | **VERIFIED** |
| **Tampering** | Prototype pollution via `__proto__`, `constructor`, `prototype` in imported JSON | Polluting Object prototype leading to logic bypass or DoS | Explicit key blocking in schema validator rejects payload containing polluted keys | **VERIFIED** |
| **Tampering** | Dangling prerequisite IDs or circular task graphs | Infinite DFS recursion or uncompletable deadlocks | Cycle detection algorithm and foreign-key check reject missing prerequisite IDs | **VERIFIED** |
| **Information Disclosure** | LocalStorage containing sensitive user event data or financial details | Exposure on shared/public workstation | Clear warning in documentation that LocalStorage is unencrypted; zero credentials/secrets stored | **VERIFIED** |
| **Denial of Service** | Oversized JSON file upload (e.g. 50 MB) causing browser memory freeze | Client tab crash, memory exhaustion | `MAX_IMPORT_BYTES` enforces a strict 5 MB payload limit before parsing | **VERIFIED** |
| **Elevation of Privilege / Code Execution** | Cross-Site Scripting (XSS) via injected assistant or vendor strings (`<script>`, `<img onerror>`) | Arbitrary JavaScript execution in user browser context | Full removal of `dangerouslySetInnerHTML`; custom AST parser `renderSafeInline` renders markdown tokens natively | **VERIFIED** |

---

## 3. Data Sensitivity Classification

* **Public / Demo Data:** Sample Jaipur Wedding dataset (`Aarav & Meera`). Publicly documented and demarcated.
* **User-Generated Event Data:** Event dates, locations, guest counts, budgets, and supplier notes. Stored locally in the user's browser; never transmitted to external APIs or third-party servers.
* **Secrets / API Keys:** Zero secrets, cloud API keys, or database credentials are used or stored.

---

## 4. Supply Chain & Dependency Surface

* **Dependency Footprint:** Minimal direct dependencies: `clsx`, `lucide-react`, `react`, `react-dom`, `tailwind-merge`.
* **Vulnerability Auditing:** Continuous auditing via `npm audit` (0 known vulnerabilities detected).
* **Zero Post-Install Scripts:** Packages with executable installation scripts are isolated and verified.
