import React, { useState, lazy, Suspense } from 'react';
import { EventProvider, useEvent } from './context/EventContext';
import { Header } from './components/common/Header';
import { LandingView } from './components/landing/LandingView';
import { DashboardView } from './components/dashboard/DashboardView';
import { Modal } from './components/common/Modal';
import { ViewLoadingFallback } from './components/common/ViewLoadingFallback';

// Route-level code splitting: dynamic imports for secondary heavy views
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

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1D1A] flex flex-col font-sans selection:bg-[#E8DCCF] selection:text-[#5B291A]">
      {/* WCAG 2.2 AA Skip to Main Content Bypass Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#A2421D] focus:text-white focus:rounded-md focus:shadow-lg focus:outline-2 focus:outline-white focus:font-semibold text-xs"
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
          {activeTab === 'budget' && <BudgetPlannerView />}
          {activeTab === 'simulator' && <DecisionSimulatorView />}
          {activeTab === 'tasks' && <TaskManagementView />}
          {activeTab === 'vendors' && <VendorCoordinationView />}
          {activeTab === 'assistant' && <AssistantView />}
          {activeTab === 'settings' && <SettingsView />}
        </Suspense>
      </main>

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
          className="fixed bottom-4 right-4 z-50 max-w-md p-3.5 bg-rose-50 border border-rose-300 rounded-lg shadow-lg text-xs text-rose-900 flex items-start justify-between gap-3 animate-fade-in"
        >
          <div>
            <p className="font-semibold text-rose-950 flex items-center gap-1">
              <span>Cloud Sync Interruption</span>
            </p>
            <p className="mt-0.5 text-rose-800">{syncError}</p>
          </div>
          <button
            onClick={clearSyncError}
            className="text-rose-600 hover:text-rose-900 font-bold p-1 cursor-pointer"
            aria-label="Dismiss error notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subtle Footer */}
      <footer className="border-t border-[#E6DFD5] bg-[#FFFFFF] py-4 text-center text-xs text-[#5C554E]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1C1917] font-serif-heading">VowPilot</span>
            <span>— Plan with clarity. Coordinate with confidence.</span>
          </div>
          <div>
            Prompt Wars Virtual • Challenge 5: Celebration & Event Planner
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <EventProvider>
      <AppContent />
    </EventProvider>
  );
}

export default App;
