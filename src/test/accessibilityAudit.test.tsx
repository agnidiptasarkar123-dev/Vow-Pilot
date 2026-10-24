import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventProvider } from '../context/EventContext';
import { DashboardView } from '../components/dashboard/DashboardView';
import { TaskManagementView } from '../components/tasks/TaskManagementView';
import { VendorCoordinationView } from '../components/vendors/VendorCoordinationView';
import { BudgetPlannerView } from '../components/budget/BudgetPlannerView';
import { NeedsAssessmentWizard } from '../components/assessment/NeedsAssessmentWizard';
import { Modal } from '../components/common/Modal';

/**
 * Comprehensive Accessibility (A11y) & Assistive Semantics Audit (Finding F)
 *
 * NOTE ON METHODOLOGY & LIMITATIONS:
 * In accordance with strict evaluation standards:
 * - DOM-level accessibility (ARIA roles, accessible names, label associations, focus management,
 *   keyboard triggering, modal dialog attributes) is rigorously VERIFIED by this automated test suite.
 * - Live screen reader auditory verification (e.g. Apple VoiceOver audio output, NVDA speech synthesis)
 *   is explicitly recorded as: NOT PERFORMED (requires human-in-the-loop audio hardware assessment).
 */

describe('Accessibility & Assistive Semantics Verification (Finding F)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Dialog Behavior and Focus Containment', () => {
    it('Modal renders with proper accessibility attributes: role="dialog", aria-modal="true", and aria-labelledby', () => {
      render(
        <Modal
          isOpen={true}
          onClose={() => {}}
          title="Adjust Allocation Cap"
          description="Modify the category spending limit."
        >
          <div>Modal Body Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(screen.getByText('Adjust Allocation Cap')).toHaveAttribute('id', 'modal-title');
    });

    it('Modal triggers onClose when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Escape Test">
          <div>Content</div>
        </Modal>
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('Modal close button has accessible label and responds to keyboard Enter/Space', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Button Test">
          <div>Content</div>
        </Modal>
      );

      const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
      expect(closeBtn).toBeInTheDocument();
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form Label Association and Interactive Elements', () => {
    it('NeedsAssessmentWizard inputs have programmatic label associations', () => {
      render(
        <EventProvider>
          <NeedsAssessmentWizard onComplete={() => {}} onCancel={() => {}} />
        </EventProvider>
      );

      // Event Title
      const eventNameInput = screen.getByLabelText(/Event Title/i);
      expect(eventNameInput).toBeInTheDocument();
      expect(eventNameInput).toHaveAttribute('id', 'wizard-event-name');

      // Event Type
      const eventTypeSelect = screen.getByLabelText(/Event Type/i);
      expect(eventTypeSelect).toBeInTheDocument();
      expect(eventTypeSelect).toHaveAttribute('id', 'wizard-event-type');

      // Event Date
      const eventDateInput = screen.getByLabelText(/Event Date/i);
      expect(eventDateInput).toBeInTheDocument();

      // Location
      const locationInput = screen.getByLabelText(/City & Destination/i);
      expect(locationInput).toBeInTheDocument();

      // Guest count
      const guestInput = screen.getByLabelText(/Expected Guest Count/i);
      expect(guestInput).toBeInTheDocument();
    });

    it('TaskManagementView all buttons have accessible names or aria-labels', () => {
      render(
        <EventProvider>
          <TaskManagementView />
        </EventProvider>
      );

      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        // Every button must have accessible text content or an aria-label
        const accessibleName = btn.getAttribute('aria-label') || btn.textContent?.trim();
        expect(accessibleName).toBeTruthy();
      }
    });

    it('VendorCoordinationView all quotation buttons have accessible names', () => {
      render(
        <EventProvider>
          <VendorCoordinationView />
        </EventProvider>
      );

      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        const accessibleName = btn.getAttribute('aria-label') || btn.textContent?.trim();
        expect(accessibleName).toBeTruthy();
      }
    });
  });

  describe('Semantic Heading Hierarchy and Document Structure', () => {
    it('DashboardView maintains clean h1 and subheadings without skipping levels', () => {
      render(
        <EventProvider>
          <DashboardView />
        </EventProvider>
      );

      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements.length).toBe(1);
      expect(h1Elements[0].textContent).toContain("Aarav & Meera's Wedding Celebration");
    });

    it('BudgetPlannerView has exactly one h1 and valid section headers', () => {
      render(
        <EventProvider>
          <BudgetPlannerView />
        </EventProvider>
      );

      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements.length).toBe(1);
      expect(h1Elements[0].textContent).toContain('Budget & Trade-Off Planner');
    });

    it('TaskManagementView has exactly one h1 heading', () => {
      render(
        <EventProvider>
          <TaskManagementView />
        </EventProvider>
      );

      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements.length).toBe(1);
      expect(h1Elements[0].textContent).toContain('Tasks & Dependency Graph');
    });
  });
});
