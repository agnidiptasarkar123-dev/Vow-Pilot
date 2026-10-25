import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import {
  parseUserIntent,
  generateAssistantResponse,
  normalizeAssistantInput,
} from '../domain/assistantEngine';
import { DEMO_STATE } from '../persistence/demoData';
import { savePersistedState } from '../persistence/storage';
import { AppState } from '../types';

describe('Planning Assistant Intent Matching & Budget Reduction Regression Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    savePersistedState(DEMO_STATE);
  });

  // ==========================================================================
  // Suite 1: Budget-Reduction Natural Language Phrases (Prompt Specified)
  // ==========================================================================
  describe('Budget-reduction intent phrasing coverage', () => {
    const requiredPhrases = [
      'how to cut budget',
      'How can I cut my budget?',
      'How do I reduce expenses?',
      'How can I save money?',
      'Where can I cut costs?',
      'Suggest ways to reduce expenses',
      'Help me lower the event cost',
      'We need to spend less',
      'Find unnecessary expenses',
      'Reduce my spending',
      'Can I make this wedding cheaper?',
      'What can I trim from the budget?',
      'Show me budget-saving opportunities',
    ];

    requiredPhrases.forEach((phrase) => {
      it(`correctly recognizes "${phrase}" as budget reduction intent`, () => {
        const result = parseUserIntent(phrase);
        expect(
          result.intent === 'suggest_expense_reductions' || result.intent === 'reduce_budget'
        ).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Suite 2: Input Normalization Tests
  // ==========================================================================
  describe('Input normalization across punctuation, casing, and contractions', () => {
    it('normalizes uppercase, lowercase, and mixed casing', () => {
      expect(parseUserIntent('HOW TO CUT BUDGET').intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent('How To Cut Budget').intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent('hOw To cUt bUdGeT').intent).toBe('suggest_expense_reductions');
    });

    it('handles leading and trailing whitespace and multiple spaces', () => {
      expect(parseUserIntent('   how to cut budget   ').intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent('how    can    i   cut   my   budget').intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent('\t\thow to cut budget\n').intent).toBe('suggest_expense_reductions');
    });

    it('strips trailing punctuation like question marks and exclamation points', () => {
      expect(parseUserIntent('how to cut budget???').intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent('How can I cut my budget!').intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent('Where can I cut costs?!').intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent('Can I make this wedding cheaper???').intent).toBe('suggest_expense_reductions');
    });

    it('normalizes curly apostrophes and expands contractions', () => {
      expect(normalizeAssistantInput("what’s our budget status?")).toBe("what is our budget status");
      expect(normalizeAssistantInput("we’ll need to spend less")).toBe("we will need to spend less");
      expect(normalizeAssistantInput("can’t we cut costs?")).toBe("cannot we cut costs");
      expect(parseUserIntent("Can't we cut costs?").intent).toBe('suggest_expense_reductions');
      expect(parseUserIntent("We'll need to spend less").intent).toBe('suggest_expense_reductions');
    });
  });

  // ==========================================================================
  // Suite 3: Intent Conflict & Negative Guards
  // ==========================================================================
  describe('Intent conflict and negative guard verification', () => {
    it('"Explain my current budget" is classified as explain_budget, not budget reduction', () => {
      const result = parseUserIntent('Explain my current budget');
      expect(result.intent).toBe('explain_budget');
    });

    it('"Protect my highest-priority category" preserves priority protection behavior', () => {
      const result = parseUserIntent('Protect my highest-priority category');
      expect(result.intent).toBe('protect_priority');
    });

    it('"Compare vendor quotations" invokes vendor comparison', () => {
      const result = parseUserIntent('Compare vendor quotations');
      expect(result.intent).toBe('compare_vendor_quotes');
    });

    it('"Find tasks that are overdue" invokes overdue tasks', () => {
      const result = parseUserIntent('Find tasks that are overdue');
      expect(result.intent).toBe('find_overdue_tasks');
    });

    it('"Explain which tasks are blocked" invokes blocked tasks', () => {
      const result = parseUserIntent('Explain which tasks are blocked');
      expect(result.intent).toBe('explain_blocked_tasks');
    });

    it('"Change guest count to 175" triggers guest count update action', () => {
      const result = parseUserIntent('Change guest count to 175');
      expect(result.intent).toBe('change_guest_count');
      expect(result.extractedParameters?.guestCount).toBe(175);
    });

    it('"How do I increase my budget?" is NOT interpreted as budget reduction', () => {
      const result = parseUserIntent('How do I increase my budget?');
      expect(result.intent).not.toBe('suggest_expense_reductions');
      expect(result.intent).not.toBe('reduce_budget');
      expect(result.intent).toBe('unsupported');
    });

    it('"Increase budget by 100000" is NOT interpreted as budget reduction', () => {
      const result = parseUserIntent('Increase budget by 100000');
      expect(result.intent).not.toBe('suggest_expense_reductions');
      expect(result.intent).not.toBe('reduce_budget');
      expect(result.intent).toBe('unsupported');
    });

    it('Ambiguous or unsupported inputs do not trigger any unintended intent', () => {
      expect(parseUserIntent('Tell me about the history of Rajasthan palaces').intent).toBe('unsupported');
      expect(parseUserIntent('What is the weather forecast for tomorrow?').intent).toBe('unsupported');
      expect(parseUserIntent('').intent).toBe('unsupported');
    });
  });

  // ==========================================================================
  // Suite 4: Response Correctness & Grounded Calculation
  // ==========================================================================
  describe('Data-grounded assistant response behavior', () => {
    it('no longer falls back to unsupported for "how to cut budget"', () => {
      const response = generateAssistantResponse('how to cut budget', DEMO_STATE);
      expect(response.intent).toBe('suggest_expense_reductions');
      expect(response.content).not.toContain('I did not recognize a supported planning command');
      expect(response.content).toContain('Priority-Aware Budget Reduction Opportunities');
    });

    it('reflects real demo budget state and calculates concrete numerical savings', () => {
      const response = generateAssistantResponse('how to cut budget', DEMO_STATE);

      // Total budget is ₹25,00,000; 10% target reduction is ₹2,50,000
      expect(response.content).toContain('₹25,00,000');
      expect(response.content).toContain('₹2,50,000');
      expect(response.content).toContain('Committed vs Flexible Spend');

      // Top categories (Venue, Catering, Photography) should be protected
      expect(response.content).toContain('Venue & Lawns');
      expect(response.content).toContain('Catering & Beverages');
      expect(response.content).toContain('Photography & Cinema');

      // Proposed action should be non-destructive scenario creation
      expect(response.proposedAction).toBeDefined();
      expect(response.proposedAction?.type).toBe('create_scenario');
      expect(response.requiresConfirmation).toBe(true);
      expect(response.actionStatus).toBe('pending');
      expect(response.proposedAction?.impact.difference).toBe(-25000000); // -₹2,50,000 in paise
    });

    it('explicitly notes that active event data has NOT been modified', () => {
      const response = generateAssistantResponse('how to cut budget', DEMO_STATE);
      expect(response.content).toContain('These recommendations have not modified your active event data');
    });

    it('handles empty budget categories gracefully with missing data notice', () => {
      const emptyState: AppState = {
        ...DEMO_STATE,
        categories: [],
      };
      const response = generateAssistantResponse('how to cut budget', emptyState);
      expect(response.content).toContain('Current data is insufficient');
      expect(response.content).toContain('No budget categories have been configured yet');
      expect(response.proposedAction).toBeUndefined();
    });

    it('handles 100% committed categories gracefully without fabricating savings', () => {
      // Set all categories committed
      const committedState: AppState = {
        ...DEMO_STATE,
        expenses: [
          {
            id: 'exp-full',
            categoryId: 'venue',
            title: 'Full venue',
            amount: 75000000,
            status: 'confirmed',
            paidAmount: 75000000,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'exp-cat',
            categoryId: 'catering',
            title: 'Full catering',
            amount: 60000000,
            status: 'confirmed',
            paidAmount: 60000000,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'exp-photo',
            categoryId: 'photography',
            title: 'Full photography',
            amount: 35000000,
            status: 'confirmed',
            paidAmount: 35000000,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'exp-decor',
            categoryId: 'decor',
            title: 'Full decor',
            amount: 40000000,
            status: 'confirmed',
            paidAmount: 40000000,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'exp-ent',
            categoryId: 'entertainment',
            title: 'Full music',
            amount: 18000000,
            status: 'confirmed',
            paidAmount: 18000000,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'exp-log',
            categoryId: 'logistics',
            title: 'Full logistics',
            amount: 12000000,
            status: 'confirmed',
            paidAmount: 12000000,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'exp-cont',
            categoryId: 'contingency',
            title: 'Full buffer',
            amount: 10000000,
            status: 'confirmed',
            paidAmount: 10000000,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      };
      const response = generateAssistantResponse('how to cut budget', committedState);
      expect(response.content).toContain('already committed to confirmed vendor expenses');
      expect(response.content).toContain('no flexible, uncommitted headroom available');
      expect(response.proposedAction).toBeUndefined();
    });

    it('targets exact overrun amount when budget is in overrun', () => {
      // Overrun scenario: total budget ₹20,00,000, total allocated ₹24,00,000 -> ₹4,00,000 overrun
      const overrunState: AppState = {
        ...DEMO_STATE,
        event: {
          ...DEMO_STATE.event,
          totalBudget: 200000000, // ₹20,00,000
        },
      };
      const response = generateAssistantResponse('how to cut budget', overrunState);
      expect(response.content).toContain('Overrun Correction');
      expect(response.content).toContain('₹4,00,000');
      expect(response.proposedAction?.summary).toBe('Rebalance Budget to Clear Overrun');
    });

    it('all 9 documented commands continue to work accurately', () => {
      const commands = [
        'Explain my current budget',
        'Change guest count to 175',
        'Suggest ways to reduce expenses',
        'Protect my highest-priority category',
        'Find tasks that are overdue',
        'Explain which tasks are blocked',
        'Compare vendor quotations',
        'Identify missing vendor information',
        'Summarize the current event plan',
      ];

      for (const cmd of commands) {
        const response = generateAssistantResponse(cmd, DEMO_STATE);
        expect(response.intent).not.toBe('unsupported');
        expect(response.content.length).toBeGreaterThan(20);
      }
    });
  });

  // ==========================================================================
  // Suite 5: Full UI Integration Tests (React Testing Library)
  // ==========================================================================
  describe('UI integration: Planner Assistant interactive flow', () => {
    it('enters "how to cut budget", receives grounded response, and verifies no fallback', async () => {
      render(<App />);

      // Navigate to Planner Assistant tab
      const nav = screen.getByRole('navigation', { name: /tabs/i });
      const assistantTab = within(nav).getByRole('button', { name: /Planner Assistant/i });
      fireEvent.click(assistantTab);

      expect(await screen.findByText(/Context-Aware Planning Coordinator/i)).toBeInTheDocument();

      // Find prompt input and submit button
      const promptInput = screen.getByLabelText(/Planning command input/i);
      const askButton = screen.getByRole('button', { name: /Send planning command/i });

      // Enter "how to cut budget"
      fireEvent.change(promptInput, { target: { value: 'how to cut budget' } });
      fireEvent.click(askButton);

      // Verify that the user message was added
      expect(screen.getByText('how to cut budget')).toBeInTheDocument();

      // Verify that the assistant responds with budget reduction proposals
      expect(await screen.findByText(/Priority-Aware Budget Reduction Opportunities/i)).toBeInTheDocument();

      // Verify that the unsupported fallback did NOT appear
      expect(screen.queryByText(/I did not recognize a supported planning command/i)).not.toBeInTheDocument();

      // Verify real data reflects Jaipur demo event (₹2,50,000 savings proposal)
      expect(screen.getAllByText(/₹2,50,000/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Venue & Lawns/i)).toBeInTheDocument();

      // Verify action confirmation buttons exist
      expect(screen.getByRole('button', { name: /Confirm and apply proposed action/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dismiss proposed action/i })).toBeInTheDocument();
    });

    it('competing intent "Explain my current budget" is dispatched correctly without interference', async () => {
      render(<App />);

      const nav = screen.getByRole('navigation', { name: /tabs/i });
      const assistantTab = within(nav).getByRole('button', { name: /Planner Assistant/i });
      fireEvent.click(assistantTab);

      expect(await screen.findByText(/Context-Aware Planning Coordinator/i)).toBeInTheDocument();

      const promptInput = screen.getByLabelText(/Planning command input/i);
      const askButton = screen.getByRole('button', { name: /Send planning command/i });

      // Send "Explain my current budget"
      fireEvent.change(promptInput, { target: { value: 'Explain my current budget' } });
      fireEvent.click(askButton);

      expect(await screen.findByText(/Current Budget Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Event Budget:/i)).toBeInTheDocument();
      expect(screen.getByText(/Remaining Runway:/i)).toBeInTheDocument();
      expect(screen.queryByText(/Priority-Aware Budget Reduction/i)).not.toBeInTheDocument();
    });

    it('negative query "How do I increase my budget?" displays unsupported notice safely without mutations', async () => {
      render(<App />);

      const nav = screen.getByRole('navigation', { name: /tabs/i });
      const assistantTab = within(nav).getByRole('button', { name: /Planner Assistant/i });
      fireEvent.click(assistantTab);

      expect(await screen.findByText(/Context-Aware Planning Coordinator/i)).toBeInTheDocument();

      const promptInput = screen.getByLabelText(/Planning command input/i);
      const askButton = screen.getByRole('button', { name: /Send planning command/i });

      // Send "How do I increase my budget?"
      fireEvent.change(promptInput, { target: { value: 'How do I increase my budget?' } });
      fireEvent.click(askButton);

      expect(await screen.findByText(/I did not recognize a supported planning command/i)).toBeInTheDocument();
      expect(screen.queryByText(/Priority-Aware Budget Reduction/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirm and apply proposed action/i })).not.toBeInTheDocument();
    });
  });
});
