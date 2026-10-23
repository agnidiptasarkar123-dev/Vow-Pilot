# VowPilot

> **Plan with clarity. Coordinate with confidence.**

VowPilot is an intelligent, deterministic event-planning and coordination system built for **Prompt Wars Virtual — Challenge 5: Celebration and Event Planner**.

Unlike generic conversational chatbots or vague idea generators, VowPilot behaves like an experienced planning coordinator. It gathers verified constraints, segregates cost commitments, detects dependency cycles, models trade-offs in an interactive decision simulator, and tracks real-time budget runway.

---

## 1. Project Title and Purpose

* **Product Name:** VowPilot
* **Tagline:** *Plan with clarity. Coordinate with confidence.*
* **Purpose:** Turn complex, fragmented event requirements into an actionable, constraint-aware execution plan. Help organizers understand the ripple effects of every planning decision across budgets, schedules, venue limits, and vendor contracts.

---

## 2. Problem Statement & Target Persona

### Primary Persona
An individual organizing a wedding, milestone birthday, anniversary, or corporate celebration with a fixed budget, multiple stakeholder requirements, limited time, and several suppliers to coordinate.

### Core Problem
Event organizers often make decisions in isolation. Adding 20 guests, upgrading a photographer, or choosing a different venue layout causes cascading impacts across catering per-guest costs, sound curfew compliance, task deadlines, and financial buffers. VowPilot eliminates isolated decision-making by anchoring every calculation to a single source of truth.

---

## 3. Chosen Challenge Vertical

* **Challenge:** Prompt Wars Virtual — Challenge 5: Celebration and Event Planner
* **Vertical:** Full-Lifecycle Event Planning, Budget Allocation, Vendor Coordination, and Decision Impact Simulation.

---

## 4. Main Features

### A. Interactive Needs Assessment Wizard
* Multi-step guided onboarding (Core Foundation ➔ Dining & Atmosphere ➔ Venue & Accessibility ➔ Priority Ranking ➔ Confirmation).
* Enforces strict validation: rejects negative budgets, zero/negative guest counts, and dates in the past.
* Contextual follow-up prompts (e.g., automatically flags large-attendance protocol when headcount exceeds 200).
* Retains all entered state during back/forward navigation and allows future editing.

### B. Budget and Trade-Off Engine
* Strict segregation of cost statuses: **Estimated**, **Quoted**, **Confirmed**, and **Actual (Paid)**. Costs are never silently blended.
* Arithmetic safety using integer minor currency units (paise/cents) to eliminate floating-point drift.
* Dynamic guest-count cost scaling for variable categories (e.g., catering, favors).
* Real-time budget overrun detection and uncommitted runway tracking.
* Priority-aware reduction suggestions: automatically shields #1 priorities and suggests non-committed headroom cuts from lowest-ranked categories first.

### C. Dependency-Aware Task & Scheduling Graph
* Real-time status workflow: `not_started`, `in_progress`, `completed`, `blocked`.
* **Blocking Rule:** A task cannot be marked complete if any prerequisite task remains incomplete.
* **Cycle Detection:** Depth-First Search (DFS) algorithm actively prevents direct and indirect circular dependencies with cycle path reporting.
* **Deadline Realism:** Detects tasks scheduled after the event date or scheduled earlier than their prerequisite tasks.
* **Cascading Risk Analysis:** Warns when a delayed task jeopardizes dependent milestones.
* **Priority Rationale:** Explains transparently why a task holds `critical`, `high`, or `medium` priority.

### D. Vendor Coordination & Quotation Matrix
* Directory supporting suppliers, service categories, contact details, and itemized proposals.
* Side-by-side quotation comparison matrix displaying price variance against category averages.
* **Missing Details Detector:** Automatically audits quotes for missing validity expiration dates, absent exclusions, or omitted payment schedules.
* **Clarification Inquiry Drafter:** One-click generator creating professional, courteous inquiry messages ready to copy to clipboard.
* Clear visual demarcation of demonstration supplier records with `Fictional Demonstration Record` tags.

### E. Context-Aware Planning Assistant
* Connected directly to live event state and domain engines.
* Interprets 11 supported intents with deterministic, transparent rules:
  1. `explain_budget` — Comprehensive breakdown of committed vs flexible funds.
  2. `change_guest_count` — Instant financial and capacity impact analysis.
  3. `reduce_budget` / `suggest_expense_reductions` — Priority-aware trimming proposals.
  4. `protect_priority` — Shields top-ranked categories from automatic budget cuts.
  5. `find_overdue_tasks` — Immediate list of overdue milestones.
  6. `explain_blocked_tasks` — Shows exact prerequisite blockers.
  7. `compare_vendor_quotes` — Summarizes category quotations.
  8. `identify_missing_vendor_info` — Highlights incomplete supplier proposals.
  9. `create_budget_scenario` — Directs users to the simulator.
  10. `summarize_plan` — Executive milestone and budget readiness briefing.
  11. `unsupported` — Honest explanation of system boundaries.
