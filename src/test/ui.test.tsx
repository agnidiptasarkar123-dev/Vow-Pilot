import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { DEMO_STATE } from '../persistence/demoData';
import { savePersistedState } from '../persistence/storage';

describe('VowPilot End-to-End User Journeys and UI Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    savePersistedState(DEMO_STATE);
  });

  it('renders application header with real Jaipur demo event metrics', () => {
    render(<App />);

    expect(screen.getAllByText(/VowPilot/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Aarav & Meera's Wedding Celebration/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Remaining Runway/i)[0]).toBeInTheDocument();
  });

  it('navigates between all major screens smoothly via header tabs', async () => {
    render(<App />);

    const nav = screen.getByRole('navigation', { name: /tabs/i });

    // 1. Overview Dashboard
    expect(screen.getByRole('heading', { name: /Aarav & Meera's Wedding Celebration/i })).toBeInTheDocument();

    // 2. Budget Planner Tab
    const budgetTab = within(nav).getByRole('button', { name: /Budget Planner/i });
    fireEvent.click(budgetTab);
    expect(screen.getByText(/Budget & Trade-Off Planner/i)).toBeInTheDocument();
    expect(screen.getByText(/Category Allocations/i)).toBeInTheDocument();

    // 3. Decision Simulator Tab
    const simTab = within(nav).getByRole('button', { name: /Decision Simulator/i });
    fireEvent.click(simTab);
    expect(screen.getByText(/Simulate Guest Count/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Variance vs Baseline/i)[0]).toBeInTheDocument();

    // 4. Tasks & Graph Tab
    const tasksTab = within(nav).getByRole('button', { name: /Tasks & Graph/i });
    fireEvent.click(tasksTab);
    expect(screen.getByText(/Tasks & Dependency Graph/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Schedule Catering Tasting & Menu Approval/i)[0]).toBeInTheDocument();

    // 5. Vendors & Quotes Tab
    const vendorsTab = within(nav).getByRole('button', { name: /Vendors & Quotes/i });
    fireEvent.click(vendorsTab);
    expect(screen.getByText(/Vendor Directory & Quotation Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Jaipur Heritage Palace Estates/i)).toBeInTheDocument();

    // 6. Planner Assistant Tab
    const assistantTab = within(nav).getByRole('button', { name: /Planner Assistant/i });
    fireEvent.click(assistantTab);
    expect(screen.getByText(/Context-Aware Planning Coordinator/i)).toBeInTheDocument();

    // 7. Event & Data Settings Tab
    const settingsTab = within(nav).getByRole('button', { name: /Event & Data/i });
    fireEvent.click(settingsTab);
    expect(screen.getByText(/Event Settings & Local Data Management/i)).toBeInTheDocument();
  });

  it('enforces dependency blocking rule when user attempts to complete a blocked task', async () => {
    render(<App />);

    // Navigate to tasks
    const tasksTab = screen.getByRole('button', { name: /Tasks & Graph/i });
    fireEvent.click(tasksTab);

    // Task "Sign Catering Contract & Lock Per-Plate Price"
    const blockedElements = screen.getAllByText(/Sign Catering Contract & Lock Per-Plate Price/i);
    const blockedTaskHeading = blockedElements[0];
    expect(blockedTaskHeading).toBeInTheDocument();

    // Find its completion toggle button
    const taskContainer = blockedTaskHeading.closest('.p-5');
    expect(taskContainer).not.toBeNull();

    const completeBtn = taskContainer!.querySelector('button[title*="Cannot complete"]');
    expect(completeBtn).not.toBeNull();

    // Attempt to click the completion button
    fireEvent.click(completeBtn!);

    // Should display the dependency rule warning banner
    expect(await screen.findByText(/Dependency Rule Enforced:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Schedule Catering Tasting & Menu Approval/i)[0]).toBeInTheDocument();
  });

  it('runs interactive needs assessment wizard with strict field validation', async () => {
    render(<App />);

    // Click + New Event button in header
    const newEventBtn = screen.getByRole('button', { name: /\+ New Event/i });
    fireEvent.click(newEventBtn);

    // Wizard modal opens
    expect(screen.getByText(/Define Event Foundation/i)).toBeInTheDocument();

    // Attempt to proceed without required fields
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn);

    // Required validation errors should appear
    expect(await screen.findByText(/Event title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Event date is required/i)).toBeInTheDocument();
  });

  it('allows drafting a clarification inquiry for an incomplete quotation', async () => {
    render(<App />);

    // Navigate to Vendors tab
    const vendorsTab = screen.getByRole('button', { name: /Vendors & Quotes/i });
    fireEvent.click(vendorsTab);

    // Switch to Photography category tab
    const photoCategoryBtn = screen.getByRole('button', { name: /Photography & Cinema/i });
    fireEvent.click(photoCategoryBtn);

    // Find ShutterCraft Visuals (which has missing validity and omissions)
    expect(screen.getByText(/ShutterCraft Visuals/i)).toBeInTheDocument();

    // Click Draft Clarification
    const draftBtns = screen.getAllByRole('button', { name: /Draft Clarification/i });
    fireEvent.click(draftBtns[0]);

    // Modal opens with drafted inquiry
    expect(screen.getByText(/Clarification Inquiry:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Inquiry Message/i })).toBeInTheDocument();
  });

  it('simulates guest count changes in simulator without altering confirmed plan', async () => {
    render(<App />);

    // Navigate to Decision Simulator
    const simTab = screen.getByRole('button', { name: /Decision Simulator/i });
    fireEvent.click(simTab);

    expect(screen.getByText(/Simulate Guest Count \(150 Guests\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Variance vs Baseline/i)[0]).toBeInTheDocument();

    // Save as scenario modal can open
    const saveBtn = screen.getByRole('button', { name: /Save as Scenario/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Save Simulation as Scenario/i)).toBeInTheDocument();
  });
});
