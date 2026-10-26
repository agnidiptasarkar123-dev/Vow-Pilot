import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { GuestRecord } from '../../types';
import { Modal } from '../common/Modal';
import { Printer, QrCode } from 'lucide-react';

export interface BatchGuestQrModalProps {
  guests: GuestRecord[];
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BatchGuestQrModal: React.FC<BatchGuestQrModalProps> = ({
  guests,
  eventName,
  isOpen,
  onClose,
}) => {
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vowpilot.vercel.app';

  useEffect(() => {
    if (!isOpen || guests.length === 0) return;

    let isMounted = true;
    const generateAll = async () => {
      const nextMap = new Map<string, string>();
      for (const g of guests) {
        const url = `${origin}/?rsvpToken=${g.invitationToken}`;
        try {
          const options: QRCode.QRCodeToDataURLOptions = {
            width: 200,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#171517', light: '#FFFFFF' },
          };
          const dataUrl: string = await QRCode.toDataURL(url, options);
          nextMap.set(g.id, dataUrl);
        } catch (e: unknown) {
          console.error('Error generating QR for', g.name, e);
        }
      }
      if (isMounted) {
        setQrMap(nextMap);
      }
    };

    generateAll();
    return () => {
      isMounted = false;
    };
  }, [guests, origin, isOpen]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Printable Guest RSVP Cards (Batch Pass)"
      description={`Unique QR codes for all ${guests.length} invitation records`}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4 text-xs text-primary">
        <div className="flex items-center justify-between no-print pb-2 border-b border-subtle">
          <p className="text-secondary text-xs">
            Each card encodes that guest's private RSVP destination with zero shared tokens.
          </p>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print All Invitation Passes</span>
          </button>
        </div>

        {/* Printable Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[65vh] overflow-y-auto p-1">
          {guests.map((guest) => {
            const qrSrc = qrMap.get(guest.id);
            const rsvpUrl = `${origin}/?rsvpToken=${guest.invitationToken}`;

            return (
              <div
                key={guest.id}
                className="p-4 rounded-xl bg-white text-[#171517] border border-[#E6DFD5] shadow-xs flex flex-col items-center text-center space-y-2 page-break-inside-avoid"
              >
                <div className="w-full text-left border-b border-stone-100 pb-1.5 flex items-center justify-between">
                  <span className="font-serif-heading font-bold text-sm text-[#1C1917] truncate max-w-[140px]">
                    {guest.name}
                  </span>
                  <span className="text-[10px] font-semibold text-[#B85C3A] bg-[#FAF0EB] px-1.5 py-0.5 rounded">
                    Party of {guest.partySize}
                  </span>
                </div>

                <div className="p-2 bg-white rounded-lg border border-stone-200">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt={`RSVP QR for ${guest.name}`}
                      className="w-32 h-32 block mx-auto select-none"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center">
                      <QrCode className="w-6 h-6 animate-pulse text-stone-300" />
                    </div>
                  )}
                </div>

                <div className="w-full">
                  <span className="block text-[10px] text-stone-500 font-serif-heading">
                    {eventName}
                  </span>
                  <span className="block font-mono text-[8px] text-stone-400 truncate mt-0.5">
                    {rsvpUrl}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