* **Action Boundaries:** Requires explicit user confirmation before applying consequential modifications (e.g. guest headcount updates).

### F. Decision Impact Simulator Sandbox
* Dedicated what-if modeling sandbox that **never mutates confirmed plans** without explicit confirmation.
* Interactive guest count slider with immediate venue capacity limit checking.
* Dynamic category budget adjusters with live delta calculations.
* Variance analysis: displays current spend, simulated spend, net difference, and revised remaining runway.
* Save, name, compare, and revert alternative budget scenarios.

### G. Client-Side Persistence & Data Portability
* Versioned schema (`v1`) with migration strategy.
* Corrupted/malformed LocalStorage recovery with safe fallback to default demo state.
* JSON Backup Export and verified JSON Backup Import with text sanitization.
* Demo reset button with confirmation dialogue.
* Local storage memory footprint audit.

---

## 5. Architecture & Code Structure

```
virtual/
├── src/
│   ├── types/               # Strict TypeScript domain types (Event, Task, Vendor, Budget)
│   ├── domain/              # Pure, independently testable business logic engines
│   │   ├── currency.ts      # Minor unit conversions, currency formatting, parsers
│   │   ├── budgetEngine.ts  # Allocations, committed actuals, guest scaling, scenarios
│   │   ├── taskEngine.ts    # Cycle detection (DFS), blockers, deadline realism, risk
│   │   ├── vendorEngine.ts  # Quote comparison, missing info detector, clarification drafter
│   │   └── assistantEngine.ts # Deterministic intent parser, proposals, confirmation
│   ├── persistence/         # Data layer & storage handlers
│   │   ├── storage.ts       # LocalStorage schema v1, migration, safe fallback
│   │   ├── demoData.ts      # Internally consistent Jaipur Wedding demo event
│   │   └── importExport.ts  # JSON export and import validator
│   ├── context/
│   │   └── EventContext.tsx # Central state dispatcher, change logger, and persistence sync
│   ├── components/          # Refined editorial UI components
│   │   ├── common/          # Header, accessible Modal, Badges, Tabs
│   │   ├── landing/         # Welcome hero & pillar cards
│   │   ├── assessment/      # 5-step interactive needs assessment wizard
│   │   ├── dashboard/       # Actionable overview with metrics and alert banners
│   │   ├── budget/          # Allocations table, expense logger, priority cuts
│   │   ├── simulator/       # Decision impact sandbox with live diffs
│   │   ├── tasks/           # Dependency list, cycle alerts, prerequisite badges
│   │   ├── vendors/         # Supplier matrix, missing details audit, draft modal
│   │   ├── assistant/       # Coordinator chat feed with action confirmation cards
│   │   └── settings/        # Event constraints editor, JSON backup, storage audit
│   ├── test/                # Automated Vitest test suites (100% passing)
│   ├── App.tsx              # Root application router
│   ├── main.tsx             # DOM mounting point
│   └── index.css            # Editorial typography & theme variables
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 6. Technology Stack

* **Frontend:** React 19, TypeScript (Strict Mode)
* **Build Tool:** Vite 8 with `@tailwindcss/vite`
* **Styling:** Tailwind CSS with custom editorial color palette (warm stone neutrals, rich ink, restrained terracotta accent `#A2421D`)
* **Icons:** Lucide React
* **Testing:** Vitest 5, `@testing-library/react`, `@testing-library/jest-dom`, JSDOM
* **Persistence:** Client-side LocalStorage with schema versioning and JSON import/export

---

## 7. Budgeting and Dependency Logic

### Minor Currency Units
All internal financial figures are represented as integer minor currency units (1 INR = 100 paise; 1 USD = 100 cents) to prevent IEEE-754 floating-point rounding errors during repeated additions, reallocations, and scenario diffs.

### Status Segregation
* `estimated`: Tentative cost approximation.
* `quoted`: Formal quotation submitted by a supplier, under review.
* `confirmed`: Contract signed or binding commitment made.
* `actual`: Funds paid/disbursed.
Committed spend is strictly defined as `confirmed + actual`.

### Variable Guest Scaling
Categories specify optional `perGuestCost` values (e.g., Catering = ₹3,500/guest). When guest headcount changes, variable expenses recalculate deterministically based on that exact rule rather than invented numbers.

