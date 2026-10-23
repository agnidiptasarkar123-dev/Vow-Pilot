import { CurrencyCode } from '../types';

/**
 * Currency utilities operating strictly with integer minor currency units
 * (e.g., paise for INR, cents for USD/EUR/GBP) to prevent floating-point inaccuracies.
 */

export const MINOR_UNIT_MULTIPLIER = 100;

export function toMinorUnits(majorAmount: number): number {
  if (isNaN(majorAmount) || !isFinite(majorAmount)) return 0;
  return Math.round(majorAmount * MINOR_UNIT_MULTIPLIER);
}

export function toMajorUnits(minorAmount: number): number {
  if (isNaN(minorAmount) || !isFinite(minorAmount)) return 0;
  return minorAmount / MINOR_UNIT_MULTIPLIER;
}

export function formatCurrency(minorAmount: number, currency: CurrencyCode = 'INR', includeDecimals: boolean = false): string {
  const major = toMajorUnits(minorAmount);
  const isNegative = major < 0;
  const absMajor = Math.abs(major);

  let formattedNumber: string;

  if (currency === 'INR') {
    // Indian numbering format (e.g. 15,00,000)
    formattedNumber = absMajor.toLocaleString('en-IN', {
      minimumFractionDigits: includeDecimals ? 2 : 0,
      maximumFractionDigits: includeDecimals ? 2 : 0,
    });
    return `${isNegative ? '-' : ''}₹${formattedNumber}`;
  }

  const symbolMap: Record<CurrencyCode, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const symbol = symbolMap[currency] || '₹';
  formattedNumber = absMajor.toLocaleString('en-US', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  });

  return `${isNegative ? '-' : ''}${symbol}${formattedNumber}`;
}

export function parseDisplayToMinor(input: string): number {
  if (!input) return 0;
  // Strip currency symbols and commas
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || !isFinite(parsed)) return 0;
  return toMinorUnits(parsed);
}
