import { describe, it, expect } from 'vitest';
import {
  validateImportedJson,
  sanitizeText,
  MAX_IMPORT_BYTES,
} from '../persistence/importExport';
import { validateStateSchema } from '../persistence/storage';
import { DEMO_STATE } from '../persistence/demoData';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  generatePriorityAwareRecommendations,
} from '../domain/budgetEngine';
import {
  canCompleteTask,
  detectDependencyCycles,
  evaluateTasks,
} from '../domain/taskEngine';
import {
  compareCategoryVendors,
  identifyMissingQuoteDetails,
} from '../domain/vendorEngine';
import {
  toMinorUnits,
  toMajorUnits,
  parseDisplayToMinor,
  formatCurrency,
} from '../domain/currency';
import { Task, Vendor, VendorQuote } from '../types';

describe('Security Review and Boundary Defense', () => {
  it('strips HTML tags and javascript: protocol vectors in sanitizeText', () => {
    const dangerousInput = '<script>alert("XSS")</script>Hello <b>World</b><img src=x onerror=alert(1)> javascript:void(0)';
    const sanitized = sanitizeText(dangerousInput);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('</script>');
    expect(sanitized).not.toContain('<b>');
    expect(sanitized).not.toContain('<img');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).toBe('alert("XSS")Hello World void(0)');
  });

  it('rejects oversized JSON imports exceeding 5 MB limit', () => {
    // Construct a synthetic payload just over 5 MB
    const largeDummy = 'A'.repeat(MAX_IMPORT_BYTES + 100);
    const result = validateImportedJson(largeDummy);

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum allowed size of 5 MB');
  });

  it('rejects prototype pollution attempts in validateStateSchema', () => {
    const maliciousPayload = JSON.parse(
      '{"schemaVersion": 1, "__proto__": {"admin": true}, "event": {"id": "1", "name": "Hack", "totalBudget": 100, "guestCount": 10, "currency": "INR", "eventType": "wedding", "date": "2026-10-10", "location": "City", "preferences": {}}, "categories": [], "expenses": [], "tasks": [], "vendors": [], "quotes": [], "scenarios": [], "messages": []}'
    );

    const isSchemaValid = validateStateSchema(maliciousPayload);
    expect(isSchemaValid).toBe(false);
  });

  it('rejects imported state with dangling prerequisite task IDs', () => {
    const stateWithDanglingDep = {
      ...DEMO_STATE,
      tasks: [
        {
          id: 'task-root',
          title: 'Root Task',
          description: '',
          categoryId: 'venue',
          priority: 'high' as const,
          priorityReason: 'Core',
          dueDate: '2026-11-01',
          status: 'not_started' as const,
          dependencies: ['non-existent-task-id-999'],
        },
      ],
    };

    const result = validateImportedJson(JSON.stringify(stateWithDanglingDep));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Broken task dependency');
  });

  it('rejects imported state with self-referencing task dependency', () => {
    const stateWithSelfCycle = {
      ...DEMO_STATE,
      tasks: [
        {
          id: 'task-ouroboros',
          title: 'Self-Dependent Task',
          description: '',
          categoryId: 'venue',
          priority: 'high' as const,
          priorityReason: 'Cycle',
          dueDate: '2026-11-01',
          status: 'not_started' as const,
          dependencies: ['task-ouroboros'],
        },
      ],
    };

    const result = validateImportedJson(JSON.stringify(stateWithSelfCycle));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Self-cycle detected');
  });

  it('rejects imported state with orphaned expense category IDs', () => {
    const stateWithOrphanedExpense = {
      ...DEMO_STATE,
      expenses: [
        {
          id: 'exp-bad',
          categoryId: 'unregistered-category-id',
          title: 'Orphaned Expense',
          amount: 50000,
          status: 'estimated' as const,
          paidAmount: 0,
          createdAt: '2026-10-23',
        },
      ],
    };

    const result = validateImportedJson(JSON.stringify(stateWithOrphanedExpense));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Orphaned expense');
  });
});