### Cycle Detection Algorithm
Dependency relationships form a directed graph $G = (V, E)$. Cycle detection uses Depth-First Search (DFS) maintaining `visited` and `recursionStack` sets. When a back-edge is encountered, the exact cycle loop path is captured (e.g., `Task A ➔ Task B ➔ Task C ➔ Task A`) and the creation/edit is rejected with a descriptive error.

### Deadline Realism Validation
Each task due date $T_{\text{due}}$ is validated against:
1. Event Date: $T_{\text{due}} \le E_{\text{date}}$.
2. Prerequisite Deadlines: $\forall D \in \text{Dependencies}, T_{\text{due}} \ge D_{\text{due}}$.

---

## 8. How the Planning Assistant Works

VowPilot includes a **deterministic, context-aware coordinator**:
* **Input Parsing:** Matches supported planning intents and extracts numerical constraints (e.g. `Change guest count to 175`).
* **Boundary Checks:** Read-only inquiries (e.g., `Explain my current budget`) generate immediate breakdowns. Consequential updates (headcount changes, scenario creations) generate an interactive **Action Proposal Card** with a financial variance preview.
* **Confirmation Requirement:** State modifications are applied only when the user explicitly clicks **"Confirm & Apply"**.
* **Zero Fabrication:** The assistant never invents market rates or claims external bookings were made. Unrecognized requests receive an honest response listing supported commands.

---

## 9. Data Model & Persistence

* **Schema Version:** `1`
* **Storage Key:** `vowpilot_state_v1`
* **Recovery:** If LocalStorage contains malformed or unparseable JSON, VowPilot safely catches the error and initializes a verified fallback state.
* **Data Portability:**organizers can download an encrypted/sanitized `.json` backup file and re-import it into any browser session.

---

## 10. Installation and Local Execution

### Prerequisites
* Node.js v18 or higher (tested on Node v24)
* npm v9 or higher

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Open browser
# Navigate to http://localhost:5173
```

### Production Build & Preview

```bash
# Typecheck and compile production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 11. Testing Instructions

VowPilot includes unit tests for all domain engines and integration tests for complete user workflows:

```bash
# Run all automated tests
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript type check
npm run typecheck
```

### Test Coverage Summary
* **Currency (`src/test/currency.test.ts`):** 5 tests (minor units, conversions, Indian numbering format).
* **Budget Engine (`src/test/budgetEngine.test.ts`):** 6 tests (allocations, status segregation, overrun detection, guest scaling, capacity checks, scenario evaluation).
* **Task Engine (`src/test/taskEngine.test.ts`):** 5 tests (prerequisite blocking, DFS cycle detection, overdue tasks, deadline realism, cascading risk).
* **Vendor Engine (`src/test/vendorEngine.test.ts`):** 3 tests (quote matrix, missing details detection, clarification inquiry drafting).
* **Assistant Engine (`src/test/assistantEngine.test.ts`):** 4 tests (deterministic intent recognition, action proposals, confirmation boundaries, honesty on unsupported input).
* **Persistence (`src/test/persistence.test.ts`):** 6 tests (save/load, malformed JSON recovery, schema validation, reset to demo, JSON export/import).
* **UI Integration (`src/test/ui.test.tsx`):** 6 tests (header metrics, tab navigation, dependency blocking rule enforcement, wizard validation, vendor clarification draft, simulator sandboxing).

**Result: 35 passing tests across 7 test suites (100% pass rate).**

---

## 12. Known Limitations

1. **Client-Side Storage Scope:** Data is persisted in browser `localStorage`. Clearing browser caches or using incognito mode resets data to the demo event unless exported via JSON backup.
2. **Single Event Active Session:** One active event is edited in a browser session at a time; organizers can switch events by importing different JSON backups.

---

## 13. Assumptions Made

* Default currency is set to Indian Rupee (INR / ₹) with standard Indian numbering (`₹25,00,000`), with full support for USD, EUR, and GBP.
* Calculations use integer minor units (1 INR = 100 paise).
* Planning priorities are strictly ranked; when resolving budget overruns, the system protects higher-ranked priorities and recommends reductions starting from lowest-ranked flexible items.

---

## 14. Security & Privacy Notes

* **Client-Side Isolation:** All calculations and data storage occur entirely on the client side. No personal event schedules or budgets are transmitted to external servers.
* **Input Sanitization:** Imported JSON backups and text inputs are sanitized to strip `<>` tags and avoid script injection.
* **Zero Secret Storage:** The application requires no private API keys, payment tokens, or third-party cloud credentials.

---

## 15. Deployment Instructions

Because VowPilot has a client-side architecture with zero backend server dependencies, it can be deployed to any static host:

### Deploy to Vercel
```bash
npx vercel deploy --prod
```

### Deploy to Cloudflare Pages / Netlify / GitHub Pages
1. Run `npm run build`.
2. Deploy the generated `dist/` directory as the static site root.

