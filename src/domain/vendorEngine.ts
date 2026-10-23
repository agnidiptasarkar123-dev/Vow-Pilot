import { Vendor, VendorQuote } from '../types';
import { formatCurrency } from './currency';

export interface MissingQuoteDetail {
  quoteId: string;
  vendorName: string;
  missingFields: string[];
}

export interface VendorComparisonRow {
  vendor: Vendor;
  quote?: VendorQuote;
  priceDeltaFromAverage: number;
  isExpired: boolean;
  missingDetails: string[];
  currencyMismatch?: boolean;
}

export interface CategoryVendorComparison {
  categoryId: string;
  categoryName: string;
  averageQuotedPrice: number;
  primaryCurrency?: string;
  hasMixedCurrencies: boolean;
  quotesCount: number;
  rows: VendorComparisonRow[];
}

/**
 * Checks for missing quotation details:
 * Validity date, payment terms, inclusions, or exclusions.
 */
export function identifyMissingQuoteDetails(
  quote: VendorQuote,
  _vendorName?: string
): string[] {
  const missing: string[] = [];

  if (!quote.validityDate || quote.validityDate.trim() === '') {
    missing.push('Quote validity expiration date not specified');
  }

  if (!quote.paymentTerms || quote.paymentTerms.trim() === '') {
    missing.push('Payment terms and milestone schedule missing');
  }

  if (!quote.includedServices || quote.includedServices.length === 0) {
    missing.push('No itemized included services documented');
  }

  if (!quote.exclusions || quote.exclusions.length === 0) {
    missing.push('Explicit service exclusions (e.g., overtime, taxes, delivery) missing');
  }

  return missing;
}

/**
 * Generates category-level side-by-side comparisons of vendors and their quotes.
 */
export function compareCategoryVendors(
  categoryId: string,
  categoryName: string,
  vendors: Vendor[],
  quotes: VendorQuote[],
  currentDateIso: string = new Date().toISOString().split('T')[0]
): CategoryVendorComparison {
  const catVendors = vendors.filter((v) => v.categoryId === categoryId);
  const catQuotes = quotes.filter((q) => catVendors.some((v) => v.id === q.vendorId));

  // Determine primary currency (most common currency among category quotes, or INR default)
  const currencyCounts = new Map<string, number>();
  for (const q of catQuotes) {
    if (q.currency) {
      currencyCounts.set(q.currency, (currencyCounts.get(q.currency) || 0) + 1);
    }
  }

  let primaryCurrency = 'INR';
  let maxCount = 0;
  for (const [curr, count] of currencyCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      primaryCurrency = curr;
    }
  }

  const hasMixedCurrencies = currencyCounts.size > 1;

  let totalQuoted = 0;
  let quoteCount = 0;
  for (const q of catQuotes) {
    // Only average quotes matching primary currency to avoid cross-currency skew
    if (q.quotedAmount > 0 && q.currency === primaryCurrency) {
      totalQuoted += q.quotedAmount;
      quoteCount++;
    }
  }

  const averageQuotedPrice = quoteCount > 0 ? Math.round(totalQuoted / quoteCount) : 0;

  const rows: VendorComparisonRow[] = catVendors.map((vendor) => {
    // Take the active or most recent quote
    const vendorQuote = catQuotes.find((q) => q.vendorId === vendor.id);
    const isExpired = !!(vendorQuote?.validityDate && vendorQuote.validityDate < currentDateIso);
    const missingDetails = vendorQuote
      ? identifyMissingQuoteDetails(vendorQuote, vendor.name)
      : ['No formal quotation submitted yet'];

    const currencyMismatch = !!(vendorQuote && vendorQuote.currency !== primaryCurrency);
    if (currencyMismatch && vendorQuote) {
      missingDetails.push(`Quoted in ${vendorQuote.currency} (differs from category standard ${primaryCurrency})`);
    }

    const priceDeltaFromAverage = (vendorQuote && !currencyMismatch)
      ? vendorQuote.quotedAmount - averageQuotedPrice
      : 0;

    return {
      vendor,
      quote: vendorQuote,
      priceDeltaFromAverage,
      isExpired,
      missingDetails,
      currencyMismatch,
    };
  });

  return {
    categoryId,
    categoryName,
    averageQuotedPrice,
    primaryCurrency,
    hasMixedCurrencies,
    quotesCount: catQuotes.length,
    rows,
  };
}

/**
 * Drafts a professional clarification inquiry to a vendor regarding missing quote specifications.
 */
export function draftClarificationMessage(
  vendor: Vendor,
  quote: VendorQuote,
  eventName: string,
  eventDate: string
): string {
  const missing = identifyMissingQuoteDetails(quote, vendor.name);

  let inquiries = '';
  if (missing.length > 0) {
    inquiries = missing.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
  } else {
    inquiries = '1. Confirmation of staff overtime hourly rates\n2. Cancellation and force majeure terms';
  }

  return `Dear ${vendor.contactName || vendor.name},\n\n` +
    `Thank you for providing the quote for our upcoming event, "${eventName}", scheduled for ${eventDate}.\n\n` +
    `We are currently reviewing quotations and would appreciate clarification on the following specific points before we finalize our selection:\n\n` +
    `${inquiries}\n\n` +
    `Please also confirm if your current proposal of ${formatCurrency(quote.quotedAmount, quote.currency)} remains valid through our review window.\n\n` +
    `Best regards,\nEvent Planning Coordinator`;
}
