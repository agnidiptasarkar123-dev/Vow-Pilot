import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventProvider } from '../context/EventContext';
import { VendorCoordinationView } from '../components/vendors/VendorCoordinationView';

describe('Vendor Coordination & Safe Message Dispatch (Finding B)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders Launch Email Client button in clarification modal with RFC-6068 mailto trigger', async () => {
    const originalLocation = window.location;
    let assignedHref = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        get href() {
          return assignedHref;
        },
        set href(val: string) {
          assignedHref = val;
        },
      },
    });

    render(
      <EventProvider>
        <VendorCoordinationView />
      </EventProvider>
    );

    // Open clarification modal on first quote card
    const draftButtons = screen.getAllByRole('button', { name: /Draft clarification message/i });
    expect(draftButtons.length).toBeGreaterThan(0);
    fireEvent.click(draftButtons[0]);

    // Check modal contents
    expect(screen.getByText(/Clarification Inquiry:/i)).toBeInTheDocument();
    expect(screen.getByText(/Supplier Email:/i)).toBeInTheDocument();

    const launchEmailBtn = screen.getByRole('button', { name: /Launch Email Client/i });
    expect(launchEmailBtn).toBeInTheDocument();

    // Trigger launch
    fireEvent.click(launchEmailBtn);

    // Verify window.location.href was assigned a mailto: URI
    await waitFor(() => {
      expect(assignedHref).toMatch(/^mailto:/);
      expect(assignedHref).toContain('Clarification%3A%20Quotation%20for');
    });

    // Check that client confirmation status is displayed
    expect(screen.getByText(/Client Launched & Logged/i)).toBeInTheDocument();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('provides copy fallback with clipboard and records audit trace', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <EventProvider>
        <VendorCoordinationView />
      </EventProvider>
    );

    const draftButtons = screen.getAllByRole('button', { name: /Draft clarification message/i });
    fireEvent.click(draftButtons[0]);

    const copyBtn = screen.getByRole('button', { name: /Copy Inquiry Message/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
    });
  });
});
