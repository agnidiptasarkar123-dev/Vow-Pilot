import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { formatCurrency } from '../../domain/currency';
import { Vendor, VendorQuote } from '../../types';
import {
  dispatchEmailViaServer,
  launchManualMailtoHandoff,
  type DispatchEmailResponse,
} from '../../services/emailClient';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from 'lucide-react';

export interface VendorClarificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  quote: VendorQuote | null;
  initialMessage: string;
  eventName: string;
  eventId: string;
  onRecordInquiry: (quoteId: string, vendorId: string, channel: 'email_client' | 'clipboard_handoff') => void;
}

export const VendorClarificationModal: React.FC<VendorClarificationModalProps> = ({
  isOpen,
  onClose,
  vendor,
  quote,
  initialMessage,
  eventName,
  eventId,
  onRecordInquiry,
}) => {
  const [message, setMessage] = useState(initialMessage);
  const [hasCopiedDraft, setHasCopiedDraft] = useState(false);
  const [hasDispatchedEmail, setHasDispatchedEmail] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [serverDeliveryResult, setServerDeliveryResult] = useState<DispatchEmailResponse | null>(null);
  const [serverDeliveryStatus, setServerDeliveryStatus] = useState<
    'idle' | 'accepted_by_provider' | 'delivered' | 'failed'
  >('idle');

  // Keep message updated if initialMessage changes
  React.useEffect(() => {
    setMessage(initialMessage);
    setHasCopiedDraft(false);
    setHasDispatchedEmail(false);
    setDispatchError(null);
    setServerDeliveryStatus('idle');
    setServerDeliveryResult(null);
    setIsDispatching(false);
  }, [initialMessage, isOpen]);

  if (!vendor || !quote) return null;

  const handleCopyDraft = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = message;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      onRecordInquiry(quote.id, vendor.id, 'clipboard_handoff');
      setHasCopiedDraft(true);
      setTimeout(() => setHasCopiedDraft(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  const handleSendServerEmail = async () => {
    const email = vendor.email;
    if (!email || !email.includes('@')) {
      setDispatchError('No valid email address configured for this supplier. Please update supplier details or use clipboard copy.');
      return;
    }
    setIsDispatching(true);
    setDispatchError(null);
    setServerDeliveryStatus('idle');

    const subject = `Clarification: Quotation for ${eventName}`;
    const result = await dispatchEmailViaServer({
      eventId: eventId || 'default_event',
      vendorId: vendor.id,
      recipientEmail: email,
      recipientName: vendor.name,
      subject,
      bodyText: message,
    });

    setIsDispatching(false);
    if (result.status === 'accepted_by_provider' || result.status === 'delivered') {
      setServerDeliveryStatus(result.status as 'accepted_by_provider' | 'delivered');
      setServerDeliveryResult(result);
      onRecordInquiry(quote.id, vendor.id, 'email_client');
    } else {
      setServerDeliveryStatus('failed');
      setDispatchError(result.error || 'Server email dispatch failed. Please check your credentials or network.');
    }
  };

  const handleSendEmail = () => {
    const email = vendor.email;
    if (!email || !email.includes('@')) {
      setDispatchError('No valid email address configured for this supplier. Please update supplier details or use clipboard copy.');
      return;
    }
    setDispatchError(null);
    const subject = `Clarification: Quotation for ${eventName}`;
    const res = launchManualMailtoHandoff({
      recipientEmail: email,
      subject,
      bodyText: message,
    });

    if (res.status === 'opened_in_client') {
      onRecordInquiry(quote.id, vendor.id, 'email_client');
      setHasDispatchedEmail(true);
      setTimeout(() => setHasDispatchedEmail(false), 5000);
    } else {
      setDispatchError(res.error || 'Unable to launch email client automatically. Please use the Copy Inquiry Message button.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Clarification Inquiry: ${vendor.name}`}
      description="Formatted message targeting missing contractual specifications."
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between bg-[#F5F2EB] p-2.5 rounded-md border border-[#EAE4DB]">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#B85C3A]" />
            <span className="text-[#26221F] font-medium">
              Supplier Email:{' '}
              {vendor.email ? (
                <span className="font-mono text-[#B85C3A]">{vendor.email}</span>
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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Clarification inquiry message draft"
          className="w-full p-3 font-mono text-xs border border-[#D5CCC0] rounded-lg bg-[#FAF8F5] text-[#26221F] focus:outline-hidden focus:border-[#B85C3A]"
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <span className="text-[11px] text-[#78716C]">
            Includes quoted amount: {formatCurrency(quote.quotedAmount, quote.currency)}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onClose}
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
              disabled={!vendor.email}
              className={`px-3 py-2 border border-[#78716C] text-[#44403C] hover:bg-neutral-50 font-semibold rounded-md flex items-center gap-1.5 text-xs transition ${
                vendor.email
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
              disabled={!vendor.email || isDispatching}
              className={`px-3 py-2 text-white font-semibold rounded-md flex items-center gap-1.5 shadow-xs transition text-xs ${
                vendor.email && !isDispatching
                  ? 'bg-[#B85C3A] hover:bg-[#9E4B2D]'
                  : 'bg-neutral-400 cursor-not-allowed opacity-60'
              }`}
              title={
                vendor.email
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
  );
};
