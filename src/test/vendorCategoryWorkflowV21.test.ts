import { describe, it, expect } from 'vitest';
import { getCategoryStarter } from '../components/vendors/vendorCategoryStarters';
import { handleAddVendor } from '../context/slices/vendorSlice';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState } from '../types';

describe('VowPilot V2.1 — Vendor Category Starter Workflows & Quotation Integrity', () => {
  it('supplies rich category-specific scope checklists and evaluation questions for Decor and Entertainment', () => {
    const decorStarter = getCategoryStarter('decor', 'Decor & Production');
    expect(decorStarter.scopeTitle).toContain('Decor & Production');
    expect(decorStarter.scopeChecklist.length).toBeGreaterThanOrEqual(5);
    expect(decorStarter.scopeChecklist.some((item) => item.toLowerCase().includes('floral'))).toBe(true);
    expect(decorStarter.scopeChecklist.some((item) => item.toLowerCase().includes('lighting'))).toBe(true);
    expect(decorStarter.suggestedQuestions.some((q) => q.toLowerCase().includes('teardown') || q.toLowerCase().includes('generator'))).toBe(true);

    const musicStarter = getCategoryStarter('entertainment', 'Music & Entertainment');
    expect(musicStarter.scopeTitle).toContain('Music & Entertainment');
    expect(musicStarter.scopeChecklist.some((item) => item.toLowerCase().includes('dj') || item.toLowerCase().includes('live band'))).toBe(true);
    expect(musicStarter.suggestedQuestions.some((q) => q.toLowerCase().includes('overtime') || q.toLowerCase().includes('sound'))).toBe(true);
  });

  it('provides category starters for Catering, Photography, Venue, Logistics, and custom fallback categories', () => {
    const cateringStarter = getCategoryStarter('catering', 'Catering & Dining');
    expect(cateringStarter.scopeChecklist.some((i) => i.toLowerCase().includes('dietary') || i.toLowerCase().includes('courses'))).toBe(true);

    const photoStarter = getCategoryStarter('photography', 'Photography & Cinema');
    expect(photoStarter.scopeChecklist.some((i) => i.toLowerCase().includes('drone') || i.toLowerCase().includes('photographer'))).toBe(true);

    const venueStarter = getCategoryStarter('venue', 'Venue & Facilities');
    expect(venueStarter.scopeChecklist.some((i) => i.toLowerCase().includes('parking') || i.toLowerCase().includes('curfew'))).toBe(true);

    const customStarter = getCategoryStarter('pyrotechnics', 'Pyrotechnics & Fireworks');
    expect(customStarter.scopeTitle).toContain('Pyrotechnics & Fireworks');
    expect(customStarter.scopeChecklist.length).toBeGreaterThanOrEqual(4);
    expect(customStarter.suggestedQuestions.length).toBeGreaterThanOrEqual(3);
  });

  it('registers user-created suppliers with isSample: false and correctly associates with active category', () => {
    let state: AppState = { ...DEMO_STATE, vendors: [] };

    const newSupplier = {
      name: 'Lotus Heritage Decorators',
      categoryId: 'decor',
      contactName: 'Sunita Rao',
      email: 'sunita@lotusdecor.example',
      phone: '+91 98222 11111',
      isSample: false,
    };

    state = handleAddVendor(state, newSupplier);

    expect(state.vendors.length).toBe(1);
    const saved = state.vendors[0];
    expect(saved.name).toBe('Lotus Heritage Decorators');
    expect(saved.categoryId).toBe('decor');
    expect(saved.isSample).toBe(false); // Must NEVER be labeled as fictional demo record!
  });

  it('clearly identifies fictional demonstration records from real suppliers', () => {
    const demoVendors = DEMO_STATE.vendors;
    expect(demoVendors.length).toBeGreaterThan(0);
    const sampleVendor = demoVendors.find((v) => v.isSample);
    expect(sampleVendor).toBeDefined();
    expect(sampleVendor?.isSample).toBe(true);
  });
});
