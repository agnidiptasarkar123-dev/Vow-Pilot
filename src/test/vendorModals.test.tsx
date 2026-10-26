import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddVendorModal } from '../components/vendors/AddVendorModal';
import { AddQuoteModal } from '../components/vendors/AddQuoteModal';
import { VendorClarificationModal } from '../components/vendors/VendorClarificationModal';
import { Vendor, VendorQuote, BudgetCategory } from '../types';

describe('Vendor Modals Component Suite', () => {
  const mockVendor: Vendor = {
    id: 'v-test-1',
    categoryId: 'venue',
    name: 'Heritage Palace',
    contactName: 'Rathore',
    email: 'rathore@palace.example',
    phone: '+91 98765 43210',
    website: 'https://palace.example',
    isSample: false,
    createdAt: '2026-10-25',
  };

  const mockQuote: VendorQuote = {
    id: 'q-test-1',
    vendorId: 'v-test-1',
    quoteDate: '2026-10-25',
    quotedAmount: 50000000,
    currency: 'INR',
    status: 'under_review',
    includedServices: ['Royal Courtyard', 'Heritage Lighting'],
    exclusions: ['Generator Fuel'],
    paymentTerms: '50% Advance',
    isSample: false,
  };

  const mockCategories: BudgetCategory[] = [
    { id: 'venue', name: 'Venue & Staging', allocatedAmount: 100000000, userDefined: false, priorityRank: 1 },
    { id: 'catering', name: 'Catering & Beverages', allocatedAmount: 80000000, userDefined: false, priorityRank: 2 },
  ];

  describe('AddVendorModal', () => {
    it('renders fields and dispatches onAddVendor with trimmed values', () => {
      const handleAddVendor = vi.fn();
      const handleClose = vi.fn();

      render(
        <AddVendorModal
          isOpen={true}
          onClose={handleClose}
          selectedCategoryTab="venue"
          onAddVendor={handleAddVendor}
        />
      );

      expect(screen.getByText('Register New Supplier')).toBeInTheDocument();
      const nameInput = screen.getByPlaceholderText(/Royal Rajputana Sound & Lights/i);
      fireEvent.change(nameInput, { target: { value: '  Jaipur Royal Band  ' } });

      const contactInput = screen.getByPlaceholderText(/Vikramaditya Rathore/i);
      fireEvent.change(contactInput, { target: { value: ' Vikram ' } });

      const submitBtn = screen.getByRole('button', { name: /Register Supplier/i });
      fireEvent.click(submitBtn);

      expect(handleAddVendor).toHaveBeenCalledTimes(1);
      expect(handleAddVendor).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jaipur Royal Band',
          categoryId: 'venue',
          contactName: 'Vikram',
          isSample: false,
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });

    it('cancels modal when Cancel button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <AddVendorModal
          isOpen={true}
          onClose={handleClose}
          selectedCategoryTab="venue"
          onAddVendor={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('AddQuoteModal', () => {
    it('handles quotation recording and parses inclusions/exclusions', () => {
      const handleAddQuote = vi.fn();
      const handleClose = vi.fn();

      render(
        <AddQuoteModal
          isOpen={true}
          onClose={handleClose}
          vendors={[mockVendor]}
          categories={mockCategories}
          currency="INR"
          defaultVendorId={mockVendor.id}
          onAddQuote={handleAddQuote}
        />
      );

      expect(screen.getByText('Log Vendor Quotation')).toBeInTheDocument();

      const amountInput = screen.getByPlaceholderText(/350000/i);
      fireEvent.change(amountInput, { target: { value: '750000' } });

      const inclusionsInput = screen.getByPlaceholderText(/Courtyard sound equipment/i);
      fireEvent.change(inclusionsInput, { target: { value: 'Stage Setup\nSound System' } });

      const exclusionsInput = screen.getByPlaceholderText(/Overtime beyond 10 PM/i);
      fireEvent.change(exclusionsInput, { target: { value: 'DJ Console\nAlcohol License' } });

      const submitBtn = screen.getByRole('button', { name: /Record Proposal/i });
      fireEvent.click(submitBtn);

      expect(handleAddQuote).toHaveBeenCalledTimes(1);
      expect(handleAddQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: 'v-test-1',
          quotedAmount: 75000000, // 750,000 * 100 minor units
          currency: 'INR',
          status: 'under_review',
          includedServices: ['Stage Setup', 'Sound System'],
          exclusions: ['DJ Console', 'Alcohol License'],
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('VendorClarificationModal', () => {
    it('renders supplier details, allows editing message and copies to clipboard', async () => {
      const handleRecordInquiry = vi.fn();
      const handleClose = vi.fn();

      // Mock navigator.clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <VendorClarificationModal
          isOpen={true}
          onClose={handleClose}
          vendor={mockVendor}
          quote={mockQuote}
          initialMessage="Draft clarification query..."
          eventName="Royal Wedding"
          eventId="rw-101"
          onRecordInquiry={handleRecordInquiry}
        />
      );

      expect(screen.getByText(/Clarification Inquiry: Heritage Palace/i)).toBeInTheDocument();
      expect(screen.getByText(/rathore@palace.example/i)).toBeInTheDocument();

      const textarea = screen.getByRole('textbox', { name: /Clarification inquiry message draft/i });
      expect(textarea).toHaveValue('Draft clarification query...');
      fireEvent.change(textarea, { target: { value: 'Updated inquiry terms...' } });
      expect(textarea).toHaveValue('Updated inquiry terms...');

      const copyBtn = screen.getByTestId('copy-draft-btn');
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith('Updated inquiry terms...');
        expect(handleRecordInquiry).toHaveBeenCalledWith('q-test-1', 'v-test-1', 'clipboard_handoff');
      });
    });
  });
});
