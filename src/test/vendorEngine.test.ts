import { describe, it, expect } from 'vitest';
import {
  compareCategoryVendors,
  draftClarificationMessage,
  identifyMissingQuoteDetails,
} from '../domain/vendorEngine';
import { Vendor, VendorQuote } from '../types';

describe('Vendor Coordination Engine', () => {
  const ONE_INR = 100;

  const sampleVendor: Vendor = {
    id: 'ven-1',
    name: 'Sample Visuals Co.',
    categoryId: 'photography',
    contactName: 'Neha Sen',
    email: 'neha@sample.example',
    phone: '+91 98000 00000',
    isSample: true,
    createdAt: '2026-09-01',
  };

  it('identifies missing quotation details strictly', () => {
    const incompleteQuote: VendorQuote = {
      id: 'q-incomplete',
      vendorId: 'ven-1',
      quoteDate: '2026-10-01',
      validityDate: '', // Missing
      quotedAmount: 250000 * ONE_INR,
      currency: 'INR',
      status: 'under_review',
      includedServices: ['Standard Photography'],
      exclusions: [], // Missing
      paymentTerms: '', // Missing
      isSample: true,
    };

    const missing = identifyMissingQuoteDetails(incompleteQuote, sampleVendor.name);
    expect(missing).toContain('Quote validity expiration date not specified');
    expect(missing).toContain('Payment terms and milestone schedule missing');
    expect(missing).toContain('Explicit service exclusions (e.g., overtime, taxes, delivery) missing');
  });

  it('detects quote expiration relative to current date', () => {
    const expiredQuote: VendorQuote = {
      id: 'q-expired',
      vendorId: 'ven-1',
      quoteDate: '2026-09-01',
      validityDate: '2026-10-01', // Expired
      quotedAmount: 200000 * ONE_INR,
      currency: 'INR',
      status: 'expired',
      includedServices: ['Standard Photography'],
      exclusions: ['Travel costs'],
      paymentTerms: '50% advance',
      isSample: true,
    };

    const comparison = compareCategoryVendors(
      'photography',
      'Photography',
      [sampleVendor],
      [expiredQuote],
      '2026-10-23'
    );

    expect(comparison.rows[0].isExpired).toBe(true);
  });

  it('drafts a professional clarification inquiry with missing fields itemized', () => {
    const quoteWithMissingDetails: VendorQuote = {
      id: 'q-draft',
      vendorId: 'ven-1',
      quoteDate: '2026-10-01',
      validityDate: '',
      quotedAmount: 300000 * ONE_INR,
      currency: 'INR',
      status: 'under_review',
      includedServices: ['Full day coverage'],
      exclusions: [],
      paymentTerms: '',
      isSample: true,
    };

    const message = draftClarificationMessage(
      sampleVendor,
      quoteWithMissingDetails,
      'Aarav & Meera Wedding',
      '2026-12-18'
    );

    expect(message).toContain('Dear Neha Sen');
    expect(message).toContain('Quote validity expiration date not specified');
    expect(message).toContain('Payment terms and milestone schedule missing');
    expect(message).toContain('₹3,00,000');
  });
});
