import { describe, it, expect } from 'vitest';
import { formatCurrency, parseDisplayToMinor, toMajorUnits, toMinorUnits } from '../domain/currency';

describe('Currency and Minor Unit Calculations', () => {
  it('converts major units to integer minor units safely without floating point drift', () => {
    expect(toMinorUnits(1500.5)).toBe(150050);
    expect(toMinorUnits(0)).toBe(0);
    expect(toMinorUnits(-250)).toBe(-25000);
  });

  it('converts minor units back to major units', () => {
    expect(toMajorUnits(150050)).toBe(1500.5);
    expect(toMajorUnits(0)).toBe(0);
  });

  it('formats INR using standard Indian numbering system', () => {
    // 25,00,000 INR = 250000000 minor units
    const formatted = formatCurrency(250000000, 'INR');
    expect(formatted).toBe('₹25,00,000');
  });

  it('formats negative currency correctly', () => {
    const formatted = formatCurrency(-50000, 'INR');
    expect(formatted).toBe('-₹500');
  });

  it('parses formatted strings back to minor units', () => {
    expect(parseDisplayToMinor('₹25,00,000')).toBe(250000000);
    expect(parseDisplayToMinor('$1,500.50')).toBe(150050);
  });
});
