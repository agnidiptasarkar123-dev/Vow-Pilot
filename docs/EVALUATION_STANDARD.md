# VowPilot: Official Competition Evaluation Standard

**Competition:** Prompt Wars Virtual — Challenge 5: Celebration and Event Planner  
**Role:** Independent Senior Hackathon Evaluator & Principal Software Engineer  
**Standard Version:** 1.0.0 (Strict Adversarial Benchmark)  
**Date:** October 24, 2026  

---

## 1. Evaluation Philosophy & Rules of Engagement

1. **Zero Assumption of Correctness:** No claim in documentation, comments, or UI copy is accepted as truth until independently verified through automated tests, execution logs, or code inspection.
2. **Adversarial Scrutiny:** Every module is probed for boundary failures, arithmetic overflow, state corruption, race conditions, type unsoundness, and security bypasses.
3. **Execution Over Embellishment:** Evaluation rewards demonstrated functional completeness, algorithmic rigor, state integrity, and user safety over superficial visual novelties or cosmetic claims.
4. **Transparent Verification Tiers:**
   * **VERIFIED:** Proven by passing, independently asserted automated tests or concrete tool outputs.
   * **PARTIALLY VERIFIED:** Functionally present and verified in unit tests, but lacking live browser/device confirmation due to headless environment constraints.
   * **UNVERIFIED:** Claimed in documentation but lacking automated test evidence or executable proof.
   * **FAILED:** Demonstrably broken, contradictory, or vulnerable under adversarial inputs.

---

## 2. Core Functional Evaluation Dimensions (0 to 10 Scale)

An evaluation score of 10/10 is reserved exclusively for implementations that satisfy every rigorous criterion without defect or unhandled edge case.

### Dimension 1: Problem Statement Alignment (Weight: High)
* **10/10 Requirement:** Seamlessly assists an organizer from initial event foundation through budgeting, scheduling, supplier comparison, simulation, and execution coordination without generic advice.
* **Evidence Required:** Code and tests mapping directly to Challenge 5 vertical requirements.

### Dimension 2: Functional Completeness (Weight: High)
* **10/10 Requirement:** All 6 core challenge capabilities (Needs Assessment, Budget Allocations, Task Dependencies, Vendor Matrix, Grounded Assistant, Decision Simulator) are completely implemented and navigable in the UI.

### Dimension 3: Business Logic & Mathematical Correctness (Weight: High)
* **10/10 Requirement:** 
  - Minor-currency unit arithmetic strictly immune to floating-point drift.
  - Cost statuses strictly segregated (`estimated`, `quoted`, `confirmed`, `actual`).
  - Graph dependency cycle detection (DFS) with full cycle path diagnostics.
  - Strict prerequisite blocking rule: blocked tasks cannot be marked completed.
  - Guest-count variable expense scaling and venue capacity checks.

### Dimension 4: Code Quality & Architecture (Weight: Medium)
* **10/10 Requirement:** Clean modular architecture separating pure domain engines from React state and presentation. Strict TypeScript without `any` casts or type suppression.

### Dimension 5: Application Security & Input Boundary Defense (Weight: High)
* **10/10 Requirement:**
  - Zero arbitrary HTML or script injection vectors (no `dangerouslySetInnerHTML`).
  - Strict payload limits on imports (5 MB ceiling).
  - Immunity to prototype pollution attacks.
  - Relational foreign-key verification (no dangling prerequisite IDs, self-cycles, or orphaned categories).

### Dimension 6: Automated Test Quality & Reliability (Weight: High)
* **10/10 Requirement:** Minimum 1,000+ independently asserted, meaningful automated tests combining unit, parameterized, property-based, and end-to-end integration journeys. High statement (>90%) and branch (>80%) coverage in domain logic.

### Dimension 7: State Integrity & Persistence (Weight: Medium)
* **10/10 Requirement:** Schema-versioned LocalStorage with automatic migration and graceful corruption fallback. Decision simulator sandboxing that strictly preserves baseline state until explicit confirmation.

### Dimension 8: Accessibility & Usability (Weight: Medium)
* **10/10 Requirement:** WCAG 2.1 AA design: modal keyboard focus traps, programmatic form associations, accessible button names, and multi-channel status indicators.

### Dimension 9: Performance & Resource Efficiency (Weight: Low)
* **10/10 Requirement:** Sub-second production build, repository footprint strictly under 10 MB, and lean client-side execution with zero external server latencies.

### Dimension 10: Documentation & Reproducibility (Weight: Medium)
* **10/10 Requirement:** Deterministic reproduction instructions, requirement-to-code traceability matrix, threat model, and honest limitation disclosures.

### Dimension 11: Deployment Readiness (Weight: Medium)
* **10/10 Requirement:** Clean static production build (`dist/`), zero build warnings, zero security vulnerabilities in `npm audit`.

### Dimension 12: Demonstration & Submission Readiness (Weight: High)
* **10/10 Requirement:** Internally consistent, clearly disclosed Jaipur wedding sample dataset allowing immediate end-to-end evaluation without manual data entry.

---

## 3. Severity Classification for Findings

* **BLOCKER:** Breaks core workflow, corrupts state irreversibly, or introduces severe remote code execution.
* **CRITICAL:** High-severity security vulnerability, arithmetic calculation error in budgets, or failure of dependency blocking rule.
* **HIGH:** Broken edge case in graph algorithms, multi-currency skew, or unhandled promise rejection in common workflow.
* **MEDIUM:** Missing ARIA attribute, incomplete form error feedback, or minor edge-case inconsistency.
* **LOW:** Typographical inconsistency or minor style flaw.
* **INFORMATIONAL:** Architecture observation or environment limitation.
