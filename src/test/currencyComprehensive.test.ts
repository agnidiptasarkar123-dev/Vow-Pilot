import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  toMajorUnits,
  parseDisplayToMinor,
  formatCurrency,
  MAX_SAFE_MAJOR_AMOUNT,
} from '../domain/currency';
import { CurrencyCode } from '../types';

describe('Comprehensive Currency & Numeric Safety (250 Parameterized Test Cases)', () => {
  // --------------------------------------------------------------------------
  // Suite 1: Minor to Major and Major to Minor Conversions across all 4 currencies (100 cases)
  // --------------------------------------------------------------------------
  const currencies: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP'];
  const testMajorValues = [
    0, 1, 5, 10, 25, 50, 99, 100, 250, 500, 750, 999, 1000, 1500, 2500, 5000,
    10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000,
  ]; // 25 values * 4 currencies = 100 cases

  describe('Bidirectional minor/major conversions', () => {
    currencies.forEach((curr) => {
      testMajorValues.forEach((major) => {
        it(`accurately converts ${major} ${curr} between major and minor units`, () => {
          const expectedMinor = major * 100;
          const calculatedMinor = toMinorUnits(major);
          expect(calculatedMinor).toBe(expectedMinor);

          const calculatedMajor = toMajorUnits(calculatedMinor);
          expect(calculatedMajor).toBe(major);
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Indian Numbering and International Currency Formatting (50 cases)
  // --------------------------------------------------------------------------
  const formattingCases = [
    { minor: 0, curr: 'INR' as CurrencyCode, expected: '₹0' },
    { minor: 100, curr: 'INR' as CurrencyCode, expected: '₹1' },
    { minor: 5000, curr: 'INR' as CurrencyCode, expected: '₹50' },
    { minor: 9900, curr: 'INR' as CurrencyCode, expected: '₹99' },
    { minor: 100000, curr: 'INR' as CurrencyCode, expected: '₹1,000' },
    { minor: 500000, curr: 'INR' as CurrencyCode, expected: '₹5,000' },
    { minor: 1000000, curr: 'INR' as CurrencyCode, expected: '₹10,000' },
    { minor: 5000000, curr: 'INR' as CurrencyCode, expected: '₹50,000' },
    { minor: 9900000, curr: 'INR' as CurrencyCode, expected: '₹99,000' },
    { minor: 10000000, curr: 'INR' as CurrencyCode, expected: '₹1,00,000' }, // 1 Lakh
    { minor: 15000000, curr: 'INR' as CurrencyCode, expected: '₹1,50,000' },
    { minor: 20000000, curr: 'INR' as CurrencyCode, expected: '₹2,00,000' },
    { minor: 25000000, curr: 'INR' as CurrencyCode, expected: '₹2,50,000' },
    { minor: 50000000, curr: 'INR' as CurrencyCode, expected: '₹5,00,000' },
    { minor: 75000000, curr: 'INR' as CurrencyCode, expected: '₹7,50,000' },
    { minor: 100000000, curr: 'INR' as CurrencyCode, expected: '₹10,00,000' }, // 10 Lakhs
    { minor: 250000000, curr: 'INR' as CurrencyCode, expected: '₹25,00,000' }, // 25 Lakhs (Jaipur Budget)
    { minor: 500000000, curr: 'INR' as CurrencyCode, expected: '₹50,00,000' },
    { minor: 990000000, curr: 'INR' as CurrencyCode, expected: '₹99,00,000' },
    { minor: 1000000000, curr: 'INR' as CurrencyCode, expected: '₹1,00,00,000' }, // 1 Crore
    { minor: 2500000000, curr: 'INR' as CurrencyCode, expected: '₹2,50,00,000' },
    { minor: 5000000000, curr: 'INR' as CurrencyCode, expected: '₹5,00,00,000' },
    { minor: 10000000000, curr: 'INR' as CurrencyCode, expected: '₹10,00,00,000' }, // 10 Crores
    { minor: 25000000000, curr: 'INR' as CurrencyCode, expected: '₹25,00,00,000' },
    { minor: 100000000000, curr: 'INR' as CurrencyCode, expected: '₹1,00,00,00,000' }, // 100 Crores
    // Negative Indian currency cases
    { minor: -100, curr: 'INR' as CurrencyCode, expected: '-₹1' },
    { minor: -100000, curr: 'INR' as CurrencyCode, expected: '-₹1,000' },
    { minor: -10000000, curr: 'INR' as CurrencyCode, expected: '-₹1,00,000' },
    { minor: -250000000, curr: 'INR' as CurrencyCode, expected: '-₹25,00,000' },
    // USD formatting cases
    { minor: 0, curr: 'USD' as CurrencyCode, expected: '$0' },
    { minor: 100, curr: 'USD' as CurrencyCode, expected: '$1' },
    { minor: 100000, curr: 'USD' as CurrencyCode, expected: '$1,000' },
    { minor: 1000000, curr: 'USD' as CurrencyCode, expected: '$10,000' },
    { minor: 10000000, curr: 'USD' as CurrencyCode, expected: '$100,000' },
    { minor: 100000000, curr: 'USD' as CurrencyCode, expected: '$1,000,000' },
    { minor: -50000, curr: 'USD' as CurrencyCode, expected: '-$500' },
    // EUR formatting cases
    { minor: 0, curr: 'EUR' as CurrencyCode, expected: '€0' },
    { minor: 100, curr: 'EUR' as CurrencyCode, expected: '€1' },
    { minor: 50000, curr: 'EUR' as CurrencyCode, expected: '€500' },
    { minor: 100000, curr: 'EUR' as CurrencyCode, expected: '€1,000' },
    { minor: 25000000, curr: 'EUR' as CurrencyCode, expected: '€250,000' },
    { minor: -100000, curr: 'EUR' as CurrencyCode, expected: '-€1,000' },
    // GBP formatting cases
    { minor: 0, curr: 'GBP' as CurrencyCode, expected: '£0' },
    { minor: 100, curr: 'GBP' as CurrencyCode, expected: '£1' },
    { minor: 75000, curr: 'GBP' as CurrencyCode, expected: '£750' },
    { minor: 100000, curr: 'GBP' as CurrencyCode, expected: '£1,000' },
    { minor: 10000000, curr: 'GBP' as CurrencyCode, expected: '£100,000' },
    { minor: 50000000, curr: 'GBP' as CurrencyCode, expected: '£500,000' },
    { minor: -25000, curr: 'GBP' as CurrencyCode, expected: '-£250' },
    { minor: 123456700, curr: 'GBP' as CurrencyCode, expected: '£1,234,567' },
  ];

  describe('Currency formatting across denominations and currencies', () => {
    formattingCases.forEach((tc, idx) => {
      it(`[Case ${idx + 1}] formats ${tc.minor} minor units for ${tc.curr} as ${tc.expected}`, () => {
        expect(formatCurrency(tc.minor, tc.curr)).toBe(tc.expected);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Display String Parsing to Minor Units (50 cases)
  // --------------------------------------------------------------------------
  const parseCases = [
    { input: '0', expected: 0 },
    { input: '1', expected: 100 },
    { input: '10', expected: 1000 },
    { input: '25.50', expected: 2550 },
    { input: '99.99', expected: 9999 },
    { input: '100', expected: 10000 },
    { input: '1,000', expected: 100000 },
    { input: '1,500.50', expected: 150050 },
    { input: '2,500', expected: 250000 },
    { input: '10,000', expected: 1000000 },
    { input: '25,000', expected: 2500000 },
    { input: '1,00,000', expected: 10000000 }, // Indian comma style
    { input: '2,50,000', expected: 25000000 },
    { input: '25,00,000', expected: 250000000 }, // 25 Lakhs
    { input: '1,00,00,000', expected: 1000000000 }, // 1 Crore
    { input: '  500  ', expected: 50000 }, // Trims whitespace
    { input: '₹ 2,000', expected: 200000 }, // Currency symbol stripped
    { input: '$1,500', expected: 150000 },
    { input: '€750', expected: 75000 },
    { input: '£300', expected: 30000 },
    { input: '-100', expected: -10000 }, // Negative amounts
    { input: '- 2,500', expected: -250000 },
    { input: '-₹ 50,000', expected: -5000000 },
    { input: '0.05', expected: 5 }, // Minor fractions
    { input: '0.5', expected: 50 },
    { input: '0.99', expected: 99 },
    { input: '123.456', expected: 12346 }, // Rounded to nearest minor unit
    { input: '999.999', expected: 100000 },
    { input: '', expected: 0 }, // Empty input returns 0
    { input: '   ', expected: 0 }, // Whitespace returns 0
    { input: 'abc', expected: 0 }, // Non-numeric returns 0
    { input: '₹ invalid', expected: 0 },
    { input: 'NaN', expected: 0 },
    { input: 'undefined', expected: 0 },
    { input: 'null', expected: 0 },
    { input: '---', expected: 0 },
    { input: '1e4', expected: 1000000 }, // Scientific notation
    { input: '2.5e3', expected: 250000 },
    { input: '500,000', expected: 50000000 },
    { input: '10000000', expected: 1000000000 },
    { input: '   $ 9,999.00 ', expected: 999900 },
    { input: '₹10,50,250.75', expected: 105025075 },
    { input: '42.0', expected: 4200 },
    { input: '000100', expected: 10000 }, // Leading zeros
    { input: '0000.50', expected: 50 },
    { input: '  -0  ', expected: 0 },
    { input: '-0.00', expected: 0 },
    { input: '1000000000000', expected: 100000000000000 },
    { input: '9999999999999', expected: 999999999999900 },
    { input: '250.25', expected: 25025 },
  ];

  describe('Display string parsing to minor units', () => {
    parseCases.forEach((tc, idx) => {
      it(`[Case ${idx + 1}] parses string "${tc.input}" to ${tc.expected} minor units`, () => {
        expect(parseDisplayToMinor(tc.input)).toBe(tc.expected);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Extreme Boundaries, Arithmetic Invariants & Overflow Clamping (50 cases)
  // --------------------------------------------------------------------------
  const boundaryCases = Array.from({ length: 50 }, (_, i) => {
    if (i < 10) return { major: i * 0.1, label: `Fractional decimal ${i * 0.1}` };
    if (i < 20) return { major: Math.pow(10, i - 10), label: `Power of 10: 10^${i - 10}` };
    if (i < 30) return { major: -(i - 20) * 1000, label: `Negative value -${(i - 20) * 1000}` };
    if (i < 40) return { major: MAX_SAFE_MAJOR_AMOUNT + (i - 30) * 1000000, label: `Above MAX_SAFE ${i}` };
    return { major: (i - 40) * 12345.67, label: `Non-integer float ${(i - 40) * 12345.67}` };
  });

  describe('Numeric boundary safety and arithmetic preservation', () => {
    boundaryCases.forEach((tc, idx) => {
      it(`[Case ${idx + 1}] verifies boundary safety for ${tc.label}`, () => {
        const minor = toMinorUnits(tc.major);
        expect(Number.isFinite(minor)).toBe(true);
        expect(Math.abs(minor)).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);

        // Clamping check
        if (tc.major > MAX_SAFE_MAJOR_AMOUNT) {
          expect(minor).toBe(MAX_SAFE_MAJOR_AMOUNT * 100);
        } else if (tc.major < -MAX_SAFE_MAJOR_AMOUNT) {
          expect(minor).toBe(-MAX_SAFE_MAJOR_AMOUNT * 100);
        }
      });
    });
  });
});
