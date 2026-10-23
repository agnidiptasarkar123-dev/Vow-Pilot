import React, { useState } from 'react';
import { EventProvider, useEvent } from './context/EventContext';
import { Header } from './components/common/Header';
import { LandingView } from './components/landing/LandingView';
import { DashboardView } from './components/dashboard/DashboardView';
import { BudgetPlannerView } from './components/budget/BudgetPlannerView';
import { DecisionSimulatorView } from './components/simulator/DecisionSimulatorView';
import { TaskManagementView } from './components/tasks/TaskManagementView';
import { VendorCoordinationView } from './components/vendors/VendorCoordinationView';
import { AssistantView } from './components/assistant/AssistantView';
import { SettingsView } from './components/settings/SettingsView';
import { NeedsAssessmentWizard } from './components/assessment/NeedsAssessmentWizard';
import { Modal } from './components/common/Modal';

const AppContent: React.FC = () => {
  const { activeTab, setActiveTab } = useEvent();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1D1A] flex flex-col font-sans selection:bg-[#E8DCCF] selection:text-[#5B291A]">
      {/* Global Application Header */}
      <Header onOpenNewEventWizard={() => setIsWizardOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'landing' && (
          <LandingView onStartNewEvent={() => setIsWizardOpen(true)} />
        )}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'budget' && <BudgetPlannerView />}
        {activeTab === 'simulator' && <DecisionSimulatorView />}
        {activeTab === 'tasks' && <TaskManagementView />}
        {activeTab === 'vendors' && <VendorCoordinationView />}
        {activeTab === 'assistant' && <AssistantView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Needs Assessment Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Interactive Needs Assessment"
        description="Establish verified event constraints, budget caps, and scheduling priorities."
        maxWidth="3xl"
      >
        <NeedsAssessmentWizard
          onComplete={() => {
            setIsWizardOpen(false);
            setActiveTab('dashboard');
          }}
          onCancel={() => setIsWizardOpen(false)}
        />
      </Modal>

      {/* Subtle Footer */}
      <footer className="border-t border-[#E6DFD5] bg-[#FFFFFF] py-4 text-center text-xs text-[#78716C]">
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
