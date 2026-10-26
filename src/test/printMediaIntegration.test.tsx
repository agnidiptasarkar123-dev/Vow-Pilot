import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { EventProvider } from '../context/EventContext';
import { InvitationStudioView } from '../components/invitations/InvitationStudioView';
import { EventTimelineView } from '../components/timeline/EventTimelineView';
import { SeatingPlannerView } from '../components/seating/SeatingPlannerView';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState } from '../types';
import fs from 'fs';
import path from 'path';

describe('Print Media Layout & Color Adjust Integration Suite', () => {
  const sampleState: AppState = {
    ...JSON.parse(JSON.stringify(DEMO_STATE)),
    event: {
      ...DEMO_STATE.event,
      name: 'Aditi & Dev Royal Nuptials',
      location: 'Umaid Bhawan Palace, Jodhpur',
      date: '2026-11-20',
    },
  };

  it('verifies src/index.css includes exact print color adjust and isolated container classes', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('@media print');
    expect(cssContent).toContain('print-color-adjust: exact !important');
    expect(cssContent).toContain('-webkit-print-color-adjust: exact !important');
    expect(cssContent).toContain('.no-print');
    expect(cssContent).toContain('display: none !important');
    expect(cssContent).toContain('.print-only');
    expect(cssContent).toContain('display: block !important');
    expect(cssContent).toContain('.printable-invitation-container');
    expect(cssContent).toContain('page-break-inside: avoid !important');
  });

  it('verifies InvitationStudioView isolates printable canvas from editing chrome', () => {
    const { container } = render(
      <EventProvider initialState={sampleState}>
        <InvitationStudioView />
      </EventProvider>
    );

    // Controls must have no-print class so print spoolers hide them
    const noPrintElements = container.querySelectorAll('.no-print');
    expect(noPrintElements.length).toBeGreaterThanOrEqual(3);

    // Printable invitation container must be present
    const printContainer = container.querySelector('.printable-invitation-container');
    expect(printContainer).toBeInTheDocument();
    expect(printContainer).not.toHaveClass('no-print');
  });

  it('verifies EventTimelineView renders print-only master header and hides control bar', () => {
    const { container } = render(
      <EventProvider initialState={sampleState}>
        <EventTimelineView />
      </EventProvider>
    );

    // Master run sheet print header
    const printOnlyHeader = container.querySelector('.print-only');
    expect(printOnlyHeader).toBeInTheDocument();
    expect(printOnlyHeader?.textContent).toContain('Official Event-Day Run Sheet');
    expect(printOnlyHeader?.textContent).toContain('Umaid Bhawan Palace');

    // Controls must have no-print
    const noPrintBar = container.querySelector('.no-print');
    expect(noPrintBar).toBeInTheDocument();
    expect(noPrintBar?.textContent).toContain('Print Run Sheet');
  });

  it('verifies SeatingPlannerView renders print-only header and isolates floor tables', () => {
    const { container } = render(
      <EventProvider initialState={sampleState}>
        <SeatingPlannerView />
      </EventProvider>
    );

    const printOnlyTitle = container.querySelector('.print-only');
    expect(printOnlyTitle).toBeInTheDocument();
    expect(printOnlyTitle?.textContent).toContain('Guest Seating Plan');
    expect(printOnlyTitle?.textContent).toContain('Umaid Bhawan Palace');

    const noPrintControlBar = container.querySelector('.no-print');
    expect(noPrintControlBar).toBeInTheDocument();
  });
});
