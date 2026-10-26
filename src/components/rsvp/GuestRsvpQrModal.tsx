import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { GuestRecord } from '../../types';
import { generateSecureRsvpToken } from '../../utils/security';
import { Modal } from '../common/Modal';
import {
  QrCode,
  Copy,
  Check,
  Download,
  Printer,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export interface GuestRsvpQrModalProps {
  guest: GuestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateGuest?: (updatedGuest: GuestRecord) => void;
  onPreviewPublicRsvp?: (token: string) => void;
}

export const GuestRsvpQrModal: React.FC<GuestRsvpQrModalProps> = ({
  guest,
  isOpen,
  onClose,
  onUpdateGuest,
  onPreviewPublicRsvp,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const printableCardRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vowpilot.vercel.app';
  const rsvpUrl = guest ? `${origin}/?rsvpToken=${guest.invitationToken}` : '';

  useEffect(() => {
    if (!guest || !isOpen) {
      setQrDataUrl('');
      setQrSvgString('');
      return;
    }

    let isMounted = true;

    // Generate high-contrast PNG Data URL with 2-module quiet zone (scannable on all cameras)
    QRCode.toDataURL(rsvpUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#171517',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        if (isMounted) setGenerationError('Failed to generate PNG QR code.');
        console.error(err);
      });

    // Generate crisp SVG string for vector exports
    QRCode.toString(rsvpUrl, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#171517',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        if (isMounted) setQrSvgString(svg);
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      isMounted = false;
    };
  }, [guest?.invitationToken, rsvpUrl, isOpen]);

  if (!guest) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(rsvpUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `VowPilot_RSVP_QR_${guest.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSvg = () => {
    if (!qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VowPilot_RSVP_QR_${guest.name.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintCard = () => {
    window.print();
  };

  const handleRegenerateToken = () => {
    if (!onUpdateGuest) return;
    const confirmed = window.confirm(
      `Regenerate RSVP token for "${guest.name}"?\n\nThis will invalidate any previously printed or distributed QR codes for this guest.`
    );
    if (!confirmed) return;

    setIsRegenerating(true);
    try {
      const newToken = generateSecureRsvpToken();
      const updated: GuestRecord = {
        ...guest,
        invitationToken: newToken,
        updatedAt: new Date().toISOString(),
      };
      onUpdateGuest(updated);
    } catch (e) {
      console.error(e);
      alert('Could not regenerate token.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Individual Guest RSVP QR Code"
      description={`Unique, scannable invitation pass for ${guest.name}`}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-5 text-xs text-primary">
        {generationError && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200">
            {generationError}
          </div>
        )}

        {/* Guest Metadata Card */}
        <div className="p-3.5 rounded-lg bg-subtle border border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">{guest.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF0EB] dark:bg-[#2E2222] text-[#B85C3A] dark:text-[#E8D7C4] border border-[#E8C8BD] dark:border-[#5C3830]">
                Party of {guest.partySize}
              </span>
              {guest.householdGroup && (
                <span className="text-secondary text-[11px]">
                  ({guest.householdGroup})
                </span>
              )}
            </div>
            <div className="text-secondary text-[11px] mt-0.5 flex flex-wrap items-center gap-2">
              <span>Status: <strong className="capitalize">{guest.rsvpStatus}</strong></span>
              {guest.email && <span>• {guest.email}</span>}
              {guest.phone && <span>• {guest.phone}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-[#91B8A0] font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              128-bit Secure Token
            </span>
          </div>
        </div>

        {/* Printable Physical Card Layout Preview */}
        <div
          ref={printableCardRef}
          className="p-5 rounded-2xl bg-white text-[#171517] border border-[#E6DFD5] shadow-md flex flex-col items-center text-center space-y-4"
        >
          <div className="space-y-1">
            <span className="text-[10px] tracking-widest uppercase font-semibold text-[#8C7A70]">
              Official Celebration Pass
            </span>
            <h4 className="font-serif-heading text-lg font-bold text-[#1C1917]">
              {guest.name}
            </h4>
            <p className="text-xs text-[#5C554E]">
              Scan to confirm attendance, meal selections & details
            </p>
          </div>

          {/* QR Code Container with High-Contrast Quiet Zone */}
          <div
            className="p-3 bg-white rounded-xl border border-stone-200 shadow-inner flex items-center justify-center min-w-[220px] min-h-[220px]"
            data-testid="guest-qr-image-container"
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`RSVP QR code for ${guest.name}`}
                className="w-48 h-48 block mx-auto select-none"
                data-testid="guest-rsvp-qr-image"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-stone-400 text-xs">
                <QrCode className="w-8 h-8 animate-pulse text-stone-300" />
              </div>
            )}
          </div>

          <div className="w-full max-w-sm space-y-1 text-center">
            <div className="font-mono text-[10px] text-stone-500 break-all px-2 py-1 bg-stone-50 rounded border border-stone-200">
              {rsvpUrl}
            </div>
            <p className="text-[10px] text-stone-400">
              Scan with any mobile camera. Works offline & online.
            </p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-2 rounded-lg bg-subtle hover:bg-muted text-primary border border-subtle font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!qrDataUrl}
            className="px-3 py-2 rounded-lg bg-subtle hover:bg-muted text-primary border border-subtle font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save PNG</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={!qrSvgString}
            className="px-3 py-2 rounded-lg bg-subtle hover:bg-muted text-primary border border-subtle font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save SVG</span>
          </button>

          <button
            type="button"
            onClick={handlePrintCard}
            className="px-3 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Pass</span>
          </button>
        </div>

        {/* Security & Token Management Footer */}
        <div className="pt-3 border-t border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-secondary text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-tertiary">
              Token: {guest.invitationToken.slice(0, 16)}...
            </span>
            {onPreviewPublicRsvp && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPreviewPublicRsvp(guest.invitationToken);
                }}
                className="text-[#B85C3A] dark:text-[#D48668] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>Preview Public Form</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {onUpdateGuest && (
            <button
              type="button"
              onClick={handleRegenerateToken}
              disabled={isRegenerating}
              title="Generate a new secure token and revoke the previous token"
              className="text-tertiary hover:text-rose-600 dark:hover:text-[#E58C91] flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate & Invalidate Prior QR</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
