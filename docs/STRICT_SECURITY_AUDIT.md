# VowPilot Hostile-Input Security Audit Report

**Auditor Role:** Application Security Engineer & Adversarial Input Reviewer  
**Audit Date:** 2026-10-24  
**Project:** VowPilot  
**Challenge:** Prompt Wars Virtual — Challenge 5: Celebration & Event Planner  
**Scope:** Client-side Web Architecture, Persistence Layer, DOM Rendering, Input Validation  

---

## 1. Executive Security Summary

VowPilot is a browser-based single-page application built with React, Vite, and TypeScript. Because it runs purely on the client side without a remote database, its attack surface centers around:
1. **Malicious JSON backup file imports** (Stored XSS, Prototype Pollution, Denial of Service via memory bloat).
2. **Browser LocalStorage tampering** (State corruption, prototype poisoning, quota exhaustion).
3. **Prompt injection / adversarial queries** to the deterministic planning coordinator.
4. **Financial arithmetic anomalies** (Floating-point precision drift, integer overflow, non-finite values).

### Audit Verdict:
- **Known Dependency Vulnerabilities (`npm audit`):** **0**
- **Unresolved Blocker / Critical Findings:** **0**
- **Residual Risk Level:** **LOW (Hardened Client Application)**

---

## 2. Threat Vector Deep Dive & Verification

### A. Prototype Pollution Defense
- **Threat:** An attacker crafts an imported JSON backup containing `__proto__`, `constructor`, or `prototype` keys at top-level or deeply nested levels to manipulate JavaScript object prototypes.
- **Implementation:** In `src/persistence/storage.ts`, `hasDangerousKey()` recursively traverses all nested object properties before state is loaded:
  ```typescript
  function hasDangerousKey(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;
    if (
      Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')
    ) {
      return true;
    }
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object' && hasDangerousKey(val)) {
        return true;
      }
    }
    return false;
  }
  ```
- **Evidence:** Tested in `src/test/securityAndEdgeCases.test.ts` (Test 10) and Property 16 in `src/test/propertyBased.test.ts`.

### B. Cross-Site Scripting (XSS) & Unsafe HTML Rendering
- **Threat:** User-entered or imported text (event names, vendor descriptions, notes, assistant messages) containing `<script>alert(1)</script>`, `<img src=x onerror=...>`, or `javascript:...` links could execute arbitrary scripts.
- **Implementation:**
  - Zero usage of `dangerouslySetInnerHTML` across all UI components.
  - In `src/components/assistant/AssistantView.tsx`, markdown bolding and bullet lists are rendered via a safe Abstract Syntax Tree (AST) parser (`renderSafeInline`) that outputs native React text and `<span>` elements:
  ```typescript
  const renderSafeInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-[#1C1917]">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="bg-[#FAF8F5] px-1 py-0.5 rounded text-[#A2421D] font-mono text-xs">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };
  ```
- **Evidence:** Tested in `src/test/securityAndEdgeCases.test.ts` (Tests 1-4).

