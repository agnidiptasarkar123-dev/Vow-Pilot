import { describe, it, expect } from 'vitest';
import {
  compareCategoryVendors,
  identifyMissingQuoteDetails,
  draftClarificationMessage,
} from '../domain/vendorEngine';
import { CurrencyCode, Vendor, VendorQuote } from '../types';

describe('Comprehensive Vendor Coordination & Quotation Matrix (200 Parameterized Test Cases)', () => {
  // --------------------------------------------------------------------------
  // Suite 1: Quotation Comparison Matrix & Price Variance (50 cases)
  // --------------------------------------------------------------------------
  const quoteCounts = Array.from({ length: 50 }, (_, i) => (i % 8) + 1); // 1 to 8 quotes

  describe('Side-by-side quotation comparison matrix and variance arithmetic', () => {
    quoteCounts.forEach((numQuotes, idx) => {
      it(`[Case ${idx + 1}] compares ${numQuotes} quotations within category and computes exact variance`, () => {
        const vendors: Vendor[] = Array.from({ length: numQuotes }, (_, k) => ({
          id: `v-test-${idx}-${k}`,
          name: `Vendor ${k}`,
          categoryId: 'catering',
          contactName: `Contact ${k}`,
          email: `vendor${k}@example.com`,
          phone: '+91 9999999999',
          isSample: true,
          createdAt: '2026-10-01',
        }));

        // Prices: 100,000, 200,000, 300,000...
        const quotes: VendorQuote[] = vendors.map((v, k) => ({
          id: `q-test-${idx}-${k}`,
          vendorId: v.id,
          quoteDate: '2026-10-01',
          validityDate: '2026-11-30',
          quotedAmount: (k + 1) * 10000000, // in minor units
          currency: 'INR' as CurrencyCode,
          status: 'under_review',
          includedServices: ['Service A', 'Service B'],
          exclusions: ['Exclusion A'],
          paymentTerms: '50% advance',
          isSample: true,
        }));

        const comparison = compareCategoryVendors('catering', 'Catering', vendors, quotes);

        expect(comparison.quotesCount).toBe(numQuotes);
        expect(comparison.rows).toHaveLength(numQuotes);

        // Compute expected average
        const sum = quotes.reduce((acc, q) => acc + q.quotedAmount, 0);
        const expectedAverage = Math.round(sum / numQuotes);
        expect(comparison.averageQuotedPrice).toBe(expectedAverage);

        // Verify variance on each row
        comparison.rows.forEach((row, k) => {
          expect(row.quote).toBeDefined();
          const expectedDelta = quotes[k].quotedAmount - expectedAverage;
          expect(row.priceDeltaFromAverage).toBe(expectedDelta);
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Multi-Currency Isolation & Currency Mismatch Detection (50 cases)
  // --------------------------------------------------------------------------
  const currencyPermutations: Array<{ primary: CurrencyCode; foreign: CurrencyCode }> = [
    { primary: 'INR', foreign: 'USD' },
    { primary: 'INR', foreign: 'EUR' },
    { primary: 'INR', foreign: 'GBP' },
    { primary: 'USD', foreign: 'INR' },
    { primary: 'USD', foreign: 'EUR' },
    { primary: 'EUR', foreign: 'USD' },
    { primary: 'GBP', foreign: 'INR' },
  ];

  const multiCurrencyCases = Array.from({ length: 50 }, (_, i) => {
    const perm = currencyPermutations[i % currencyPermutations.length];
    return { id: i, primaryCurr: perm.primary, foreignCurr: perm.foreign };
  });

  describe('Multi-currency isolation in quotation averages', () => {
    multiCurrencyCases.forEach(({ id, primaryCurr, foreignCurr }) => {
      it(`[Case ${id + 1}] isolates ${foreignCurr} quote from ${primaryCurr} category average`, () => {
        const v1: Vendor = { id: `v1-${id}`, name: 'Vendor 1', categoryId: 'photography', contactName: 'C1', email: 'v1@ex.com', phone: '111', createdAt: '2026-10-01', isSample: true };
        const v2: Vendor = { id: `v2-${id}`, name: 'Vendor 2', categoryId: 'photography', contactName: 'C2', email: 'v2@ex.com', phone: '222', createdAt: '2026-10-01', isSample: true };
        const v3: Vendor = { id: `v3-${id}`, name: 'Vendor 3', categoryId: 'photography', contactName: 'C3', email: 'v3@ex.com', phone: '333', createdAt: '2026-10-01', isSample: true };

        // 2 quotes in primary currency, 1 quote in foreign currency
        const q1: VendorQuote = {
          id: `q1-${id}`,
          vendorId: v1.id,
          quoteDate: '2026-10-01',
          validityDate: '2026-11-30',
          quotedAmount: 10000000, // 100k
          currency: primaryCurr,
          status: 'under_review',
          includedServices: ['Photo'],
          exclusions: ['Album'],
          paymentTerms: '50/50',
          isSample: true,
        };

        const q2: VendorQuote = {
          id: `q2-${id}`,
          vendorId: v2.id,
          quoteDate: '2026-10-01',
          validityDate: '2026-11-30',
          quotedAmount: 20000000, // 200k
          currency: primaryCurr,
          status: 'under_review',
          includedServices: ['Photo'],
          exclusions: ['Album'],
          paymentTerms: '50/50',
          isSample: true,
        };

        const qForeign: VendorQuote = {
          id: `qf-${id}`,
          vendorId: v3.id,
          quoteDate: '2026-10-01',
          validityDate: '2026-11-30',
          quotedAmount: 500000, // 5k in foreign currency
          currency: foreignCurr,
          status: 'under_review',
          includedServices: ['Photo'],
          exclusions: ['Album'],
          paymentTerms: '100% advance',
          isSample: true,
        };

        const comparison = compareCategoryVendors('photography', 'Photography', [v1, v2, v3], [q1, q2, qForeign]);

        expect(comparison.primaryCurrency).toBe(primaryCurr);
        expect(comparison.hasMixedCurrencies).toBe(true);

        // Average MUST be only between q1 and q2 (150k), NOT contaminated by foreign quote
        expect(comparison.averageQuotedPrice).toBe(15000000);

        // Foreign vendor row must be flagged with currencyMismatch
        const foreignRow = comparison.rows.find((r) => r.vendor.id === v3.id)!;
        expect(foreignRow.currencyMismatch).toBe(true);
        expect(foreignRow.missingDetails.some((d) => d.includes(foreignCurr))).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Missing Quotation Detail Detector (50 cases)
  // --------------------------------------------------------------------------
  const missingDetailFlags = Array.from({ length: 50 }, (_, i) => {
    return {
      id: i,
      hasValidity: i % 2 === 0,
      hasPaymentTerms: i % 3 !== 0,
      hasInclusions: i % 5 !== 0,
      hasExclusions: i % 7 !== 0,
    };
  });

  describe('Missing quotation detail audit combinations', () => {
    missingDetailFlags.forEach(({ id, hasValidity, hasPaymentTerms, hasInclusions, hasExclusions }) => {
      it(`[Case ${id + 1}] identifies missing details (val:${hasValidity}, pay:${hasPaymentTerms}, inc:${hasInclusions}, exc:${hasExclusions})`, () => {
        const quote: VendorQuote = {
          id: `q-missing-${id}`,
          vendorId: `v-${id}`,
          quoteDate: '2026-10-01',
          validityDate: hasValidity ? '2026-11-15' : '',
          quotedAmount: 50000000,
          currency: 'INR',
          status: 'under_review',
          includedServices: hasInclusions ? ['Catering buffet'] : [],
          exclusions: hasExclusions ? ['Taxes and licensing'] : [],
          paymentTerms: hasPaymentTerms ? '30% advance, 70% post-event' : '',
          isSample: true,
        };

        const missing = identifyMissingQuoteDetails(quote, 'Test Caterer');

        if (!hasValidity) {
          expect(missing.some((m) => m.toLowerCase().includes('validity'))).toBe(true);
        }
        if (!hasPaymentTerms) {
          expect(missing.some((m) => m.toLowerCase().includes('payment terms'))).toBe(true);
        }
        if (!hasInclusions) {
          expect(missing.some((m) => m.toLowerCase().includes('included services'))).toBe(true);
        }
        if (!hasExclusions) {
          expect(missing.some((m) => m.toLowerCase().includes('exclusions'))).toBe(true);
        }

        const expectedCount =
          (hasValidity ? 0 : 1) +
          (hasPaymentTerms ? 0 : 1) +
          (hasInclusions ? 0 : 1) +
          (hasExclusions ? 0 : 1);

        expect(missing).toHaveLength(expectedCount);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Clarification Inquiry Generator (50 cases)
  // --------------------------------------------------------------------------
  const clarificationCases = Array.from({ length: 50 }, (_, i) => {
    return {
      id: i,
      contactName: `Vendor Representative ${i}`,
      vendorName: `Supplier Co ${i}`,
      eventName: `Grand Celebration ${i}`,
      eventDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      hasMissingValidity: i % 2 === 0,
    };
  });

  describe('Professional clarification message generation', () => {
    clarificationCases.forEach(({ id, contactName, vendorName, eventName, eventDate, hasMissingValidity }) => {
      it(`[Case ${id + 1}] generates courteous inquiry for ${vendorName}`, () => {
        const vendor: Vendor = {
          id: `v-draft-${id}`,
          name: vendorName,
          categoryId: 'decor',
          contactName,
          email: 'contact@decor.com',
          phone: '+91 9876543210',
          createdAt: '2026-10-01',
          isSample: true,
        };

        const quote: VendorQuote = {
          id: `q-draft-${id}`,
          vendorId: vendor.id,
          quoteDate: '2026-10-01',
          validityDate: hasMissingValidity ? '' : '2026-11-20',
          quotedAmount: 15000000,
          currency: 'INR',
          status: 'under_review',
          includedServices: ['Stage setup'],
          exclusions: [],
          paymentTerms: 'Full payment on arrival',
          isSample: true,
        };

        const msg = draftClarificationMessage(vendor, quote, eventName, eventDate);

        expect(msg).toContain(contactName);
        expect(msg).toContain(eventName);
        expect(msg).toContain(eventDate);
        expect(msg).toContain('clarification');
        expect(msg).toContain('Best regards,');

        if (hasMissingValidity) {
          expect(msg).toMatch(/validity|expiration/i);
        }
      });
    });
  });
});