describe('Domain Engine Edge-Case Verifications', () => {
  describe('Currency and Numeric Boundary Safety', () => {
    it('safely handles NaN and Infinity without throwing', () => {
      expect(toMinorUnits(NaN)).toBe(0);
      expect(toMinorUnits(Infinity)).toBe(0);
      expect(toMinorUnits(-Infinity)).toBe(0);

      expect(toMajorUnits(NaN)).toBe(0);
      expect(toMajorUnits(Infinity)).toBe(0);
      expect(toMajorUnits(-Infinity)).toBe(0);
    });

    it('clamps values exceeding MAX_SAFE_MAJOR_AMOUNT', () => {
      const excessiveAmount = Number.MAX_SAFE_INTEGER * 2;
      const minor = toMinorUnits(excessiveAmount);
      expect(minor).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
      expect(minor).toBeGreaterThan(0);
    });

    it('correctly parses negative display strings and formats negative balances', () => {
      expect(parseDisplayToMinor('-5000')).toBe(-500000);
      expect(formatCurrency(-500000, 'INR')).toBe('-₹5,000');
      expect(formatCurrency(-25000, 'USD')).toBe('-$250');
    });
  });

  describe('Budget Engine Edge Cases', () => {
    it('handles zero guest count safely without crashing', () => {
      const result = calculateGuestCountImpact(DEMO_STATE, 0);
      expect(result.impact).toBeDefined();
      expect(result.impact.proposedEstimatedTotal).toBeLessThan(result.impact.currentEstimatedTotal);
      expect(result.impact.difference).toBeLessThan(0);
    });

    it('handles negative guest count by clamping to 0 with explicit warning', () => {
      const result = calculateGuestCountImpact(DEMO_STATE, -25);
      expect(result.missingDataWarnings.length).toBeGreaterThan(0);
      expect(result.missingDataWarnings[0]).toContain('Invalid guest count');
      expect(result.impact.difference).toBeLessThan(0);
    });

    it('safely handles negative expense amounts by zero-clamping in calculateBudgetOverview', () => {
      const corruptedExpenses = [
        {
          id: 'exp-neg',
          categoryId: 'venue',
          title: 'Negative Hack',
          amount: -500000,
          status: 'actual' as const,
          paidAmount: 0,
          createdAt: '2026-10-23',
        },
      ];

      const overview = calculateBudgetOverview(250000000, DEMO_STATE.categories, corruptedExpenses);
      expect(overview.sumActual).toBe(0);
      expect(overview.committedTotal).toBe(0);
    });

    it('returns empty recommendations when budget is already within limit and has 0 overrun', () => {
      const overview = calculateBudgetOverview(500000000, DEMO_STATE.categories, DEMO_STATE.expenses);
      const recs = generatePriorityAwareRecommendations(overview, ['venue', 'catering']);
      expect(recs.targetReductionAmount).toBe(0);
      expect(recs.recommendations.length).toBe(0);
    });
  });

  describe('Task Engine Edge Cases', () => {
    it('blocks completion when task has a self-dependency', () => {
      const selfTask: Task = {
        id: 'self-1',
        title: 'Recursive Task',
        description: '',
        categoryId: 'venue',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-11-01',
        status: 'not_started',
        dependencies: ['self-1'],
      };

      const check = canCompleteTask('self-1', [selfTask]);
      expect(check.allowed).toBe(false);
      expect(check.blockingTaskTitles).toContain('Self-dependency cycle detected');
    });

    it('blocks completion when task references a missing/dangling prerequisite ID', () => {
      const taskWithDangling: Task = {
        id: 'task-real',
        title: 'Child Task',
        description: '',
        categoryId: 'venue',
        priority: 'high',
        priorityReason: '',
        dueDate: '2026-11-01',
        status: 'not_started',
        dependencies: ['ghost-prerequisite-999'],
      };

      const check = canCompleteTask('task-real', [taskWithDangling]);
      expect(check.allowed).toBe(false);
      expect(check.blockingTaskTitles[0]).toContain('Unresolved prerequisite');
    });

    it('detects direct self-cycle in detectDependencyCycles', () => {
      const tasks: Task[] = [
        {
          id: 'loop-task',
          title: 'Loop',
          description: '',
          categoryId: 'venue',
          priority: 'medium',
          priorityReason: '',
          dueDate: '2026-11-01',
          status: 'not_started',
          dependencies: ['loop-task'],
        },
      ];

      const cycle = detectDependencyCycles(tasks);
      expect(cycle.hasCycle).toBe(true);
      expect(cycle.cyclePath).toEqual(['loop-task', 'loop-task']);
    });

    it('marks task as blocked in evaluateTasks when it has missing prerequisite ID', () => {
      const tasks: Task[] = [
        {
          id: 'blocked-task',
          title: 'Dependent On Ghost',
          description: '',
          categoryId: 'decor',
          priority: 'critical',
          priorityReason: '',
          dueDate: '2026-11-15',
          status: 'not_started',
          dependencies: ['missing-id-123'],
        },
      ];

      const evaluations = evaluateTasks(tasks, '2026-12-18');
      expect(evaluations[0].effectiveStatus).toBe('blocked');
      expect(evaluations[0].risks.isBlocked).toBe(true);
      expect(evaluations[0].risks.missingPrerequisites[0]).toContain('Unresolved prerequisite');
    });
  });

  describe('Vendor Engine Edge Cases and Multi-Currency Detection', () => {
    it('flags currency mismatch when quotations use different currency than standard', () => {
      const vendors: Vendor[] = [
        {
          id: 'v-inr',
          name: 'Local DJ',
          categoryId: 'entertainment',
          contactName: 'Rohan',
          email: 'rohan@example.com',
          phone: '+91 9999999999',
          isSample: true,
          createdAt: '2026-10-01',
        },
        {
          id: 'v-usd',
          name: 'International Live Band',
          categoryId: 'entertainment',
          contactName: 'John',
          email: 'john@example.com',
          phone: '+1 555-0199',
          isSample: true,
          createdAt: '2026-10-01',
        },
      ];

      const quotes: VendorQuote[] = [
        {
          id: 'q-inr',
          vendorId: 'v-inr',
          quoteDate: '2026-10-01',
          quotedAmount: 15000000, // ₹1,50,000 in minor units
          currency: 'INR',
          status: 'under_review',
          includedServices: ['DJ console'],
          exclusions: ['Generator'],
          paymentTerms: '50/50',
          isSample: true,
        },
        {
          id: 'q-usd',
          vendorId: 'v-usd',
          quoteDate: '2026-10-01',
          quotedAmount: 300000, // $3,000 in cents
          currency: 'USD',
          status: 'under_review',
          includedServices: ['Band equipment'],
          exclusions: ['Flights'],
          paymentTerms: '100% advance',
          isSample: true,
        },
      ];

      const comparison = compareCategoryVendors('entertainment', 'Entertainment', vendors, quotes);

      expect(comparison.hasMixedCurrencies).toBe(true);
      const usdRow = comparison.rows.find((r) => r.vendor.id === 'v-usd');
      expect(usdRow?.currencyMismatch).toBe(true);
      expect(usdRow?.missingDetails.some((d) => d.includes('differs from category standard'))).toBe(true);
    });

    it('identifies all missing quote details when fields are empty', () => {
      const incompleteQuote: VendorQuote = {
        id: 'q-empty',
        vendorId: 'v-test',
        quoteDate: '2026-10-01',
        quotedAmount: 500000,
        currency: 'INR',
        status: 'draft',
        includedServices: [],
        exclusions: [],
        paymentTerms: '',
        validityDate: '',
        isSample: true,
      };

      const missing = identifyMissingQuoteDetails(incompleteQuote);
      expect(missing).toContain('Quote validity expiration date not specified');
      expect(missing).toContain('Payment terms and milestone schedule missing');
      expect(missing).toContain('No itemized included services documented');
      expect(missing).toContain('Explicit service exclusions (e.g., overtime, taxes, delivery) missing');
    });
  });
});
