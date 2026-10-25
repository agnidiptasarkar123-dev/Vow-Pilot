import { describe, it, expect } from 'vitest';
import {
  calculateBudgetOverview,
} from '../domain/budgetEngine';
import {
  detectDependencyCycles,
  computeTopologicalOrder,
  evaluateTasks,
} from '../domain/taskEngine';
import {
  compareCategoryVendors,
} from '../domain/vendorEngine';
import {
  parseUserIntent,
} from '../domain/assistantEngine';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState, Task, Vendor, VendorQuote } from '../types';

describe('Phase 9: Rigorous Algorithmic Performance Benchmarks', () => {
  const state: AppState = JSON.parse(JSON.stringify(DEMO_STATE));

  it('Benchmark 1: High-Density Task Graph (200 tasks, 400 edges) Cycle Detection & Topological Sort', () => {
    // Construct 200 tasks with cascading forward dependency DAG
    const largeTasks: Task[] = [];
    for (let i = 0; i < 200; i++) {
      const deps: string[] = [];
      if (i > 0) deps.push(`task-${i - 1}`);
      if (i > 3) deps.push(`task-${i - 3}`);
      largeTasks.push({
        id: `task-${i}`,
        title: `Synthetic Task ${i}`,
        description: `Synthetic Task Description ${i}`,
        categoryId: 'venue',
        dueDate: '2026-11-01',
        status: i % 4 === 0 ? 'completed' : 'not_started',
        priority: i % 2 === 0 ? 'high' : 'medium',
        priorityReason: 'Benchmark test ordering',
        dependencies: deps,
      });
    }

    const startCycle = performance.now();
    const cycleRes = detectDependencyCycles(largeTasks);
    const cycleDurationMs = performance.now() - startCycle;

    expect(cycleRes.hasCycle).toBe(false);
    expect(cycleDurationMs).toBeLessThan(10); // Must execute in < 10ms

    const startTopo = performance.now();
    const topoOrder = computeTopologicalOrder(largeTasks);
    const topoDurationMs = performance.now() - startTopo;

    expect(topoOrder.length).toBe(200);
    expect(topoDurationMs).toBeLessThan(15); // Must execute in < 15ms

    const startEval = performance.now();
    const evaluated = evaluateTasks(largeTasks, '2026-12-01', '2026-10-25');
    const evalDurationMs = performance.now() - startEval;

    expect(evaluated.length).toBe(200);
    expect(evalDurationMs).toBeLessThan(20);
  });

  it('Benchmark 2: Budget Recalculation Throughput (5,000 iterations)', () => {
    const iterations = 5000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      calculateBudgetOverview(
        state.event.totalBudget + (i % 100) * 1000,
        state.categories,
        state.expenses
      );
    }
    const elapsedMs = performance.now() - start;
    const avgMicroseconds = (elapsedMs / iterations) * 1000;

    // 5,000 budget recalculations must complete in under 100ms (< 20µs per run)
    expect(elapsedMs).toBeLessThan(100);
    expect(avgMicroseconds).toBeLessThan(20);
  });

  it('Benchmark 3: Multilingual Assistant Intent Classification (2,000 queries)', () => {
    const testCorpus = [
      'how to cut budget',
      'Explain my current budget',
      'Guest count 175 kore dao',
      'বাজেট কমাতে কী করব?',
      'অতিথির সংখ্যা ১৭৫ করে দাও',
      'Overdue task gulo dekhao',
      'Vendor quotations compare koro',
      'Find tasks that are overdue',
    ];

    const iterations = 2000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const q = testCorpus[i % testCorpus.length];
      parseUserIntent(q);
    }
    const elapsedMs = performance.now() - start;
    const avgMicroseconds = (elapsedMs / iterations) * 1000;

    // 2,000 intent classifications must complete in under 50ms (< 25µs per query)
    expect(elapsedMs).toBeLessThan(50);
    expect(avgMicroseconds).toBeLessThan(25);
  });

  it('Benchmark 4: Large Vendor Quotation Matrix Comparison (50 vendors, 100 quotes)', () => {
    const syntheticVendors: Vendor[] = [];
    const syntheticQuotes: VendorQuote[] = [];

    for (let v = 0; v < 50; v++) {
      const vId = `vendor-synth-${v}`;
      syntheticVendors.push({
        id: vId,
        name: `Supplier ${v}`,
        categoryId: 'catering',
        contactName: `Manager ${v}`,
        email: `supplier${v}@example.com`,
        phone: '+91-9876543210',
        isSample: false,
        createdAt: '2026-10-01T00:00:00.000Z',
      });

      // 2 quotes per vendor
      for (let q = 0; q < 2; q++) {
        syntheticQuotes.push({
          id: `quote-${v}-${q}`,
          vendorId: vId,
          quoteDate: '2026-10-01',
          quotedAmount: 15000000 + v * 500000 + q * 100000,
          currency: 'INR',
          status: q === 0 ? 'selected' : 'under_review',
          includedServices: ['Main Buffet', 'Live Counters', 'Dessert Station'],
          exclusions: ['Liquor License', 'Custom Uniforms'],
          paymentTerms: '50% advance',
          validityDate: '2026-11-30',
          isSample: false,
        });
      }
    }

    const start = performance.now();
    const comparison = compareCategoryVendors(
      'catering',
      'Catering & Food Service',
      syntheticVendors,
      syntheticQuotes
    );
    const durationMs = performance.now() - start;

    expect(comparison.rows.length).toBe(50);
    expect(durationMs).toBeLessThan(10);
  });
});
