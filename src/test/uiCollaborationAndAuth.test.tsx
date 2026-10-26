import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { DEMO_STATE } from '../persistence/demoData';
import { savePersistedState } from '../persistence/storage';

describe('VowPilot UI Collaboration, Auth & Runtime Indicators', () => {
  beforeEach(() => {
    localStorage.clear();
    savePersistedState(DEMO_STATE);
  });

  it('renders accurate runtime mode and schema version badge in the header', () => {
    render(<App />);

    const badge = screen.getByTestId('collab-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/Local · This device/i);
    expect(badge).not.toHaveTextContent(/Storage v1/i);
  });

  it('opens AuthModal from header sign-in pill and toggles between Sign In and Register', async () => {
    render(<App />);

    // Click Sign In button in header
    const signInBtn = screen.getByTestId('header-sign-in-btn');
    fireEvent.click(signInBtn);

    // Modal opens (lazy-loaded)
    expect(await screen.findByRole('heading', { name: /Sign In to VowPilot/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign In & Connect/i)).toBeInTheDocument();
    expect(screen.getByText(/Argon2id/i)).toBeInTheDocument();

    // Toggle to Register mode
    const createAccountTab = screen.getByRole('button', { name: /Create Account/i });
    fireEvent.click(createAccountTab);

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /Sign In to VowPilot/i })).not.toBeInTheDocument();
  });

  it('opens CollaborationModal and displays explicit authentication requirement when unauthenticated', async () => {
    render(<App />);

    // Click Collaborate button in header
    const collabBtn = screen.getByTestId('open-collab-btn');
    fireEvent.click(collabBtn);

    // Modal opens (lazy-loaded)
    expect(await screen.findByText(/Multi-User Event Collaboration/i)).toBeInTheDocument();

    // Auth notice is visible
    expect(screen.getByText(/Authentication Required for Team Collaboration/i)).toBeInTheDocument();

    // Clicking Sign In / Register in collab banner opens AuthModal
    const bannerSignIn = screen.getByRole('button', { name: /Sign In \/ Register/i });
    fireEvent.click(bannerSignIn);

    expect(await screen.findByRole('heading', { name: /Sign In to VowPilot/i })).toBeInTheDocument();
  });

  it('displays accurate cloud sync and storage health in SettingsView', async () => {
    render(<App />);

    const nav = screen.getByRole('navigation', { name: /tabs/i });
    const settingsTab = within(nav).getByRole('button', { name: /Event & Data/i });
    fireEvent.click(settingsTab);

    expect(await screen.findByText(/Privacy & Client-Side Storage Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Storage/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Browser LocalStorage/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cloud Sync & Auth/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Local Mode/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign in to sync/i)).toBeInTheDocument();
  });
});
