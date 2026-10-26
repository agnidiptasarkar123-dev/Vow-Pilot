import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { compareCategoryVendors, draftClarificationMessage } from '../../domain/vendorEngine';
import { formatCurrency, parseDisplayToMinor } from '../../domain/currency';
import { Vendor, VendorQuote } from '../../types';
import { Modal } from '../common/Modal';
import { getCategoryStarter } from './vendorCategoryStarters';
import { CategoryStarterWorkflow } from './CategoryStarterWorkflow';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import {
  dispatchEmailViaServer,
  launchManualMailtoHandoff,
  type DispatchEmailResponse,
} from '../../services/emailClient';

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
  const [hasCopiedDraft, setHasCopiedDraft] = useState(false);
  const [hasDispatchedEmail, setHasDispatchedEmail] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [serverDeliveryResult, setServerDeliveryResult] = useState<DispatchEmailResponse | null>(null);
  const [serverDeliveryStatus, setServerDeliveryStatus] = useState<
    'idle' | 'accepted_by_provider' | 'delivered' | 'failed'
  >('idle');

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
    setHasDispatchedEmail(false);
    setDispatchError(null);
    setServerDeliveryStatus('idle');
    setServerDeliveryResult(null);
    setIsDispatching(false);
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
        recordVendorInquiry(clarificationModal.quote.id, clarificationModal.vendor.id, 'clipboard_handoff');
        setHasCopiedDraft(true);
        setTimeout(() => setHasCopiedDraft(false), 2500);
      } catch (err) {
        console.warn('Clipboard copy error:', err);
      }
    }
  };

  const handleSendServerEmail = async () => {
    if (!clarificationModal) return;
    const email = clarificationModal.vendor.email;
    if (!email || !email.includes('@')) {
      setDispatchError('No valid email address configured for this supplier. Please update supplier details or use clipboard copy.');
      return;
    }
    setIsDispatching(true);
    setDispatchError(null);
    setServerDeliveryStatus('idle');

    const subject = `Clarification: Quotation for ${state.event.name}`;
    const result = await dispatchEmailViaServer({
      eventId: state.event.id || 'default_event',
      vendorId: clarificationModal.vendor.id,
      recipientEmail: email,
      recipientName: clarificationModal.vendor.name,
      subject,
      bodyText: clarificationModal.message,
    });

    setIsDispatching(false);
    if (result.status === 'accepted_by_provider' || result.status === 'delivered') {
      setServerDeliveryStatus(result.status as 'accepted_by_provider' | 'delivered');
      setServerDeliveryResult(result);
      recordVendorInquiry(clarificationModal.quote.id, clarificationModal.vendor.id, 'email_client');
    } else {
      setServerDeliveryStatus('failed');
      setDispatchError(result.error || 'Server email dispatch failed. Please check your credentials or network.');
      // The draft in clarificationModal.message is preserved so user doesn't lose it!
    }
  };

  const handleSendEmail = () => {
    if (!clarificationModal) return;
    const email = clarificationModal.vendor.email;
    if (!email || !email.includes('@')) {
      setDispatchError('No valid email address configured for this supplier. Please update supplier details or use clipboard copy.');
      return;
    }
    setDispatchError(null);
    const subject = `Clarification: Quotation for ${state.event.name}`;
    const res = launchManualMailtoHandoff({
      recipientEmail: email,
      subject,
      bodyText: clarificationModal.message,
    });

    if (res.status === 'opened_in_client') {
      recordVendorInquiry(clarificationModal.quote.id, clarificationModal.vendor.id, 'email_client');
      setHasDispatchedEmail(true);
      setTimeout(() => setHasDispatchedEmail(false), 5000);
    } else {
      setDispatchError(res.error || 'Unable to launch email client automatically. Please use the Copy Inquiry Message button.');
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
                        <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span className="font-bold">{vendor.rating}</span>
                          <span className="text-[10px] text-muted">({vendor.ratingSource})</span>
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
      <Modal
        isOpen={!!clarificationModal}
        onClose={() => setClarificationModal(null)}
        title={`Clarification Inquiry: ${clarificationModal?.vendor.name}`}
        description="Formatted message targeting missing contractual specifications."
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between bg-[#F5F2EB] p-2.5 rounded-md border border-[#EAE4DB]">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#B85C3A]" />
              <span className="text-[#26221F] font-medium">
                Supplier Email:{' '}
                {clarificationModal?.vendor.email ? (
                  <span className="font-mono text-[#B85C3A]">{clarificationModal.vendor.email}</span>
                ) : (
                  <span className="text-[#8C827A] italic">None registered (clipboard handoff recommended)</span>
                )}
              </span>
            </div>
          </div>

          {/* Delivery In-Flight Spinner */}
          {isDispatching && (
            <div role="status" aria-live="polite" className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-md flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
              <span>Connecting to email provider and dispatching message...</span>
            </div>
          )}

          {/* Accepted by Provider Banner */}
          {serverDeliveryStatus === 'accepted_by_provider' && (
            <div role="status" aria-live="polite" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Accepted by Email Provider</span>
              </div>
              <div className="text-[11px] text-emerald-700">
                Handoff confirmed. Provider Message ID:{' '}
                <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">
                  {serverDeliveryResult?.providerMessageId}
                </code>
              </div>
              <div className="text-[10px] text-emerald-600">
                Queued for SMTP relay transmission (attempts: {serverDeliveryResult?.attempts || 1}).
              </div>
            </div>
          )}

          {/* Delivered to Test Mailbox Banner */}
          {serverDeliveryStatus === 'delivered' && (
            <div role="status" aria-live="polite" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Delivered to Test Mailbox</span>
              </div>
              <div className="text-[11px] text-emerald-700">
                Provider Message ID:{' '}
                <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">
                  {serverDeliveryResult?.providerMessageId}
                </code>
              </div>
              {serverDeliveryResult?.previewUrl && (
                <div>
                  <a
                    href={serverDeliveryResult.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#B85C3A] underline font-medium text-xs hover:text-[#9E4B2D]"
                  >
                    <span>View Delivered Message in Test Inbox</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Manual Mailto Client Handoff Banner */}
          {hasDispatchedEmail && (
            <div role="status" aria-live="polite" className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-md space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                <Check className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Client Launched & Logged</span>
              </div>
              <div className="text-[11px] text-blue-700">
                Inquiry transferred to your local mail client (RFC-6068). Check your mail client outbox to confirm sending.
              </div>
            </div>
          )}

          {/* Dispatch Error Banner with Safe Retry */}
          {dispatchError && (
            <div role="alert" aria-live="assertive" className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-md flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-800">Dispatch Failed</div>
                  <div>{dispatchError}</div>
                  <div className="text-[11px] text-rose-700 mt-0.5">
                    Your draft has been preserved below. You can edit the text or retry.
                  </div>
                </div>
              </div>
              <button
                onClick={handleSendServerEmail}
                disabled={isDispatching}
                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold text-[11px] shrink-0 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          <p className="text-[#5C554E]">
            Review or customize the drafted inquiry below. You can send it directly through VowPilot&apos;s server email service, launch your system mail client (RFC-6068), or copy the text.
          </p>

          <label htmlFor="vendor-clarification-textarea" className="sr-only">
            Clarification inquiry message draft
          </label>
          <textarea
            id="vendor-clarification-textarea"
            rows={8}
            value={clarificationModal?.message || ''}
            onChange={(e) =>
              setClarificationModal((prev) => (prev ? { ...prev, message: e.target.value } : null))
            }
            aria-label="Clarification inquiry message draft"
            className="w-full p-3 font-mono text-xs border border-[#D5CCC0] rounded-lg bg-[#FAF8F5] text-[#26221F] focus:outline-hidden focus:border-[#B85C3A]"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-[#78716C]">
              Includes quoted amount: {clarificationModal ? formatCurrency(clarificationModal.quote.quotedAmount, clarificationModal.quote.currency) : ''}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setClarificationModal(null)}
                className="px-3 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50 text-xs"
              >
                Close
              </button>
              <button
                data-testid="copy-draft-btn"
                onClick={handleCopyDraft}
                className="px-3 py-2 border border-[#B85C3A] text-[#B85C3A] hover:bg-[#FBF6F0] font-semibold rounded-md flex items-center gap-1.5 shadow-xs text-xs"
              >
                {hasCopiedDraft ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Inquiry Message
                  </>
                )}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!clarificationModal?.vendor.email}
                className={`px-3 py-2 border border-[#78716C] text-[#44403C] hover:bg-neutral-50 font-semibold rounded-md flex items-center gap-1.5 text-xs transition ${
                  clarificationModal?.vendor.email
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed opacity-60'
                }`}
                title="Launch native email client via RFC 6068 mailto URI"
              >
                <Mail className="w-3.5 h-3.5 text-[#78716C]" />
                <span>Launch Email Client</span>
              </button>
              <button
                data-testid="send-server-email-btn"
                onClick={handleSendServerEmail}
                disabled={!clarificationModal?.vendor.email || isDispatching}
                className={`px-3 py-2 text-white font-semibold rounded-md flex items-center gap-1.5 shadow-xs transition text-xs ${
                  clarificationModal?.vendor.email && !isDispatching
                    ? 'bg-[#B85C3A] hover:bg-[#9E4B2D]'
                    : 'bg-neutral-400 cursor-not-allowed opacity-60'
                }`}
                title={
                  clarificationModal?.vendor.email
                    ? 'Dispatch directly via VowPilot transactional email service'
                    : 'Supplier has no registered email'
                }
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via Server</span>
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
            <label className="block font-semibold text-primary mb-1">Company / Vendor Name *</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Royal Rajputana Sound & Lights"
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-primary mb-1">Contact Person</label>
              <input
                type="text"
                value={vendorContact}
                onChange={(e) => setVendorContact(e.target.value)}
                placeholder="e.g. Vikramaditya Rathore"
                className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
              />
            </div>
            <div>
              <label className="block font-semibold text-primary mb-1">Phone Number</label>
              <input
                type="text"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="+91 98XXX XXXXX"
                className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-primary mb-1">Email Address</label>
            <input
              type="email"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              placeholder="contact@supplier.example"
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div>
            <label className="block font-semibold text-primary mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={vendorNotes}
              onChange={(e) => setVendorNotes(e.target.value)}
              placeholder="Referred by family, specializes in heritage acoustics..."
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsAddVendorOpen(false)}
              className="px-4 py-2 border border-subtle rounded-md text-secondary hover:bg-subtle cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateVendor}
              className="px-4 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold rounded-md shadow-xs cursor-pointer"
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
            <label className="block font-semibold text-primary mb-1">Select Supplier *</label>
            <select
              value={quoteVendorId}
              onChange={(e) => setQuoteVendorId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-subtle bg-surface text-primary rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
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
              <label className="block font-semibold text-primary mb-1">
                Quoted Amount ({state.event.currency}) *
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
              onClick={() => setIsAddQuoteOpen(false)}
              className="px-4 py-2 border border-subtle rounded-md text-secondary hover:bg-subtle cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateQuote}
              className="px-4 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold rounded-md shadow-xs cursor-pointer"
            >
              Record Proposal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
