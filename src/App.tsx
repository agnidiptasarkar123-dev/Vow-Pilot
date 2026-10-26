import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { EventProvider, useEvent } from './context/EventContext';
import { Header } from './components/common/Header';
import { LandingView } from './components/landing/LandingView';
import { DashboardView } from './components/dashboard/DashboardView';
import { Modal } from './components/common/Modal';
import { ViewLoadingFallback } from './components/common/ViewLoadingFallback';
import { VowPilotLogo } from './components/common/VowPilotLogo';
import { PublicRsvpModal } from './components/rsvp/PublicRsvpModal';

// Route-level code splitting: dynamic imports for views
const BudgetPlannerView = lazy(() =>
  import('./components/budget/BudgetPlannerView').then((m) => ({ default: m.BudgetPlannerView }))
);
const DecisionSimulatorView = lazy(() =>
  import('./components/simulator/DecisionSimulatorView').then((m) => ({ default: m.DecisionSimulatorView }))
);
const TaskManagementView = lazy(() =>
  import('./components/tasks/TaskManagementView').then((m) => ({ default: m.TaskManagementView }))
);
const VendorCoordinationView = lazy(() =>
  import('./components/vendors/VendorCoordinationView').then((m) => ({ default: m.VendorCoordinationView }))
);
const AssistantView = lazy(() =>
  import('./components/assistant/AssistantView').then((m) => ({ default: m.AssistantView }))
);
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const NeedsAssessmentWizard = lazy(() =>
  import('./components/assessment/NeedsAssessmentWizard').then((m) => ({ default: m.NeedsAssessmentWizard }))
);
const CollaborationModal = lazy(() =>
  import('./components/collaboration/CollaborationModal').then((m) => ({ default: m.CollaborationModal }))
);
const ConflictModal = lazy(() =>
  import('./components/collaboration/ConflictModal').then((m) => ({ default: m.ConflictModal }))
);
const AuthModal = lazy(() =>
  import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);

// V2 Slices: Invitation Studio, Guest Management, Timeline Run Sheet, Seating Planner, Planning Brief
const InvitationStudioView = lazy(() =>
  import('./components/invitations/InvitationStudioView').then((m) => ({ default: m.InvitationStudioView }))
);
const GuestManagementView = lazy(() =>
  import('./components/guests/GuestManagementView').then((m) => ({ default: m.GuestManagementView }))
);
const EventTimelineView = lazy(() =>
  import('./components/timeline/EventTimelineView').then((m) => ({ default: m.EventTimelineView }))
);
const SeatingPlannerView = lazy(() =>
  import('./components/seating/SeatingPlannerView').then((m) => ({ default: m.SeatingPlannerView }))
);
const PlanningBriefView = lazy(() =>
  import('./components/brief/PlanningBriefView').then((m) => ({ default: m.PlanningBriefView }))
);

