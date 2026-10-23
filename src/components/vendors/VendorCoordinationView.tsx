import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { compareCategoryVendors, draftClarificationMessage } from '../../domain/vendorEngine';
import { formatCurrency, parseDisplayToMinor } from '../../domain/currency';
import { Vendor, VendorQuote } from '../../types';
import { Modal } from '../common/Modal';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Mail,
  Phone,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

export const VendorCoordinationView: React.FC = () => {
  const {
    state,
    addVendor,
    deleteVendor,
    addQuote,
    selectQuote,
  } = useEvent();

  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>(
    state.categories[0]?.id || 'venue'
  );

  // Clarification Draft Modal
  const [clarificationModal, setClarificationModal] = useState<{
    vendor: Vendor;
    quote: VendorQuote;
    message: string;
  } | null>(null);
  const [hasCopiedDraft, setHasCopiedDraft] = useState(false);

  // Add Vendor Modal
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorWebsite, setVendorWebsite] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');

  // Add Quote Modal
  const [isAddQuoteOpen, setIsAddQuoteOpen] = useState(false);
  const [quoteVendorId, setQuoteVendorId] = useState('');
  const [quoteAmountDisplay, setQuoteAmountDisplay] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [quoteValidity, setQuoteValidity] = useState('');
  const [quoteInclusions, setQuoteInclusions] = useState('');
  const [quoteExclusions, setQuoteExclusions] = useState('');
  const [quotePaymentTerms, setQuotePaymentTerms] = useState('50% advance, 50% on completion');

  const activeCategory = state.categories.find((c) => c.id === selectedCategoryTab) || state.categories[0];
  const comparison = compareCategoryVendors(
    activeCategory.id,
    activeCategory.name,
    state.vendors,
    state.quotes
  );

  const handleOpenClarification = (vendor: Vendor, quote: VendorQuote) => {
    const draft = draftClarificationMessage(
      vendor,
      quote,
      state.event.name,
      state.event.date
    );
    setClarificationModal({ vendor, quote, message: draft });
    setHasCopiedDraft(false);
  };

  const handleCopyDraft = async () => {
    if (clarificationModal) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(clarificationModal.message);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = clarificationModal.message;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        setHasCopiedDraft(true);
        setTimeout(() => setHasCopiedDraft(false), 2500);
      } catch (err) {
        console.warn('Clipboard copy error:', err);
      }
    }
  };

  const handleCreateVendor = () => {
    if (!vendorName.trim()) return;
    addVendor({
      name: vendorName.trim(),
      categoryId: selectedCategoryTab,
      contactName: vendorContact.trim(),
      email: vendorEmail.trim(),
      phone: vendorPhone.trim(),
      website: vendorWebsite.trim() || undefined,
      notes: vendorNotes.trim() || undefined,
      isSample: false, // User created vendors are not demo samples!
    });
    setVendorName('');
    setVendorContact('');
    setVendorEmail('');
    setVendorPhone('');
    setVendorWebsite('');
    setVendorNotes('');
    setIsAddVendorOpen(false);
  };

  const handleCreateQuote = () => {
    if (!quoteVendorId) return;
    const amountMinor = parseDisplayToMinor(quoteAmountDisplay);
    if (amountMinor <= 0) return;

    addQuote({
      vendorId: quoteVendorId,
      quoteDate,
      validityDate: quoteValidity || undefined,
      quotedAmount: amountMinor,
      currency: state.event.currency,
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

    setIsAddQuoteOpen(false);
  };

  const handleDeleteVendorWithConfirm = (vendorId: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove vendor "${name}" and all associated quotations?`)) {
      deleteVendor(vendorId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-heading">
            Vendor Directory & Quotation Matrix
          </h1>
          <p className="text-xs text-[#78716C] mt-1">
            Compare service inclusions side-by-side, detect missing contract terms, and draft clarification requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setQuoteVendorId(comparison.rows[0]?.vendor.id || state.vendors[0]?.id || '');
              setIsAddQuoteOpen(true);
            }}
            className="px-3.5 py-2 rounded-md bg-white border border-[#D5CCC0] text-[#1C1917] hover:bg-[#FAF8F5] text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#A2421D]" />
            Log Quotation
          </button>
          <button
            onClick={() => setIsAddVendorOpen(true)}
            className="px-4 py-2 rounded-md bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 border-b border-[#E6DFD5] pb-2">
        {state.categories.map((cat) => {
          const catVendorCount = state.vendors.filter((v) => v.categoryId === cat.id).length;
          const isSelected = selectedCategoryTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryTab(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-2 ${
                isSelected
                  ? 'bg-[#1C1917] text-white font-bold shadow-xs'
                  : 'bg-white text-[#5C554E] hover:text-[#1C1917] border border-[#E6DFD5]'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#FAF8F5] text-[#78716C]'
                }`}
              >
                {catVendorCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Quotation Matrix Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between text-xs text-[#78716C]">
          <span>
            Showing quotations for <strong>{activeCategory.name}</strong> • Category Average:{' '}
            <span className="font-mono font-semibold text-[#1C1917]">
              {formatCurrency(comparison.averageQuotedPrice, state.event.currency)}
            </span>
          </span>
          <span>Lowest quote is not automatically recommended</span>
        </div>

        {comparison.rows.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-[#E6DFD5] text-xs text-[#78716C] space-y-3">
            <p>No vendor records registered under {activeCategory.name}.</p>
            <button
              onClick={() => setIsAddVendorOpen(true)}
              className="px-4 py-2 rounded-md bg-[#A2421D] text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Supplier in {activeCategory.name}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comparison.rows.map((row) => {
              const vendor = row.vendor;
              const quote = row.quote;
              const isSelected = quote?.status === 'selected';
              const isExpired = row.isExpired;
              const hasMissingDetails = row.missingDetails.length > 0;

              return (
                <div
                  key={vendor.id}
                  className={`bg-white rounded-xl border p-5 flex flex-col justify-between transition shadow-xs relative ${
                    isSelected
                      ? 'border-[#047857] ring-1 ring-[#047857]'
                      : isExpired
                      ? 'border-amber-300'
                      : 'border-[#E6DFD5]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Name and Sample Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-[#1C1917] font-serif-heading">
                            {vendor.name}
                          </h3>
                        </div>
                        {vendor.isSample && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            Fictional Demonstration Record
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteVendorWithConfirm(vendor.id, vendor.name)}
                        className="p-1 rounded text-neutral-400 hover:text-red-600 transition"
                        title="Delete Vendor"
                        aria-label={`Delete vendor: ${vendor.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Contact & Rating info */}
                    <div className="text-xs text-[#78716C] space-y-1">
                      {vendor.contactName && (
                        <p className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#1C1917]">Contact:</span> {vendor.contactName}
                        </p>
                      )}
                      {vendor.email && (
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{vendor.email}</span>
                        </p>
                      )}
                      {vendor.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{vendor.phone}</span>
                        </p>
                      )}
                      {vendor.rating && (
                        <p className="flex items-center gap-1 text-amber-700">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span className="font-bold">{vendor.rating}</span>
                          <span className="text-[10px] text-[#78716C]">({vendor.ratingSource})</span>
                        </p>
                      )}
                    </div>

                    {/* Quotation Pricing Strip */}
                    <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#78716C] font-semibold">
                          Quoted Price
                        </span>
                        {quote && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isSelected
                                ? 'bg-emerald-100 text-[#047857]'
                                : quote.status === 'expired'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {quote.status.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="text-xl font-bold font-mono text-[#1C1917]">
                        {quote ? formatCurrency(quote.quotedAmount, quote.currency) : 'No formal quote'}
                      </div>

                      {quote && comparison.averageQuotedPrice > 0 && (
                        <span
                          className={`text-[11px] font-mono block ${
                            row.priceDeltaFromAverage > 0 ? 'text-[#BE123C]' : 'text-[#047857]'
                          }`}
                        >
                          {row.priceDeltaFromAverage >= 0 ? '+' : ''}
                          {formatCurrency(row.priceDeltaFromAverage, quote.currency)} vs avg
                        </span>
                      )}
                    </div>

                    {/* Expiration or Missing Details Alert */}
                    {quote && isExpired && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-[#BE123C] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Quotation Expired:</span> Validity expired on {quote.validityDate}. Rate must be re-confirmed with supplier.
                        </div>
                      </div>
                    )}

                    {quote && hasMissingDetails && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                        <div className="flex items-center gap-1 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
                          <span>Missing Quotation Details:</span>
                        </div>
                        <ul className="list-disc list-inside text-[11px] space-y-0.5">
                          {row.missingDetails.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Inclusions & Exclusions */}
                    {quote && (
                      <div className="space-y-2 text-xs pt-1">
                        <div>
                          <span className="font-semibold text-[#1C1917] block mb-1">
                            Included Services ({quote.includedServices.length}):
                          </span>
                          <ul className="space-y-0.5 text-[11px] text-[#5C554E]">
                            {quote.includedServices.slice(0, 3).map((inc, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-[#047857] font-bold">✓</span> {inc}
                              </li>
                            ))}
                            {quote.includedServices.length > 3 && (
                              <li className="text-[10px] text-[#78716C] pl-3">
                                +{quote.includedServices.length - 3} more itemized items
                              </li>
                            )}
                          </ul>
                        </div>

                        {quote.exclusions.length > 0 && (
                          <div>
                            <span className="font-semibold text-[#BE123C] block mb-1">
                              Explicit Exclusions ({quote.exclusions.length}):
                            </span>
                            <ul className="space-y-0.5 text-[11px] text-[#78716C]">
                              {quote.exclusions.map((exc, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-[#BE123C]">✕</span> {exc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Strip */}
                    <div className="pt-4 border-t border-[#F4EFEA] flex items-center justify-between gap-2 mt-4">
                      {quote ? (
                        <>
                          <button
                            onClick={() => handleOpenClarification(vendor, quote)}
                            className="px-2.5 py-1.5 rounded bg-[#FAF8F5] hover:bg-[#EAE4DB] text-[#1C1917] text-[11px] font-semibold border border-[#D5CCC0] transition"
                            aria-label={`Draft clarification message for ${vendor.name}`}
                          >
                            Draft Clarification
                          </button>

                          <button
                            onClick={() => selectQuote(quote.id)}
                            aria-label={isSelected ? `Proposal currently selected for ${vendor.name}` : `Select proposal from ${vendor.name}`}
                            className={`px-3 py-1.5 rounded text-[11px] font-semibold transition ${
                              isSelected
                                ? 'bg-[#047857] text-white'
                                : 'bg-[#1C1917] hover:bg-[#33302B] text-white shadow-xs'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : 'Select Proposal'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setQuoteVendorId(vendor.id);
                            setIsAddQuoteOpen(true);
                          }}
                          aria-label={`Submit quotation for ${vendor.name}`}
                          className="w-full py-1.5 rounded bg-[#FAF8F5] hover:bg-[#EAE4DB] text-[#1C1917] text-xs font-semibold border border-[#D5CCC0] transition"
                        >
                          + Submit Quotation
                        </button>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clarification Inquiry Modal */}
      <Modal
        isOpen={!!clarificationModal}
        onClose={() => setClarificationModal(null)}
        title={`Clarification Inquiry: ${clarificationModal?.vendor.name}`}
        description="Formatted message targeting missing contractual specifications."
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#5C554E]">
            Review the drafted inquiry below. You can copy it directly to your email client or messaging application.
          </p>

          <textarea
            rows={10}
            readOnly
            value={clarificationModal?.message || ''}
            className="w-full p-3 font-mono text-xs border border-[#D5CCC0] rounded-lg bg-[#FAF8F5] text-[#1C1917] focus:outline-hidden"
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[#78716C]">
              Includes quotes amount: {clarificationModal ? formatCurrency(clarificationModal.quote.quotedAmount, clarificationModal.quote.currency) : ''}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setClarificationModal(null)}
                className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
              >
                Close
              </button>
              <button
                onClick={handleCopyDraft}
                className="px-4 py-2 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md flex items-center gap-1.5 shadow-xs"
              >
                {hasCopiedDraft ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Inquiry Message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Vendor Modal */}
      <Modal
        isOpen={isAddVendorOpen}
        onClose={() => setIsAddVendorOpen(false)}
        title="Register New Supplier"
        description="Add a supplier record to track proposals and contact credentials."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">Company / Vendor Name *</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Royal Rajputana Sound & Lights"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">Contact Person</label>
              <input
                type="text"
                value={vendorContact}
                onChange={(e) => setVendorContact(e.target.value)}
                placeholder="e.g. Vikramaditya Rathore"
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">Phone Number</label>
              <input
                type="text"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="+91 98XXX XXXXX"
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">Email Address</label>
            <input
              type="email"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              placeholder="contact@supplier.example"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={vendorNotes}
              onChange={(e) => setVendorNotes(e.target.value)}
              placeholder="Referred by family, specializes in heritage acoustics..."
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsAddVendorOpen(false)}
              className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateVendor}
              className="px-4 py-2 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md shadow-xs"
            >
              Register Supplier
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Quotation Modal */}
      <Modal
        isOpen={isAddQuoteOpen}
        onClose={() => setIsAddQuoteOpen(false)}
        title="Log Vendor Quotation"
        description="Record itemized pricing, validity dates, and contractual scope."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">Select Supplier *</label>
            <select
              value={quoteVendorId}
              onChange={(e) => setQuoteVendorId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            >
              <option value="">Select a vendor...</option>
              {state.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({state.categories.find((c) => c.id === v.categoryId)?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Quoted Amount ({state.event.currency}) *
              </label>
              <input
                type="text"
                value={quoteAmountDisplay}
                onChange={(e) => setQuoteAmountDisplay(e.target.value)}
                placeholder="e.g. 350000"
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">Quote Validity Date</label>
              <input
                type="date"
                value={quoteValidity}
                onChange={(e) => setQuoteValidity(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">Quote Received Date</label>
            <input
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Included Services (One per line)
            </label>
            <textarea
              rows={3}
              value={quoteInclusions}
              onChange={(e) => setQuoteInclusions(e.target.value)}
              placeholder="Courtyard sound equipment&#10;Wireless microphones&#10;On-site technician"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Explicit Exclusions (One per line)
            </label>
            <textarea
              rows={2}
              value={quoteExclusions}
              onChange={(e) => setQuoteExclusions(e.target.value)}
              placeholder="Overtime beyond 10 PM&#10;Power generator fuel"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">Payment Terms</label>
            <input
              type="text"
              value={quotePaymentTerms}
              onChange={(e) => setQuotePaymentTerms(e.target.value)}
              placeholder="e.g. 50% advance on booking, 50% on event date"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsAddQuoteOpen(false)}
              className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateQuote}
              className="px-4 py-2 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md shadow-xs"
            >
              Record Proposal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
