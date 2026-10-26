import { AppState, ProposedAction } from '../types';

export interface ActionValidationResult {
  isValid: boolean;
  error?: string;
  violations?: string[];
}

export interface SecurityAnalysisResult {
  isHostile: boolean;
  riskCategory?: 'instruction_override' | 'data_exfiltration' | 'privilege_escalation' | 'code_injection' | 'unauthorized_deletion';
  sanitizedText: string;
}

/**
 * Validates any assistant-proposed action against domain invariants,
 * schema constraints, and business rules BEFORE execution.
 */
export function validateProposedAction(
  action: ProposedAction,
  state: AppState
): ActionValidationResult {
  if (!action || typeof action !== 'object') {
    return { isValid: false, error: 'Invalid action payload: action object missing.' };
  }

  if (!action.type || !['adjust_guest_count', 'create_scenario', 'rebalance_budget', 'cut_category_budget', 'apply_scenario'].includes(action.type)) {
    return { isValid: false, error: `Unsupported or unknown action type: "${action.type}".` };
  }

  if (!action.impact || typeof action.impact !== 'object') {
    return { isValid: false, error: 'Action is missing structured financial impact metadata.' };
  }

  const { currentEstimatedTotal, proposedEstimatedTotal, difference, remainingBudget } = action.impact;
  if (
    typeof currentEstimatedTotal !== 'number' || isNaN(currentEstimatedTotal) ||
    typeof proposedEstimatedTotal !== 'number' || isNaN(proposedEstimatedTotal) ||
    typeof difference !== 'number' || isNaN(difference) ||
    typeof remainingBudget !== 'number' || isNaN(remainingBudget)
  ) {
    return { isValid: false, error: 'Financial impact contains non-numeric or NaN values.' };
  }

  const violations: string[] = [];

  switch (action.type) {
    case 'adjust_guest_count': {
      const count = action.payload?.guestCount;
      if (typeof count !== 'number' || !Number.isInteger(count)) {
        return { isValid: false, error: 'Guest count parameter must be an integer.' };
      }
      if (count <= 0) {
        return { isValid: false, error: 'Guest count must be strictly greater than 0.' };
      }
      if (count > 5000) {
        return { isValid: false, error: 'Guest count exceeds maximum safe operational limit (5,000).' };
      }
      break;
    }

    case 'create_scenario': {
      const scenarioName = action.payload?.scenarioName;
      if (!scenarioName || typeof scenarioName !== 'string' || scenarioName.trim().length === 0) {
        return { isValid: false, error: 'Scenario proposal must include a non-empty name.' };
      }
      const adjustments = action.payload?.adjustments as Array<{ categoryId: string; newAllocated: number }> | undefined;
      if (adjustments && Array.isArray(adjustments)) {
        const categoryMap = new Map(state.categories.map((c) => [c.id, c]));
        for (const adj of adjustments) {
          const cat = categoryMap.get(adj.categoryId);
          if (!cat) {
            violations.push(`Referenced category ID "${adj.categoryId}" does not exist in active event.`);
            continue;
          }
          if (typeof adj.newAllocated !== 'number' || isNaN(adj.newAllocated) || adj.newAllocated < 0) {
            violations.push(`Category "${cat.name}" proposed allocation must be a non-negative number.`);
          }
        }
      }
      break;
    }

    case 'rebalance_budget':
    case 'cut_category_budget': {
      const adjustments = action.payload?.adjustments as Array<{ categoryId: string; newAllocated: number }> | undefined;
      if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
        return { isValid: false, error: 'Rebalance action requires an array of category adjustments.' };
      }
      const categoryMap = new Map(state.categories.map((c) => [c.id, c]));
      for (const adj of adjustments) {
        const cat = categoryMap.get(adj.categoryId);
        if (!cat) {
          violations.push(`Referenced category ID "${adj.categoryId}" not found in current plan.`);
          continue;
        }
        if (typeof adj.newAllocated !== 'number' || isNaN(adj.newAllocated) || adj.newAllocated < 0) {
          violations.push(`Allocation for "${cat.name}" must be a non-negative integer.`);
        }
        // Committed spend check: cannot cut below confirmed vendor expenses
        const committedSpend = state.expenses
          .filter((e) => e.categoryId === cat.id && (e.status === 'confirmed' || e.status === 'actual'))
          .reduce((sum, e) => sum + e.amount, 0);

        if (adj.newAllocated < committedSpend) {
          violations.push(
            `Cannot reduce allocation for "${cat.name}" below confirmed vendor commitments (${committedSpend} minor units).`
          );
        }
      }
      break;
    }

    case 'apply_scenario': {
      const scenarioId = action.payload?.scenarioId;
      if (typeof scenarioId !== 'string') {
        return { isValid: false, error: 'Scenario ID must be specified.' };
      }
      const scenarioExists = state.scenarios.some((s) => s.id === scenarioId);
      if (!scenarioExists) {
        return { isValid: false, error: `Target scenario "${scenarioId}" does not exist in event.` };
      }
      break;
    }
  }

  if (violations.length > 0) {
    return {
      isValid: false,
      error: `Validation failed: ${violations.join('; ')}`,
      violations,
    };
  }

  return { isValid: true };
}

