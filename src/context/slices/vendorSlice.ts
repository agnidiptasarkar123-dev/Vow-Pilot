import { AppState, Vendor, VendorQuote } from '../../types';
import { createChangeRecord } from './recordChange';

export const handleAddVendor = (
  state: AppState,
  vendorData: Omit<Vendor, 'id' | 'createdAt'>
): AppState => {
  const newVendor: Vendor = {
    ...vendorData,
    id: `ven-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    vendors: [...state.vendors, newVendor],
    changeLog: [
      createChangeRecord('vendor', `Added vendor "${newVendor.name}"`),
      ...state.changeLog,
    ],
  };
};

export const handleUpdateVendor = (state: AppState, vendor: Vendor): AppState => {
  return {
    ...state,
    vendors: state.vendors.map((v) => (v.id === vendor.id ? vendor : v)),
    changeLog: [
      createChangeRecord('vendor', `Updated vendor details for "${vendor.name}"`),
      ...state.changeLog,
    ],
  };
};

export const handleDeleteVendor = (state: AppState, vendorId: string): AppState => {
  const vendor = state.vendors.find((v) => v.id === vendorId);
  return {
    ...state,
    vendors: state.vendors.filter((v) => v.id !== vendorId),
    quotes: state.quotes.filter((q) => q.vendorId !== vendorId),
    changeLog: [
      createChangeRecord('vendor', `Removed vendor "${vendor?.name || vendorId}"`),
      ...state.changeLog,
    ],
  };
};

export const handleAddQuote = (
  state: AppState,
  quoteData: Omit<VendorQuote, 'id'>
): AppState => {
  const newQuote: VendorQuote = {
    ...quoteData,
    id: `quo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  };
  const vendor = state.vendors.find((v) => v.id === newQuote.vendorId);

  return {
    ...state,
    quotes: [...state.quotes, newQuote],
    changeLog: [
      createChangeRecord('vendor', `Added quotation from "${vendor?.name || 'Vendor'}"`),
      ...state.changeLog,
    ],
  };
};

export const handleUpdateQuote = (state: AppState, quote: VendorQuote): AppState => {
  return {
    ...state,
    quotes: state.quotes.map((q) => (q.id === quote.id ? quote : q)),
    changeLog: [
      createChangeRecord('vendor', `Updated quote ${quote.id}`),
      ...state.changeLog,
    ],
  };
};

export const handleSelectQuote = (state: AppState, quoteId: string): AppState => {
  const selectedQuote = state.quotes.find((q) => q.id === quoteId);
  if (!selectedQuote) return state;

  const vendor = state.vendors.find((v) => v.id === selectedQuote.vendorId);
  const categoryId = vendor?.categoryId;

  // Mark selected quote, and mark other quotes in the same category as rejected
  const updatedQuotes = state.quotes.map((q) => {
    if (q.id === quoteId) return { ...q, status: 'selected' as const };
    const qVendor = state.vendors.find((v) => v.id === q.vendorId);
    if (categoryId && qVendor?.categoryId === categoryId && q.status === 'selected') {
      return { ...q, status: 'rejected' as const };
    }
    return q;
  });

  // Update or create corresponding confirmed/quoted expense
  const existingExpenseIndex = state.expenses.findIndex((e) => e.quoteId === quoteId);
  const updatedExpenses = [...state.expenses];

  if (existingExpenseIndex >= 0) {
    updatedExpenses[existingExpenseIndex] = {
      ...updatedExpenses[existingExpenseIndex],
      status: 'confirmed',
      amount: selectedQuote.quotedAmount,
    };
  } else if (categoryId) {
    updatedExpenses.push({
      id: `exp-${Date.now()}`,
      categoryId,
      title: `${vendor?.name || 'Vendor'} Proposal`,
      amount: selectedQuote.quotedAmount,
      status: 'confirmed',
      vendorId: vendor?.id,
      quoteId: selectedQuote.id,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    ...state,
    quotes: updatedQuotes,
    expenses: updatedExpenses,
    changeLog: [
      createChangeRecord('vendor', `Selected quotation from "${vendor?.name || 'Vendor'}"`),
      ...state.changeLog,
    ],
  };
};

export const handleRecordVendorInquiry = (
  state: AppState,
  quoteId: string,
  vendorId: string,
  method: 'email_client' | 'clipboard_handoff'
): AppState => {
  const vendor = state.vendors.find((v) => v.id === vendorId);
  return {
    ...state,
    changeLog: [
      createChangeRecord(
        'vendor',
        `Dispatched clarification inquiry to "${vendor?.name || vendorId}" via ${
          method === 'email_client' ? 'external email client (RFC-6068)' : 'clipboard draft handoff'
        }`,
        `Quote ID: ${quoteId}`
      ),
      ...state.changeLog,
    ],
  };
};
