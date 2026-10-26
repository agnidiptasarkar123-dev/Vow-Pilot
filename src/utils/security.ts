/**
 * VowPilot V2 Cryptographic Security Utilities
 *
 * Provides cryptographically secure random token generation with >= 128 bits of entropy.
 * Adheres to OWASP and NIST guidelines for unguessable event and RSVP tokens.
 */

/**
 * Generates an unguessable, cryptographically secure RSVP token with 128 bits of entropy.
 * Format: `vow_rsvp_${32_hex_chars}`
 * 16 bytes = 128 bits of cryptographic entropy -> 3.4 x 10^38 combinations.
 */
export function generateSecureRsvpToken(): string {
  const gCrypto =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof crypto !== 'undefined'
      ? crypto
      : undefined;

  if (gCrypto) {
    if (typeof gCrypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16); // 16 bytes = 128 bits of cryptographic entropy
      gCrypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `vow_rsvp_${hex}`;
    }
    if (typeof gCrypto.randomUUID === 'function') {
      const uuid = gCrypto.randomUUID().replace(/-/g, '');
      return `vow_rsvp_${uuid}`;
    }
  }

  throw new Error('Cryptographically secure PRNG is not available in this runtime environment.');
}

/**
 * Validates whether a token conforms to the secure VowPilot RSVP token specification.
 * Minimum 128 bits of entropy (32 hex characters).
 */
export function isSecureRsvpToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  // Validates vow_rsvp_ prefix followed by exactly 32 lowercase hex characters with no surrounding whitespace
  return /^vow_rsvp_[a-f0-9]{32}$/.test(token);
}

export const isValidRsvpToken = isSecureRsvpToken;