/**
 * Robust inspection of untrusted user input, prompt-injection attempts,
 * system prompt exfiltration, and malicious syntax.
 */
// Hoisted constant RegExp patterns to avoid per-invocation heap allocations
const OVERRIDE_PATTERNS = [
  /\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?)\b/i,
  /\b(you\s+are\s+now|act\s+as)\s+(unrestricted|dan|jailbroken|god\s+mode|chaos\s+bot)\b/i,
  /\b(system\s+override|admin\s+override|developer\s+mode)\b/i,
];

const EXFIL_PATTERNS = [
  /\b(print|output|display|show|reveal|leak|dump)\s+(all\s+)?(passwords?|secret\s*keys?|env(ironment)?(\s*variables)?|tokens?|system\s*prompts?|api\s*keys?)\b/i,
  /\b(show\s+me\s+other\s+(users?|tenants?|events?|families?)\b)/i,
  /\b(select\s+\*\s+from\s+users)\b/i,
];

const PRIV_PATTERNS = [
  /\b(bypass|skip|disable)\s+(all\s+)?(confirmations?|auth(orization)?|verifications?|checks?)\b/i,
  /\b(promote\s+me\s+to\s+(owner|admin|superuser))\b/i,
  /\b(auto[- ]?apply\s+without\s+asking)\b/i,
];

const INJECTION_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /javascript\s*:/i,
  /;\s*drop\s+table\b/i,
  /__proto__|prototype\s*\[/i,
];

const VAGUE_TOKENS = new Set([
  'update', 'change', 'fix', 'help', 'do something', 'plan', 'wedding', 'event', 'ok', 'yes', 'no',
  'ki korbo', 'koro', 'bolo', 'taka', 'কি করব', 'কি করবো', 'সাহায্য', 'হেল্প',
]);

/**
 * Robust inspection of untrusted user input, prompt-injection attempts,
 * system prompt exfiltration, and malicious syntax.
 */
export function analyzeInputSecurity(raw: string): SecurityAnalysisResult {
  if (!raw) {
    return { isHostile: false, sanitizedText: '' };
  }

  const text = raw.trim();
  const lower = text.toLowerCase();

  // 1. Instruction override / jailbreaks
  for (const pattern of OVERRIDE_PATTERNS) {
    if (pattern.test(lower)) {
      return { isHostile: true, riskCategory: 'instruction_override', sanitizedText: text };
    }
  }

  // 2. Data / Credential Exfiltration
  for (const pattern of EXFIL_PATTERNS) {
    if (pattern.test(lower)) {
      return { isHostile: true, riskCategory: 'data_exfiltration', sanitizedText: text };
    }
  }

  // 3. Privilege Escalation / Confirmation Bypass
  for (const pattern of PRIV_PATTERNS) {
    if (pattern.test(lower)) {
      return { isHostile: true, riskCategory: 'privilege_escalation', sanitizedText: text };
    }
  }

  // 4. Code / Script injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { isHostile: true, riskCategory: 'code_injection', sanitizedText: text };
    }
  }

  return { isHostile: false, sanitizedText: text };
}

/**
 * Detects low-confidence or uninterpretable input that warrants asking
 * a brief clarifying question rather than guessing.
 */
export function isAmbiguousOrLowConfidence(raw: string): { isAmbiguous: boolean; reason?: string } {
  if (!raw) return { isAmbiguous: true, reason: 'empty_input' };
  const trimmed = raw.trim();

  // Single word non-intent or punctuation
  if (/^[?!.,;:]+$/.test(trimmed)) {
    return { isAmbiguous: true, reason: 'punctuation_only' };
  }

  // Extremely brief ambiguous tokens
  const lower = trimmed.toLowerCase();
  if (VAGUE_TOKENS.has(lower)) {
    return { isAmbiguous: true, reason: 'underspecified_token' };
  }

  return { isAmbiguous: false };
}
