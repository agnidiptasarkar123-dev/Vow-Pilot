# VowPilot: Initial Repository Forensics and Baseline Audit

**Project:** VowPilot  
**Competition:** Prompt Wars Virtual — Challenge 5: Celebration and Event Planner  
**Auditor:** Principal Software Engineer & Adversarial Evaluator  
**Audit Date:** October 24, 2026  
**Repository Branch:** `main` (Clean working tree)  

---

## 1. Environment & Stack Baseline

* **Runtime:** Node.js v24.19.0, npm 11.17.0
* **Operating System:** macOS (Darwin 24.5.0)
* **Framework:** React 19.3.1, TypeScript 7.0.2, Vite 8.3.5
* **CSS:** Tailwind CSS v4.3.3 via `@tailwindcss/vite`
* **Test Runner:** Vitest 5.0.5 with JSDOM and `@testing-library/react` 16.3.3
* **Repository Size (Git Objects):** ~476 KiB (well below 10 MB ceiling)

---

## 2. Initial Test & Build Metrics

| Metric | Measured Baseline |
| :--- | :--- |
| **Test Suites** | 9 test files |
| **Executed Tests** | 62 passed / 62 total (100% pass rate) |
| **Execution Time** | 1.28 seconds |
| **TypeScript Errors** | 0 (`tsc --noEmit` exit code 0) |
| **Production Build** | Clean in 193 ms |
| **Bundle Size** | JS: 410.92 kB (gzip: 113.00 kB); CSS: 33.53 kB (gzip: 7.15 kB) |
| **npm Audit Vulnerabilities** | 0 vulnerabilities found |

---

## 3. Initial Structural Forensics & Findings

### Strengths
1. **Separation of Concerns:** Business logic is implemented in pure TypeScript modules (`src/domain/`) without React dependencies, allowing deterministic unit testing.
2. **Minor Currency Units:** Integer minor units (paise/cents) are used across all calculations, preventing floating-point arithmetic drift.
3. **Graph Dependency Engine:** A Depth-First Search algorithm detects cyclic dependencies in task planning and provides cycle path diagnostics.
4. **Sandboxed Decision Simulator:** A dedicated simulation sandbox models variations without mutating baseline event state.
5. **Robust Jaipur Demo Dataset:** An internally consistent dataset with 6 categories, 5 expenses, 6 tasks, 5 vendors, and 5 quotes is provided for immediate evaluation.

### Deficiencies Identified Prior to Expansion
1. **Test Volume Below Competitive Benchmark:** Although 62 tests cover core paths, the test suite needs to scale to 1,000+ to 1,500+ independent test cases to thoroughly stress edge cases, arithmetic overflow, DAG permutations, and input fuzzing.
2. **Unexercised Assistant Intent Handlers:** Several intent branches in `assistantEngine.ts` (e.g., `find_overdue_tasks`, `explain_blocked_tasks`, `compare_vendor_quotes`) were only exercised through fallback or partial tests, leaving branch coverage at ~48.9%.
3. **Missing Property-Based Invariant Assertions:** Invariants (e.g. monotonicity of guest-count scaling, cycle detection completeness, JSON round-trip stability) were tested on discrete examples rather than randomized property spaces.
4. **Documentation Gaps:** Dedicated security threat models, accessibility checklists, and formal evaluation rubrics were missing from the repository.

---

## 4. Remediation Plan

1. Install `fast-check` and `@vitest/coverage-v8` for property-based testing and coverage analysis.
2. Create comprehensive parameterized test suites across currency, budgeting, tasks, vendors, assistant, persistence, and simulator domains.
3. Attain >90% statement coverage across all domain and persistence modules.
4. Produce formal compliance documents in `docs/`.
