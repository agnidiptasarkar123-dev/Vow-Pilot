import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { parseDisplayToMinor } from '../../domain/currency';
import { Vendor, BudgetCategory, VendorQuote, CurrencyCode } from '../../types';

export interface AddQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  categories: BudgetCategory[];
  currency: CurrencyCode;
  defaultVendorId?: string;
  onAddQuote: (quote: Omit<VendorQuote, 'id'>) => void;
}

export const AddQuoteModal: React.FC<AddQuoteModalProps> = ({
  isOpen,
  onClose,
  vendors,
  categories,
  currency,
  defaultVendorId,
  onAddQuote,
}) => {
  const [quoteVendorId, setQuoteVendorId] = useState(defaultVendorId || '');
  const [quoteAmountDisplay, setQuoteAmountDisplay] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [quoteValidity, setQuoteValidity] = useState('');
  const [quoteInclusions, setQuoteInclusions] = useState('');
  const [quoteExclusions, setQuoteExclusions] = useState('');
  const [quotePaymentTerms, setQuotePaymentTerms] = useState('50% advance, 50% on completion');

  React.useEffect(() => {
    if (isOpen) {
      setQuoteVendorId(defaultVendorId || '');
    }
  }, [isOpen, defaultVendorId]);

  const handleSubmit = () => {
    const targetVendorId = quoteVendorId || defaultVendorId || vendors[0]?.id;
    if (!targetVendorId) return;

    const amountMinor = parseDisplayToMinor(quoteAmountDisplay);
    if (amountMinor <= 0) return;

    onAddQuote({
      vendorId: targetVendorId,
      quoteDate,
      validityDate: quoteValidity || undefined,
      quotedAmount: amountMinor,
      currency,
      status: 'under_review',
      includedServices: quoteInclusions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      exclusions: quoteExclusions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      paymentTerms: quotePaymentTerms,
      isSample: false,
    });

    setQuoteAmountDisplay('');
    setQuoteInclusions('');
    setQuoteExclusions('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Vendor Quotation"
      description="Record itemized pricing, validity dates, and contractual scope."
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-primary mb-1">Select Supplier *</label>
          <select
            value={quoteVendorId || defaultVendorId}
            onChange={(e) => setQuoteVendorId(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
          >
            <option value="">Select a vendor...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({categories.find((c) => c.id === v.categoryId)?.name})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-primary mb-1">
              Quoted Amount ({currency}) *
            </label>
            <input
              type="text"
              value={quoteAmountDisplay}
              onChange={(e) => setQuoteAmountDisplay(e.target.value)}
              placeholder="e.g. 350000"
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label className="block font-semibold text-primary mb-1">Quote Validity Date</label>
            <input
              type="date"
              value={quoteValidity}
              onChange={(e) => setQuoteValidity(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-primary mb-1">Quote Received Date</label>
          <input
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
          />
        </div>

        <div>
          <label className="block font-semibold text-primary mb-1">
            Included Services (One per line)
          </label>
          <textarea
            rows={3}
            value={quoteInclusions}
            onChange={(e) => setQuoteInclusions(e.target.value)}
            placeholder="Courtyard sound equipment&#10;Wireless microphones&#10;On-site technician"
            className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
          />
        </div>

        <div>
          <label className="block font-semibold text-primary mb-1">
            Explicit Exclusions (One per line)
          </label>
          <textarea
            rows={2}
            value={quoteExclusions}
            onChange={(e) => setQuoteExclusions(e.target.value)}
            placeholder="Overtime beyond 10 PM&#10;Power generator fuel"
            className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
          />
        </div>

        <div>
          <label className="block font-semibold text-primary mb-1">Payment Terms</label>
          <input
            type="text"
            value={quotePaymentTerms}
            onChange={(e) => setQuotePaymentTerms(e.target.value)}
            placeholder="e.g. 50% advance on booking, 50% on event date"
            className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-subtle rounded-md text-secondary hover:bg-subtle cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold rounded-md shadow-xs cursor-pointer"
          >
            Record Proposal
          </button>
        </div>
      </div>
    </Modal>
  );
};
