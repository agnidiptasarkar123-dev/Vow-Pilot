import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { EventProvider } from '../context/EventContext';
import { DashboardView } from '../components/dashboard/DashboardView';
import { BudgetPlannerView } from '../components/budget/BudgetPlannerView';
import { TaskManagementView } from '../components/tasks/TaskManagementView';
import { VendorCoordinationView } from '../components/vendors/VendorCoordinationView';
import { DecisionSimulatorView } from '../components/simulator/DecisionSimulatorView';
import { AssistantView } from '../components/assistant/AssistantView';
import { NeedsAssessmentWizard } from '../components/assessment/NeedsAssessmentWizard';

/**
 * Visual Structure & Layout Regression Suite
 *
 * NOTE ON ENVIRONMENT CONSTRAINTS (Finding C):
 * Binary headless Chromium/Playwright binaries are not present on this host system.
 * Therefore, raw pixel-diff raster image testing is recorded as NOT PERFORMED.
 *
 * To prevent layout regressions, this suite captures deterministic, high-fidelity
 * structural DOM representations for all 7 primary views across Desktop (1280px)
 * and Mobile (375px) viewports with deterministic demo state and frozen timestamps.
 */

describe('Visual Layout & Structural Regression (Finding C)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
  });

  const renderWithViewport = (ui: React.ReactElement, width: number) => {
    // Simulate viewport container width
    return render(
      <div style={{ width: `${width}px`, minHeight: '800px', margin: '0 auto' }}>
        <EventProvider>{ui}</EventProvider>
      </div>
    );
  };

  describe('Desktop Viewport (1280px)', () => {
    const DESKTOP_WIDTH = 1280;

    it('renders DashboardView layout correctly on desktop', () => {
      const { asFragment, getByText } = renderWithViewport(<DashboardView />, DESKTOP_WIDTH);
      expect(getByText(/Aarav & Meera's Wedding Celebration/i)).toBeInTheDocument();
      expect(getByText(/Projected Spend/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders BudgetPlannerView layout correctly on desktop', () => {
      const { asFragment, getByText } = renderWithViewport(<BudgetPlannerView />, DESKTOP_WIDTH);
      expect(getByText(/Budget & Trade-Off Planner/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders TaskManagementView layout correctly on desktop', () => {
      const { asFragment, getByText } = renderWithViewport(<TaskManagementView />, DESKTOP_WIDTH);
      expect(getByText(/Tasks & Dependency Graph/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders VendorCoordinationView layout correctly on desktop', () => {
      const { asFragment, getByText } = renderWithViewport(<VendorCoordinationView />, DESKTOP_WIDTH);
      expect(getByText(/Vendor Directory & Quotation Matrix/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders DecisionSimulatorView layout correctly on desktop', () => {
      const { asFragment, getByText } = renderWithViewport(<DecisionSimulatorView />, DESKTOP_WIDTH);
      expect(getByText(/Decision Impact Simulator/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders AssistantView layout correctly on desktop', () => {
      const { asFragment, getByText } = renderWithViewport(<AssistantView />, DESKTOP_WIDTH);
      expect(getByText(/Context-Aware Planning Coordinator/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders NeedsAssessmentWizard layout correctly on desktop', () => {
      const { asFragment, getByText } = renderWithViewport(
        <NeedsAssessmentWizard onComplete={() => {}} onCancel={() => {}} />,
        DESKTOP_WIDTH
      );
      expect(getByText(/Define Event Foundation/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });
  });

  describe('Mobile Viewport (375px)', () => {
    const MOBILE_WIDTH = 375;

    it('renders DashboardView layout correctly on mobile', () => {
      const { asFragment, getByText } = renderWithViewport(<DashboardView />, MOBILE_WIDTH);
      expect(getByText(/Aarav & Meera's Wedding Celebration/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders BudgetPlannerView layout correctly on mobile', () => {
      const { asFragment, getByText } = renderWithViewport(<BudgetPlannerView />, MOBILE_WIDTH);
      expect(getByText(/Budget & Trade-Off Planner/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders TaskManagementView layout correctly on mobile', () => {
      const { asFragment, getByText } = renderWithViewport(<TaskManagementView />, MOBILE_WIDTH);
      expect(getByText(/Tasks & Dependency Graph/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders VendorCoordinationView layout correctly on mobile', () => {
      const { asFragment, getByText } = renderWithViewport(<VendorCoordinationView />, MOBILE_WIDTH);
      expect(getByText(/Vendor Directory & Quotation Matrix/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders DecisionSimulatorView layout correctly on mobile', () => {
      const { asFragment, getByText } = renderWithViewport(<DecisionSimulatorView />, MOBILE_WIDTH);
      expect(getByText(/Decision Impact Simulator/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders AssistantView layout correctly on mobile', () => {
      const { asFragment, getByText } = renderWithViewport(<AssistantView />, MOBILE_WIDTH);
      expect(getByText(/Context-Aware Planning Coordinator/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });

    it('renders NeedsAssessmentWizard layout correctly on mobile', () => {
      const { asFragment, getByText } = renderWithViewport(
        <NeedsAssessmentWizard onComplete={() => {}} onCancel={() => {}} />,
        MOBILE_WIDTH
      );
      expect(getByText(/Define Event Foundation/i)).toBeInTheDocument();
      expect(asFragment()).toMatchSnapshot();
    });
  });
});
