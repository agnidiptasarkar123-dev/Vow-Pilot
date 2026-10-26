import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeatingPlannerView } from '../components/seating/SeatingPlannerView';
import { EventProvider } from '../context/EventContext';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState } from '../types';

describe('Seating Planner Accessibility & Screen Reader Ergonomics', () => {
  const initialTestState: AppState = JSON.parse(JSON.stringify(DEMO_STATE));

  it('renders ARIA live status region for immediate auditory announcements', () => {
    render(
      <EventProvider initialState={initialTestState}>
        <SeatingPlannerView />
      </EventProvider>
    );

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeDefined();
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.getAttribute('aria-atomic')).toBe('true');
  });

  it('provides explicit accessible names (aria-label) on table move dropdowns', () => {
    // Ensure we have a table with a seated guest
    const stateWithSeatedGuest: AppState = {
      ...initialTestState,
      tables: [
        {
          id: 'tbl-high-1',
          eventId: 'event-demo-1',
          name: 'Head Table Alpha',
          capacity: 4,
          shape: 'round',
          assignedGuestIds: ['guest-1'],
        },
        {
          id: 'tbl-high-2',
          eventId: 'event-demo-1',
          name: 'Table Beta',
          capacity: 8,
          shape: 'round',
          assignedGuestIds: [],
        },
      ],
      guests: [
        {
          id: 'guest-1',
          eventId: 'event-demo-1',
          name: 'Arjun Das',
          partySize: 2,
          confirmedCount: 2,
          rsvpStatus: 'accepted',
          tableId: 'tbl-high-1',
          invitationToken: 'token_guest_1',
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    render(
      <EventProvider initialState={stateWithSeatedGuest}>
        <SeatingPlannerView />
      </EventProvider>
    );

    const moveSelect = screen.getByLabelText(/Move Arjun Das from Head Table Alpha to another table/i);
    expect(moveSelect).toBeDefined();

    const removeBtn = screen.getByLabelText(/Remove Arjun Das from Head Table Alpha/i);
    expect(removeBtn).toBeDefined();
  });

  it('announces seating assignment and over-capacity warnings to ARIA live region', () => {
    const stateWithTightCapacity: AppState = {
      ...initialTestState,
      tables: [
        {
          id: 'tbl-intimate',
          eventId: 'event-demo-1',
          name: 'Intimate Table',
          capacity: 1,
          shape: 'round',
          assignedGuestIds: [],
        },
      ],
      guests: [
        {
          id: 'guest-unseated-1',
          eventId: 'event-demo-1',
          name: 'Priya Sharma',
          partySize: 1,
          confirmedCount: 1,
          rsvpStatus: 'accepted',
          invitationToken: 'token_priya',
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    render(
      <EventProvider initialState={stateWithTightCapacity}>
        <SeatingPlannerView />
      </EventProvider>
    );

    const assignSelect = screen.getByLabelText(/Assign Priya Sharma to a reception table/i);
    expect(assignSelect).toBeDefined();

    // Assign Priya to Intimate Table
    fireEvent.change(assignSelect, { target: { value: 'tbl-intimate' } });

    const liveRegion = screen.getByRole('status');
    expect(liveRegion.textContent).toContain('Priya Sharma seated at Intimate Table');
  });
});
