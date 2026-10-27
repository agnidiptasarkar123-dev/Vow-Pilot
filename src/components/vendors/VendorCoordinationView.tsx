import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { compareCategoryVendors, draftClarificationMessage } from '../../domain/vendorEngine';
import { formatCurrency } from '../../domain/currency';
import { Vendor, VendorQuote } from '../../types';
import { getCategoryStarter } from './vendorCategoryStarters';
import { CategoryStarterWorkflow } from './CategoryStarterWorkflow';
import { AddVendorModal } from './AddVendorModal';
import { AddQuoteModal } from './AddQuoteModal';
import { VendorClarificationModal } from './VendorClarificationModal';
import {
  AlertCircle,
  AlertTriangle,
  FileText,
  Lock,
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
    recordVendorInquiry,
    isReadOnly,
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

  // Add Vendor Modal
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);

  // Add Quote Modal
  const [isAddQuoteOpen, setIsAddQuoteOpen] = useState(false);
  const [quoteVendorId, setQuoteVendorId] = useState('');

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
  };

  const handleDeleteVendorWithConfirm = (vendorId: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove vendor "${name}" and all associated quotations?`)) {
      deleteVendor(vendorId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Read-Only Viewer Alert Banner */}
      {isReadOnly && (
        <div
          data-testid="viewer-readonly-banner"
          className="p-3.5 rounded-lg bg-stone-100 border border-stone-300 flex items-center justify-between text-xs text-stone-700 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-stone-500 shrink-0" />
            <span>
              <strong>Viewer Permissions (Read-Only):</strong> You can review vendor directories, quotations, and compare contract terms. Adding vendors, logging quotes, selecting proposals, and sending communications requires Editor or Owner permissions.
            </span>
          </div>
        </div>
      )}

      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary font-serif-heading">
            Vendor Directory & Quotation Matrix
          </h1>
          <p className="text-xs text-secondary mt-1">
            Compare service inclusions side-by-side, detect missing contract terms, and draft clarification requests.
          </p>
        </div>

        {!isReadOnly ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setQuoteVendorId(comparison.rows[0]?.vendor.id || state.vendors[0]?.id || '');
                setIsAddQuoteOpen(true);
              }}
              className="px-3.5 py-2 rounded-md bg-surface border border-subtle text-primary hover:bg-subtle text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668]" />
              Log Quotation
            </button>
            <button
              onClick={() => setIsAddVendorOpen(true)}
              className="px-4 py-2 rounded-md bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-subtle text-secondary text-xs font-medium border border-subtle">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only Mode</span>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 border-b border-subtle pb-2">
        {state.categories.map((cat) => {
          const catVendorCount = state.vendors.filter((v) => v.categoryId === cat.id).length;
          const isSelected = selectedCategoryTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryTab(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-[#B85C3A] text-white font-bold shadow-xs'
                  : 'bg-surface text-secondary hover:text-primary border border-subtle'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-subtle text-secondary'
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
        <div className="flex items-center justify-between text-xs text-secondary">
          <span>
            Showing quotations for <strong>{activeCategory.name}</strong> • Category Average:{' '}
            <span className="font-mono font-semibold text-primary">
              {formatCurrency(comparison.averageQuotedPrice, state.event.currency)}
            </span>
          </span>
          <span>Lowest quote is not automatically recommended</span>
        </div>

        {comparison.rows.length === 0 ? (
          <CategoryStarterWorkflow
            categoryName={activeCategory.name}
            starterInfo={getCategoryStarter(activeCategory.id, activeCategory.name)}
            isReadOnly={isReadOnly}
            onAddSupplier={() => setIsAddVendorOpen(true)}
            onLogQuote={() => {
              const vendorInThisCategory = state.vendors.find((v) => v.categoryId === activeCategory.id);
              setQuoteVendorId(vendorInThisCategory?.id || state.vendors[0]?.id || '');
              setIsAddQuoteOpen(true);
            }}
            hasVendorsInAnyCategory={state.vendors.length > 0}
          />
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
                  className={`bg-surface rounded-xl border p-5 flex flex-col justify-between transition shadow-xs relative ${
                    isSelected
                      ? 'border-[#047857] ring-1 ring-[#047857]'
                      : isExpired
                      ? 'border-amber-400 dark:border-amber-600'
                      : 'border-subtle'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Name and Sample Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-primary font-serif-heading">
                            {vendor.name}
                          </h3>
                        </div>
                        {vendor.isSample && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Fictional Demonstration Record
                          </span>
                        )}
                      </div>

                      {!isReadOnly && (
                        <button
                          onClick={() => handleDeleteVendorWithConfirm(vendor.id, vendor.name)}
                          className="p-1 rounded text-secondary hover:text-red-500 transition cursor-pointer"
                          title="Delete Vendor"
                          aria-label={`Delete vendor: ${vendor.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Contact & Rating info */}
                    <div className="text-xs text-secondary space-y-1">
                      {vendor.contactName && (
                        <p className="flex items-center gap-1.5">
                          <span className="font-semibold text-primary">Contact:</span> {vendor.contactName}
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
                        <p className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span className="font-bold">{vendor.rating}</span>
                          <span className="text-[10px] text-secondary">({vendor.ratingSource})</span>
                        </p>
                      )}
                    </div>

                    {/* Quotation Pricing Strip */}
                    <div className="p-3 bg-subtle rounded-lg border border-subtle space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-secondary font-semibold">
                          Quoted Price
                        </span>
                        {quote && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isSelected
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-[#047857] dark:text-emerald-400'
                                : quote.status === 'expired'
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                : 'bg-subtle text-secondary'
                            }`}
                          >
                            {quote.status.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="text-xl font-bold font-mono text-primary">
                        {quote ? formatCurrency(quote.quotedAmount, quote.currency) : 'No formal quote'}
                      </div>

                      {quote && comparison.averageQuotedPrice > 0 && (
                        <span
                          className={`text-[11px] font-mono block ${
                            row.priceDeltaFromAverage > 0 ? 'text-[#BE123C] dark:text-rose-400' : 'text-[#047857] dark:text-emerald-400'
                          }`}
                        >
                          {row.priceDeltaFromAverage >= 0 ? '+' : ''}
                          {formatCurrency(row.priceDeltaFromAverage, quote.currency)} vs avg
                        </span>
                      )}
                    </div>

                    {/* Expiration or Missing Details Alert */}
                    {quote && isExpired && (
                      <div className="p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-900 dark:text-red-200 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-[#BE123C] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Quotation Expired:</span> Validity expired on {quote.validityDate}. Rate must be re-confirmed with supplier.
                        </div>
                      </div>
                    )}

                    {quote && hasMissingDetails && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        <div className="flex items-center gap-1 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] dark:text-amber-400" />
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
                          <span className="font-semibold text-primary block mb-1">
                            Included Services ({quote.includedServices.length}):
                          </span>
                          <ul className="space-y-0.5 text-[11px] text-secondary">
                            {quote.includedServices.slice(0, 3).map((inc, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-[#047857] dark:text-emerald-400 font-bold">✓</span> {inc}
                              </li>
                            ))}
                            {quote.includedServices.length > 3 && (
                              <li className="text-[10px] text-muted pl-3">
                                +{quote.includedServices.length - 3} more itemized items
                              </li>
                            )}
                          </ul>
                        </div>

                        {quote.exclusions.length > 0 && (
                          <div>
                            <span className="font-semibold text-[#BE123C] dark:text-rose-400 block mb-1">
                              Explicit Exclusions ({quote.exclusions.length}):
                            </span>
                            <ul className="space-y-0.5 text-[11px] text-muted">
                              {quote.exclusions.map((exc, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-[#BE123C] dark:text-rose-400">✕</span> {exc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Strip */}
                    <div className="pt-4 border-t border-subtle flex items-center justify-between gap-2 mt-4">
                      {quote ? (
                        <>
                          <button
                            data-testid="draft-clarification-btn"
                            onClick={() => handleOpenClarification(vendor, quote)}
                            className="px-2.5 py-1.5 rounded bg-subtle hover:bg-surface text-primary text-[11px] font-semibold border border-subtle transition cursor-pointer"
                            aria-label={`Draft clarification message for ${vendor.name}`}
                          >
                            Draft Clarification
                          </button>

                          {!isReadOnly ? (
                            <button
                              onClick={() => selectQuote(quote.id)}
                              aria-label={isSelected ? `Proposal currently selected for ${vendor.name}` : `Select proposal from ${vendor.name}`}
                              className={`px-3 py-1.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[#047857] text-white'
                                  : 'bg-[#B85C3A] hover:bg-[#9E4B2D] text-white shadow-xs'
                              }`}
                            >
                              {isSelected ? '✓ Selected' : 'Select Proposal'}
                            </button>
                          ) : (
                            <span className={`px-2.5 py-1 rounded text-[11px] font-semibold ${isSelected ? 'text-[#047857] font-bold' : 'text-secondary'}`}>
                              {isSelected ? '✓ Selected' : 'Proposal Logged'}
                            </span>
                          )}
                        </>
                      ) : !isReadOnly ? (
                        <button
                          onClick={() => {
                            setQuoteVendorId(vendor.id);
                            setIsAddQuoteOpen(true);
                          }}
                          aria-label={`Submit quotation for ${vendor.name}`}
                          className="w-full py-1.5 rounded bg-subtle hover:bg-surface text-primary text-xs font-semibold border border-subtle transition cursor-pointer"
                        >
                          + Submit Quotation
                        </button>
                      ) : (
                        <span className="w-full text-center py-1 text-xs text-muted italic">
                          No quotation submitted
                        </span>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clarification Inquiry Modal */}
      <VendorClarificationModal
        isOpen={!!clarificationModal}
        onClose={() => setClarificationModal(null)}
        vendor={clarificationModal?.vendor || null}
        quote={clarificationModal?.quote || null}
        initialMessage={clarificationModal?.message || ''}
        eventName={state.event.name}
        eventId={state.event.id || 'default_event'}
        onRecordInquiry={recordVendorInquiry}
      />

      {/* Add Vendor Modal */}
      <AddVendorModal
        isOpen={isAddVendorOpen}
        onClose={() => setIsAddVendorOpen(false)}
        selectedCategoryTab={selectedCategoryTab}
        onAddVendor={addVendor}
      />

      {/* Add Quotation Modal */}
      <AddQuoteModal
        isOpen={isAddQuoteOpen}
        onClose={() => setIsAddQuoteOpen(false)}
        vendors={state.vendors}
        categories={state.categories}
        currency={state.event.currency}
        defaultVendorId={quoteVendorId}
        onAddQuote={addQuote}
      />
    </div>
  );
};