---

## 16. Feature-to-Requirement Traceability Table

| Requirement | Section | Implementation File | Verification Test |
| :--- | :--- | :--- | :--- |
| **Needs Assessment Wizard** | Sec 5 | `src/components/assessment/NeedsAssessmentWizard.tsx` | `src/test/ui.test.tsx` |
| **Minor Currency Units** | Sec 6 | `src/domain/currency.ts` | `src/test/currency.test.ts` |
| **Cost Status Segregation** | Sec 6 | `src/domain/budgetEngine.ts` | `src/test/budgetEngine.test.ts` |
| **Guest-Count Cost Scaling** | Sec 6 | `src/domain/budgetEngine.ts` | `src/test/budgetEngine.test.ts` |
| **Venue Capacity Checking** | Sec 6 | `src/domain/budgetEngine.ts` | `src/test/budgetEngine.test.ts` |
| **Priority-Aware Reductions**| Sec 6 | `src/domain/budgetEngine.ts` | `src/test/budgetEngine.test.ts` |
| **Task Dependency Blocking** | Sec 7 | `src/domain/taskEngine.ts` | `src/test/taskEngine.test.ts`, `src/test/ui.test.tsx` |
| **DFS Cycle Detection** | Sec 7 | `src/domain/taskEngine.ts` | `src/test/taskEngine.test.ts` |
| **Deadline Realism Audit** | Sec 7 | `src/domain/taskEngine.ts` | `src/test/taskEngine.test.ts` |
| **Cascading Risk Analysis** | Sec 7 | `src/domain/taskEngine.ts` | `src/test/taskEngine.test.ts` |
| **Vendor Quotation Matrix** | Sec 8 | `src/domain/vendorEngine.ts` | `src/test/vendorEngine.test.ts` |
| **Missing Quote Audit** | Sec 8 | `src/domain/vendorEngine.ts` | `src/test/vendorEngine.test.ts` |
| **Clarification Drafter** | Sec 8 | `src/domain/vendorEngine.ts` | `src/test/vendorEngine.test.ts`, `src/test/ui.test.tsx` |
| **Sample Records Demarcation**| Sec 8 | `src/persistence/demoData.ts` | `src/test/vendorEngine.test.ts` |
| **Deterministic Assistant** | Sec 9 | `src/domain/assistantEngine.ts`| `src/test/assistantEngine.test.ts` |
| **Action Proposal Cards** | Sec 9 | `src/components/assistant/AssistantView.tsx` | `src/test/assistantEngine.test.ts` |
| **Decision Simulator** | Sec 10 | `src/components/simulator/DecisionSimulatorView.tsx`| `src/test/ui.test.tsx` |
| **Side-by-Side Scenarios** | Sec 10 | `src/components/simulator/DecisionSimulatorView.tsx`| `src/test/budgetEngine.test.ts` |
| **Schema Migration & Recovery**| Sec 12 | `src/persistence/storage.ts` | `src/test/persistence.test.ts` |
| **JSON Export & Import** | Sec 12 | `src/persistence/importExport.ts` | `src/test/persistence.test.ts` |
| **Clean Jaipur Demo Event** | Sec 11 | `src/persistence/demoData.ts` | `src/test/ui.test.tsx` |

---

## 17. Demo Walkthrough: Aarav & Meera's Jaipur Wedding Celebration

1. **Overview Dashboard:** Explore the real metrics: ₹24,00,000 projected spend against a ₹25,00,000 total budget (₹1,00,000 runway). Notice the overdue milestone notice and vendor review alerts.
2. **Tasks & Graph:** Inspect task *"Sign Catering Contract & Lock Per-Plate Price"*. Notice it is **Blocked** with a lock icon. Attempting to complete it triggers the dependency rule notice because *"Schedule Catering Tasting & Menu Approval"* is still in progress.
3. **Vendors & Quotes:** Switch to **Photography & Cinema**. View *ShutterCraft Visuals*: the missing details detector highlights missing validity dates and omissions. Click **Draft Clarification** to view the auto-generated inquiry message and copy it.
4. **Decision Impact Simulator:** Move the guest count slider from 150 to 180. Watch catering costs recalculate in real-time. Push guest count to 220 to see the venue capacity alert. Save the exploration as a named scenario and compare it side-by-side with the baseline.
5. **Planner Assistant:** Click quick prompt *"Explain my current budget"* or type *"Change guest count to 165"*. Observe the instant impact analysis and the structured Action Proposal card requiring confirmation.
6. **Settings & Data:** Adjust event constraints, download a JSON backup, or click **Reset Demo** to restore the pristine starting state.

---

*Built with strict code quality, deterministic domain logic, and accessibility for Prompt Wars Virtual 2026.*