const AppContent: React.FC = () => {
  const {
    state,
    activeTab,
    setActiveTab,
    collabState,
    isCollabModalOpen,
    setCollabModalOpen,
    isConflictModalOpen,
    resolveConflictAcceptServer,
    resolveConflictReapplyLocal,
    isAuthModalOpen,
    setAuthModalOpen,
    syncError,
    clearSyncError,
  } = useEvent();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [directRsvpToken, setDirectRsvpToken] = useState<string | null>(null);

  // Check URL query parameters for direct public RSVP link
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('rsvpToken');
      if (token) {
        setDirectRsvpToken(token);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[#E8DCCF] selection:text-[#5B291A] dark:selection:bg-[#4D332B] dark:selection:text-[#FAF8F5] transition-colors duration-200">
      {/* WCAG 2.2 AA Skip to Main Content Bypass Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#B85C3A] focus:text-white focus:rounded-md focus:shadow-lg focus:outline-2 focus:outline-white focus:font-semibold text-xs"
      >
        Skip to main content
      </a>

      {/* Global Application Header */}
      <Header onOpenNewEventWizard={() => setIsWizardOpen(true)} />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 pb-16 focus:outline-hidden">
        {activeTab === 'landing' && (
          <LandingView onStartNewEvent={() => setIsWizardOpen(true)} />
        )}
        {activeTab === 'dashboard' && <DashboardView />}
        <Suspense fallback={<ViewLoadingFallback label="Loading planner module..." />}>
          {activeTab === 'invitations' && <InvitationStudioView />}
          {activeTab === 'guests' && <GuestManagementView />}
          {activeTab === 'timeline' && <EventTimelineView />}
          {activeTab === 'seating' && <SeatingPlannerView />}
          {activeTab === 'brief' && <PlanningBriefView />}
          {activeTab === 'budget' && <BudgetPlannerView />}
          {activeTab === 'simulator' && <DecisionSimulatorView />}
          {activeTab === 'tasks' && <TaskManagementView />}
          {activeTab === 'vendors' && <VendorCoordinationView />}
          {activeTab === 'assistant' && <AssistantView />}
          {activeTab === 'settings' && <SettingsView />}
        </Suspense>
      </main>

      {/* Direct Public RSVP Modal (Triggered via ?rsvpToken=... URL) */}
      {directRsvpToken && (
        <PublicRsvpModal
          isOpen={!!directRsvpToken}
          token={directRsvpToken}
          onClose={() => setDirectRsvpToken(null)}
        />
      )}

      {/* Needs Assessment Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Interactive Needs Assessment"
        description="Establish verified event constraints, budget caps, and scheduling priorities."
        maxWidth="3xl"
      >
        <Suspense fallback={<ViewLoadingFallback label="Loading assessment wizard..." />}>
          {isWizardOpen && (
            <NeedsAssessmentWizard
              onComplete={() => {
                setIsWizardOpen(false);
                setActiveTab('dashboard');
              }}
              onCancel={() => setIsWizardOpen(false)}
            />
          )}
        </Suspense>
      </Modal>

      {/* Multi-User Collaboration & Invitation Modal */}
      {isCollabModalOpen && (
        <Suspense fallback={null}>
          <CollaborationModal
            isOpen={isCollabModalOpen}
            onClose={() => setCollabModalOpen(false)}
            eventId={collabState.activeEventId || state.event.id}
          />
        </Suspense>
      )}

      {/* OCC Concurrency Conflict Resolution Modal */}
      {isConflictModalOpen && (
        <Suspense fallback={null}>
          <ConflictModal
            isOpen={isConflictModalOpen}
            conflict={collabState.lastConflict}
            onAcceptServer={resolveConflictAcceptServer}
            onKeepLocal={resolveConflictReapplyLocal}
          />
        </Suspense>
      )}

      {/* User Authentication Modal */}
      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setAuthModalOpen(false)}
          />
        </Suspense>
      )}

      {/* Real-time Cloud Sync Error Toast */}
      {syncError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-4 right-4 z-50 max-w-md p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 rounded-lg shadow-lg text-xs text-rose-900 dark:text-rose-200 flex items-start justify-between gap-3 animate-fade-in"
        >
          <div>
            <p className="font-semibold text-rose-950 dark:text-rose-100 flex items-center gap-1">
              <span>Cloud Sync Interruption</span>
            </p>
            <p className="mt-0.5 text-rose-800 dark:text-rose-300">{syncError}</p>
          </div>
          <button
            onClick={clearSyncError}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 font-bold p-1 cursor-pointer"
            aria-label="Dismiss error notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subtle Footer */}
      <footer className="no-print border-t border-[#E6DFD5] dark:border-[#2D3F33] bg-[#FFFFFF] dark:bg-[#1F2D24] py-4 text-center text-xs text-[#5C554E] dark:text-[#C5D1C8] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <VowPilotLogo variant="compact" size="xs" />
            <span className="hidden sm:inline">— Plan with clarity. Coordinate with confidence.</span>
          </div>
          <div>
            VowPilot V2 • Intelligent Celebration & Event Planner
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <EventProvider>
        <AppContent />
      </EventProvider>
    </ThemeProvider>
  );
}

export default App;
