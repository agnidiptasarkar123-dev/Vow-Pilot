import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  maxWidthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  id,
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
  maxWidthClass,
}) => {
  const instanceId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const titleId = id ? `modal-title-${id}` : 'modal-title';
  const descriptionId = description ? `modal-desc-${id || instanceId}` : undefined;

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus on close
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Trap Tab key within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Auto-focus first focusable element or close button
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedMaxWidthClass =
    maxWidthClass ||
    {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl',
      '4xl': 'max-w-4xl',
    }[maxWidth] ||
    'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {/* Backdrop click dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        className={`relative w-full ${resolvedMaxWidthClass} bg-surface rounded-xl shadow-xl border border-subtle overflow-hidden z-10 text-primary`}
      >
        <div className="flex items-start justify-between p-5 border-b border-subtle bg-subtle">
          <div>
            <h3 id={titleId} className="text-lg font-bold text-primary font-serif-heading">
              {title}
            </h3>
            {description && (
              <p id={descriptionId} className="text-xs text-secondary mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-muted transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-label={`${title} content`}
          className="p-6 max-h-[80vh] overflow-y-auto focus:outline-hidden"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
