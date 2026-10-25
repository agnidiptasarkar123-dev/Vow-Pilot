import React from 'react';
import { useEvent } from '../../context/EventContext';
import { formatCurrency } from '../../domain/currency';
import { calculateBudgetOverview } from '../../domain/budgetEngine';
import { evaluateTasks } from '../../domain/taskEngine';
import {
  Calendar,
  Compass,
  PieChart,
  Sliders,
  CheckSquare,
  Users,
  MessageSquare,
  Settings,
  RotateCcw,
} from 'lucide-react';

interface HeaderProps {
  onOpenNewEventWizard: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewEventWizard }) => {
  const { state, activeTab, setActiveTab, resetToDemo } = useEvent();
  const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
  const evaluations = evaluateTasks(state.tasks, state.event.date);
  const overdueCount = evaluations.filter((e) => e.risks.isOverdue).length;

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: Compass },
    { id: 'budget', label: 'Budget Planner', icon: PieChart },
    { id: 'simulator', label: 'Decision Simulator', icon: Sliders },
    { id: 'tasks', label: 'Tasks & Graph', icon: CheckSquare, badge: overdueCount > 0 ? `${overdueCount} Late` : undefined },
    { id: 'vendors', label: 'Vendors & Quotes', icon: Users },
    { id: 'assistant', label: 'Planner Assistant', icon: MessageSquare },
    { id: 'settings', label: 'Event & Data', icon: Settings },
  ];

  const handleResetWithConfirm = () => {
    if (window.confirm('Reset the workspace back to the initial Jaipur Wedding demonstration dataset? Any unexported custom changes will be replaced.')) {
      resetToDemo();
    }
  };

  return (
    <header className="border-b border-[#E6DFD5] bg-[#FFFFFF] sticky top-0 z-30 shadow-xs">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-md bg-[#A2421D] flex items-center justify-center text-white font-serif font-bold text-lg shadow-xs">
            V
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-[#1C1917] font-serif-heading">
                VowPilot
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#FAF0EB] text-[#A2421D] font-medium border border-[#F3CEBE]">
                Coordinator
              </span>
            </div>
            <p className="text-xs text-[#78716C] hidden sm:block">
              Plan with clarity. Coordinate with confidence.
            </p>
          </div>
        </div>

        {/* Event Quick Info */}
        <div className="flex items-center space-x-6 text-sm">
          <div className="hidden md:flex flex-col text-right">
            <span className="font-semibold text-[#1C1917] truncate max-w-[240px]">
              {state.event.name}
            </span>
            <span className="text-xs text-[#78716C] flex items-center justify-end gap-1">
              <Calendar className="w-3 h-3" />
              {state.event.date} • {state.event.guestCount} Guests
            </span>
          </div>

          <div className="h-8 w-px bg-[#E6DFD5] hidden md:block" />

          {/* Budget Health Pill */}
          <div className="flex flex-col text-right">
            <span className="text-xs text-[#78716C]">Remaining Runway</span>
            <span
              className={`font-mono text-sm font-semibold ${
                overview.isOverrun ? 'text-[#BE123C]' : 'text-[#047857]'
              }`}
            >
              {formatCurrency(overview.remainingBudget, state.event.currency)}
            </span>
          </div>

          {/* Real-time Collaboration Status Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200 shadow-2xs"
            title="State persistence & real-time sync active (OCC Protected)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span className="hidden sm:inline">Synced</span>
            <span className="font-mono text-[10px] text-emerald-700 font-bold">v1</span>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetWithConfirm}
              title="Reset to default Jaipur demo data"
              className="p-1.5 rounded text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4EFEA] border border-transparent hover:border-[#E6DFD5] text-xs flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reset Demo</span>
            </button>
            <button
              onClick={onOpenNewEventWizard}
              className="px-3 py-1.5 rounded bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-medium transition shadow-xs"
            >
              + New Event
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto no-scrollbar border-t border-[#F4EFEA]">
        <nav className="flex space-x-1 py-1.5" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#FAF0EB] text-[#A2421D] font-semibold border border-[#F3CEBE]'
                    : 'text-[#5C554E] hover:text-[#1C1917] hover:bg-[#F4EFEA]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#A2421D]' : 'text-[#78716C]'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#BE123C] text-white text-[10px] font-bold rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
