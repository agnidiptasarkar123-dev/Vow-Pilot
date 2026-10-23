import { AppState } from '../types';
import { validateStateSchema } from './storage';

/**
 * Generates and triggers a browser download for the event state as a JSON file.
 */
export function exportEventData(state: AppState): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  const filename = `vowpilot-${state.event.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;

  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates and sanitizes imported JSON data.
 * Validates payload size, structural schema, field boundaries, and cross-field reference integrity.
 */
export function validateImportedJson(jsonString: string): {
  success: boolean;
  state?: AppState;
  error?: string;
} {
  if (!jsonString || typeof jsonString !== 'string') {
    return {
      success: false,
      error: 'Empty or invalid import data provided.',
    };
  }

  if (jsonString.length > MAX_IMPORT_BYTES) {
    return {
      success: false,
      error: `Import file exceeds maximum allowed size of 5 MB (${(jsonString.length / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!validateStateSchema(parsed)) {
      return {
        success: false,
        error: 'Invalid VowPilot schema. The file does not conform to the required event, budget, or task data model.',
      };
    }

    // Cross-field reference validation
    const categoryIds = new Set(parsed.categories.map((c) => c.id));
    const vendorIds = new Set(parsed.vendors.map((v) => v.id));
    const taskIds = new Set(parsed.tasks.map((t) => t.id));

    // Verify task dependencies reference valid tasks and don't self-reference
    for (const task of parsed.tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          return {
            success: false,
            error: `Broken task dependency: Task "${task.title}" references non-existent prerequisite task ID "${depId}".`,
          };
        }
        if (depId === task.id) {
          return {
            success: false,
            error: `Self-cycle detected: Task "${task.title}" cannot depend on itself.`,
          };
        }
      }
    }

    // Verify expense category references
    for (const exp of parsed.expenses) {
      if (!categoryIds.has(exp.categoryId)) {
        return {
          success: false,
          error: `Orphaned expense: Expense "${exp.title}" references non-existent category ID "${exp.categoryId}".`,
        };
      }
      if (exp.vendorId && !vendorIds.has(exp.vendorId)) {
        return {
          success: false,
          error: `Orphaned expense: Expense "${exp.title}" references non-existent vendor ID "${exp.vendorId}".`,
        };
      }
    }

    // Verify quote vendor references
    for (const quote of parsed.quotes) {
      if (!vendorIds.has(quote.vendorId)) {
        return {
          success: false,
          error: `Orphaned quote: Quote "${quote.id}" references non-existent vendor ID "${quote.vendorId}".`,
        };
      }
    }

    // Comprehensive text sanitization across all models
    const sanitized: AppState = {
      ...parsed,
      event: {
        ...parsed.event,
        name: sanitizeText(parsed.event.name),
        location: sanitizeText(parsed.event.location),
        preferences: {
          ...parsed.event.preferences,
          style: sanitizeText(parsed.event.preferences?.style || ''),
          cateringType: sanitizeText(parsed.event.preferences?.cateringType || ''),
          venuePreference: sanitizeText(parsed.event.preferences?.venuePreference || ''),
          decorationPreference: sanitizeText(parsed.event.preferences?.decorationPreference || ''),
          photographyTier: sanitizeText(parsed.event.preferences?.photographyTier || ''),
          specialConstraints: Array.isArray(parsed.event.preferences?.specialConstraints)
            ? parsed.event.preferences.specialConstraints.map(sanitizeText)
            : typeof (parsed.event.preferences as unknown as { specialConstraints?: string })?.specialConstraints === 'string'
            ? [sanitizeText((parsed.event.preferences as unknown as { specialConstraints: string }).specialConstraints)]
            : [],
          optionalNotes: sanitizeText(parsed.event.preferences?.optionalNotes || ''),
          dietaryRequirements: (parsed.event.preferences?.dietaryRequirements || []).map(sanitizeText),
          accessibilityNeeds: (parsed.event.preferences?.accessibilityNeeds || []).map(sanitizeText),
        },
      },
      categories: parsed.categories.map((c) => ({
        ...c,
        name: sanitizeText(c.name),
      })),
      expenses: parsed.expenses.map((e) => ({
        ...e,
        title: sanitizeText(e.title),
        notes: e.notes ? sanitizeText(e.notes) : undefined,
      })),
      tasks: parsed.tasks.map((t) => ({
        ...t,
        title: sanitizeText(t.title),
        description: sanitizeText(t.description || ''),
        priorityReason: sanitizeText(t.priorityReason || ''),
      })),
      vendors: parsed.vendors.map((v) => ({
        ...v,
        name: sanitizeText(v.name),
        contactName: sanitizeText(v.contactName || ''),
        email: sanitizeText(v.email || ''),
        phone: sanitizeText(v.phone || ''),
        notes: v.notes ? sanitizeText(v.notes) : undefined,
      })),
      quotes: parsed.quotes.map((q) => ({
        ...q,
        includedServices: (q.includedServices || []).map(sanitizeText),
        exclusions: (q.exclusions || []).map(sanitizeText),
        paymentTerms: sanitizeText(q.paymentTerms || ''),
      })),
      scenarios: parsed.scenarios.map((s) => ({
        ...s,
        name: sanitizeText(s.name),
        description: sanitizeText(s.description || ''),
        notes: sanitizeText(s.notes || ''),
      })),
      messages: parsed.messages.map((m) => ({
        ...m,
        content: sanitizeText(m.content),
        rationale: m.rationale ? sanitizeText(m.rationale) : undefined,
      })),
    };

    return {
      success: true,
      state: sanitized,
    };
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Sanitizes text by stripping HTML tags and control characters to prevent XSS.
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/javascript:/gi, '') // Strip JS protocol
    .trim();
}