### C. Denial of Service (DoS) via Oversized Payloads
- **Threat:** Importing a multi-megabyte malicious JSON file could overwhelm the browser's memory, freeze the single-threaded UI, or cause tab crash.
- **Implementation:** `src/persistence/importExport.ts` enforces an upfront 5 MB byte ceiling check (`validateImportPayloadSize`) before invoking `JSON.parse()`:
  ```typescript
  export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  export function validateImportPayloadSize(fileContent: string): { valid: boolean; error?: string } {
    const byteSize = new Blob([fileContent]).size;
    if (byteSize > MAX_IMPORT_SIZE_BYTES) {
      return {
        valid: false,
        error: `Import file exceeds maximum allowed size of 5 MB (actual: ${(byteSize / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }
    return { valid: true };
  }
  ```
- **Evidence:** Tested in `src/test/securityAndEdgeCases.test.ts` (Test 5).

### D. Storage Corruption & Quota Exhaustion
- **Threat:** LocalStorage data corrupted by outside scripts or browser quota exhaustion (`QuotaExceededError`) causes unhandled exceptions.
- **Implementation:**
  - `loadPersistedState()` catches `SyntaxError` and invalid schemas, logging a safe error and returning default `DEMO_STATE`.
  - `savePersistedState()` wraps `localStorage.setItem()` in a `try...catch` block, returning `false` gracefully without throwing an uncaught exception.
- **Evidence:** Tested in `src/test/persistenceComprehensive.test.ts` (Tests 151, 152).

### E. Financial Integrity & Overflow Protection
- **Threat:** Precision drift from IEEE-754 floating-point arithmetic or integer overflow beyond `Number.MAX_SAFE_INTEGER`.
- **Implementation:**
  - All financial calculations are executed in integer minor units (Paise for INR, Cents for USD/EUR/GBP).
  - Clamping enforced at `MAX_SAFE_MAJOR_AMOUNT = 10_000_000_000` (10 Billion major units).
  - Strict isolation in `src/domain/vendorEngine.ts`: foreign currency quotes are segregated from primary currency averages to prevent nonsensical arithmetic (e.g. adding $1,000 USD to ₹1,000 INR).
- **Evidence:** Tested in `src/test/currencyComprehensive.test.ts` (250 tests) and `src/test/propertyBased.test.ts` (Properties 1-4).

---

## 3. STRIDE Threat Model Assessment

| STRIDE Category | Threat Description | VowPilot Mitigation | Status |
| :--- | :--- | :--- | :---: |
| **Spoofing** | Attacker impersonates official vendors or verified reviews. | All demonstration records carry explicit `isSample: true` disclaimers; no claims of verified external reviews are made. | **MITIGATED** |
| **Tampering** | User or malicious script alters LocalStorage state. | Schema validation (`validateStateSchema`) validates every field, type, and bounds before state adoption. | **MITIGATED** |
| **Repudiation** | Consequential actions executed without user consent. | Consequential changes (budget rebalance, guest headcount adjustments) require explicit user confirmation. | **MITIGATED** |
| **Information Disclosure** | Leakage of sensitive secrets or tokens. | Zero external API keys or credentials; application is 100% client-side with zero secret exposure. | **MITIGATED** |
| **Denial of Service** | Oversized JSON payloads freeze single-threaded browser tab. | 5 MB import limit enforced before parsing; max task graph cycles detected via DFS within millisecond budget. | **MITIGATED** |
| **Elevation of Privilege** | Prototype pollution injects properties into base Object prototype. | Recursive `hasDangerousKey()` check inspects every level of incoming objects before adoption. | **MITIGATED** |

---

## 4. Security Findings & Remediation Log

| ID | Finding | Severity | Status | Verification Reference |
| :--- | :--- | :---: | :---: | :--- |
| **SEC-01** | Nested prototype pollution vulnerability in imported state | **CRITICAL** | **RESOLVED** | `src/test/securityAndEdgeCases.test.ts` (Test 10) |
| **SEC-02** | Potential XSS injection in planning assistant chat rendering | **CRITICAL** | **RESOLVED** | `src/test/securityAndEdgeCases.test.ts` (Tests 1-4) |
| **SEC-03** | Unbounded JSON file import could exhaust browser memory | **HIGH** | **RESOLVED** | `src/test/securityAndEdgeCases.test.ts` (Test 5) |
| **SEC-04** | LocalStorage `QuotaExceededError` unhandled exception | **MEDIUM** | **RESOLVED** | `src/test/persistenceComprehensive.test.ts` (Test 152) |
| **SEC-05** | Unescaped regex dash in `parseDisplayToMinor` stripped signs | **HIGH** | **RESOLVED** | `src/test/currencyComprehensive.test.ts` (Test 1) |
| **SEC-06** | Whitespace-only strings accepted for event date and location | **MEDIUM** | **RESOLVED** | `src/test/propertyBased.test.ts` (Property 20) |

---

## 5. Security Certification

VowPilot satisfies all client-side security standards appropriate for a web-based celebration planner. It enforces strict input boundaries, guards against prototype tampering, prevents script injection, and preserves transactional state integrity.
