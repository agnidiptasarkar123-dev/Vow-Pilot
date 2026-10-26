import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Vendor } from '../../types';

export interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategoryTab: string;
  onAddVendor: (vendor: Omit<Vendor, 'id' | 'createdAt'>) => void;
}

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  isOpen,
  onClose,
  selectedCategoryTab,
  onAddVendor,
}) => {
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorWebsite, setVendorWebsite] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');

  const handleSubmit = () => {
    if (!vendorName.trim()) return;
    onAddVendor({
      name: vendorName.trim(),
      categoryId: selectedCategoryTab,
      contactName: vendorContact.trim(),
      email: vendorEmail.trim(),
      phone: vendorPhone.trim(),
      website: vendorWebsite.trim() || undefined,
      notes: vendorNotes.trim() || undefined,
      isSample: false,
    });
    setVendorName('');
    setVendorContact('');
    setVendorEmail('');
    setVendorPhone('');
    setVendorWebsite('');
    setVendorNotes('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
            onClick={onClose}
            className="px-4 py-2 border border-subtle rounded-md text-secondary hover:bg-subtle cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white font-semibold rounded-md shadow-xs cursor-pointer"
          >
            Register Supplier
          </button>
        </div>
      </div>
    </Modal>
  );
};
