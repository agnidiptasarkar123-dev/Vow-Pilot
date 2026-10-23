import { describe, it, expect } from 'vitest';
import { generateAssistantResponse, parseUserIntent } from '../domain/assistantEngine';
import { DEMO_STATE } from '../persistence/demoData';

describe('Context-Aware Planning Assistant Engine', () => {
  it('correctly parses supported user intents deterministically', () => {
    expect(parseUserIntent('Explain my current budget').intent).toBe('explain_budget');
    expect(parseUserIntent('How much budget is remaining?').intent).toBe('explain_budget');

    const guestParse = parseUserIntent('Change guest count to 180');
    expect(guestParse.intent).toBe('change_guest_count');
    expect(guestParse.extractedParameters?.guestCount).toBe(180);

    expect(parseUserIntent('Find tasks that are overdue').intent).toBe('find_overdue_tasks');
    expect(parseUserIntent('Explain which tasks are blocked').intent).toBe('explain_blocked_tasks');
    expect(parseUserIntent('Compare vendor quotations').intent).toBe('compare_vendor_quotes');
    expect(parseUserIntent('Identify missing vendor information').intent).toBe('identify_missing_vendor_info');
    expect(parseUserIntent('Suggest ways to reduce expenses').intent).toBe('suggest_expense_reductions');
    expect(parseUserIntent('Protect my highest-priority category').intent).toBe('protect_priority');
    expect(parseUserIntent('Summarize the current event plan').intent).toBe('summarize_plan');
  });

  it('honestly marks unrecognized or unsupported requests as unsupported', () => {
    const result = parseUserIntent('Tell me a bedtime story about elephants');
    expect(result.intent).toBe('unsupported');

    const response = generateAssistantResponse('Tell me a bedtime story about elephants', DEMO_STATE);
    expect(response.intent).toBe('unsupported');
    expect(response.content).toContain('deterministic planning engine');
    expect(response.content).toContain('did not recognize a supported planning command');
  });

  it('requires confirmation when proposing consequential modifications like guest count updates', () => {
    const response = generateAssistantResponse('Change guest count to 175', DEMO_STATE);

    expect(response.intent).toBe('change_guest_count');
    expect(response.requiresConfirmation).toBe(true);
    expect(response.actionStatus).toBe('pending');
    expect(response.proposedAction).toBeDefined();
    expect(response.proposedAction?.impact.proposedEstimatedTotal).toBeGreaterThan(0);
    expect(response.content).toContain('Impact Analysis');
    expect(response.content).toContain('Would you like me to apply this update');
  });

  it('explains budget breakdown using real event state without hallucination', () => {
    const response = generateAssistantResponse('Explain my current budget', DEMO_STATE);

    expect(response.intent).toBe('explain_budget');
    expect(response.requiresConfirmation).toBe(false);
    expect(response.content).toContain('₹25,00,000');
    expect(response.content).toContain('Committed Spend');
  });
});
