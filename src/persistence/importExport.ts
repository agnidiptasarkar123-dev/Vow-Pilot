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

/**
 * Validates and sanitizes imported JSON data.
 */
export function validateImportedJson(jsonString: string): {
  success: boolean;
  state?: AppState;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!validateStateSchema(parsed)) {
      return {
        success: false,
        error: 'Invalid VowPilot schema. The file is missing essential event, budget, or task structures.',
      };
    }

    // Basic sanitization: strip potentially dangerous script payloads from text fields
    const sanitized: AppState = {
      ...parsed,
      event: {
        ...parsed.event,
        name: sanitizeText(parsed.event.name),
        location: sanitizeText(parsed.event.location),
      },
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

export function sanitizeText(text: string): string {
  if (!text) return '';
  return text.replace(/[<>]/g, '');
}
