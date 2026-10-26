import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Helper to compute luminance and WCAG contrast ratio
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const lum1 = getLuminance(r1, g1, b1);
  const lum2 = getLuminance(r2, g2, b2);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('VowPilot V2.1 — Midnight Cocoa Theme Tokens & Contrast Standards', () => {
  const cssPath = path.resolve(__dirname, '../index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('defines the complete Midnight Cocoa / Muted Rose dark mode tokens in index.css', () => {
    // Assert all required Midnight Cocoa tokens exist in .dark rules
    expect(cssContent).toContain('--bg-canvas: #171517');
    expect(cssContent).toContain('--bg-surface: #211E21');
    expect(cssContent).toContain('--bg-elevated: #292429');
    expect(cssContent).toContain('--bg-subtle: #322B30');
    expect(cssContent).toContain('--border-subtle: #41373D');
    expect(cssContent).toContain('--border-strong: #55464D');
    expect(cssContent).toContain('--text-primary: #F1E9E3');
    expect(cssContent).toContain('--text-secondary: #C5B9B3');
    expect(cssContent).toContain('--text-tertiary: #A99C96');
    expect(cssContent).toContain('--accent: #D48668');
    expect(cssContent).toContain('--rose-accent: #C998A2');
    expect(cssContent).toContain('--botanical-sage: #8CA394');
    expect(cssContent).toContain('--status-success: #91B8A0');
    expect(cssContent).toContain('--status-warning: #E5BD76');
    expect(cssContent).toContain('--status-danger: #E58C91');
  });

  it('preserves warm cream and terracotta design tokens in the light theme root', () => {
    expect(cssContent).toContain('--bg-canvas: #FAF8F5');
    expect(cssContent).toContain('--bg-surface: #FFFFFF');
    expect(cssContent).toContain('--text-primary: #26221F');
    expect(cssContent).toContain('--accent: #B85C3A');
  });

  it('validates WCAG 2.1 AA and AAA contrast ratios for low-light Midnight Cocoa theme', () => {
    const bgMain = '#171517';
    const bgSurface = '#211E21';
    const bgElevated = '#292429';

    const textPrimary = '#F1E9E3';
    const textSecondary = '#C5B9B3';
    const terracotta = '#D48668';
    const sage = '#8CA394';

    // Primary text on Midnight Cocoa surfaces must exceed WCAG AAA (7:1) for body text
    const contrastPrimaryMain = getContrastRatio(textPrimary, bgMain);
    const contrastPrimarySurface = getContrastRatio(textPrimary, bgSurface);
    const contrastPrimaryElevated = getContrastRatio(textPrimary, bgElevated);

    expect(contrastPrimaryMain).toBeGreaterThan(13.0);
    expect(contrastPrimarySurface).toBeGreaterThan(11.0);
    expect(contrastPrimaryElevated).toBeGreaterThan(10.0);

    // Secondary text must exceed WCAG AA (4.5:1) for body text
    const contrastSecondaryMain = getContrastRatio(textSecondary, bgMain);
    const contrastSecondarySurface = getContrastRatio(textSecondary, bgSurface);

    expect(contrastSecondaryMain).toBeGreaterThan(7.0);
    expect(contrastSecondarySurface).toBeGreaterThan(6.0);

    // Terracotta brand accent and sage botanical details must remain clearly visible
    const contrastTerracotta = getContrastRatio(terracotta, bgSurface);
    const contrastSage = getContrastRatio(sage, bgSurface);

    expect(contrastTerracotta).toBeGreaterThan(4.5);
    expect(contrastSage).toBeGreaterThan(4.5);
  });
});
