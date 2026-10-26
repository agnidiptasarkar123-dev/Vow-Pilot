import React from 'react';
import { useEvent } from '../../context/EventContext';
import { formatCurrency } from '../../domain/currency';
import { calculateBudgetOverview } from '../../domain/budgetEngine';
import { evaluateTasks } from '../../domain/taskEngine';
import { VowPilotLogo } from './VowPilotLogo';
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
  LogIn,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onOpenNewEventWizard: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewEventWizard }) => {
  const {
    state,
    activeTab,
    setActiveTab,
    resetToDemo,
    collabState,
    setCollabModalOpen,
    userRole,
    currentUser,
    setAuthModalOpen,
    logoutUser,
  } = useEvent();
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

  const getCollabBadge = () => {
    switch (collabState.status) {
      case 'synced':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-600',
          label: 'Live Synced',
          version: `Rev #${collabState.serverVersion}`,
          tooltip: `Live Synced with backend. Event Revision #${collabState.serverVersion}.`,
        };
      case 'syncing':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-600',
          label: 'Syncing...',
          version: `Rev #${collabState.serverVersion}`,
          tooltip: 'Syncing updates with server...',
        };
      case 'connecting':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-600',
          label: 'Connecting...',
          version: `v${collabState.serverVersion}`,
          tooltip: 'Connecting to server SSE stream...',
        };
      case 'conflict':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-300',
          dot: 'bg-rose-600',
          label: 'Conflict Detected',
          version: `Rev #${collabState.serverVersion}`,
          tooltip: 'Version mismatch detected. Open Collaborate to resolve.',
        };
      case 'error':
        return {
          bg: 'bg-red-50 text-red-800 border-red-200',
          dot: 'bg-red-600',
          label: 'Sync Offline',
          version: `v${collabState.serverVersion}`,
          tooltip: 'Backend is offline or unreachable. Saving in local storage.',
        };
      default:
        return {
          bg: 'bg-stone-50 text-stone-700 border-stone-200',
          dot: 'bg-stone-400',
          label: 'Local Mode',
          version: 'Storage v1',
          tooltip: 'Operating in local browser storage (Schema v1). Click to connect to cloud or collaborate.',
        };
    }
  };

  const collabBadge = getCollabBadge();

  return (
    <header className="border-b border-[#E6DFD5] bg-[#FFFFFF] sticky top-0 z-30 shadow-xs">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center space-x-2.5">
          <VowPilotLogo
            variant="compact"
            size="md"
            onClick={() => setActiveTab('dashboard')}
            className="cursor-pointer"
          />
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FAF0EB] text-[#B85C3A] font-semibold border border-[#E8C8BD] tracking-tight">
            Coordinator
          </span>
        </div>

        {/* Event Quick Info */}
        <div className="flex items-center space-x-4 sm:space-x-6 text-sm">
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
            <span className="text-xs text-[#5C554E]">
              {overview.isOverrun ? 'Deficit Overrun' : 'Remaining Runway'}
            </span>
            <span
              className={`font-mono text-sm font-semibold ${
                overview.isOverrun ? 'text-[#BE123C]' : 'text-[#047857]'
              }`}
            >
              {formatCurrency(overview.remainingBudget, state.event.currency)}
            </span>
          </div>

          {/* Interactive Real-time Collaboration Status Badge */}
          <button
            onClick={() => setCollabModalOpen(true)}
            data-testid="collab-status-badge"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-2xs hover:opacity-90 transition cursor-pointer ${collabBadge.bg}`}
            title={collabBadge.tooltip}
          >
            <span className="sr-only">Collaboration status: </span>
            <span className={`w-1.5 h-1.5 rounded-full ${collabBadge.dot}`} />
            <span className="hidden sm:inline">{collabBadge.label}</span>
            <span className="font-mono text-[10px] opacity-75 font-bold">{collabBadge.version}</span>
            {userRole && (
              <span className="ml-1 uppercase text-[9px] px-1.5 py-0.2 rounded bg-black/5 font-extrabold tracking-wider">
                {userRole}
              </span>
            )}
          </button>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCollabModalOpen(true)}
              data-testid="open-collab-btn"
              title="Invite collaborators or view active members"
              aria-label={`Collaborate${collabState.members.length > 0 ? ` (${collabState.members.length})` : ''}`}
              className="px-2.5 py-1.5 rounded bg-[#FAF0EB] hover:bg-[#E8C8BD] text-[#B85C3A] border border-[#E8C8BD] text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Collaborate</span>
              {collabState.members.length > 0 && (
                <span className="bg-[#B85C3A] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {collabState.members.length}
                </span>
              )}
            </button>

            {/* Account / Authentication Button */}
            {currentUser ? (
              <div className="flex items-center gap-1 pl-1 border-l border-[#E6DFD5]">
                <button
                  onClick={() => setCollabModalOpen(true)}
                  title={`Signed in as ${currentUser.name}. Click to view collaboration settings.`}
                  className="px-2 py-1 rounded bg-[#FAF8F5] border border-[#E6DFD5] text-[#1C1917] text-xs font-medium flex items-center gap-1.5 hover:bg-[#F4EFEA] transition cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="max-w-[100px] truncate">{currentUser.name}</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Sign out of your VowPilot account? Local event data will be preserved.')) {
                      logoutUser();
                    }
                  }}
                  data-testid="header-sign-out-btn"
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-1.5 rounded text-[#78716C] hover:text-[#BE123C] hover:bg-rose-50 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                data-testid="header-sign-in-btn"
                title="Sign in or create an account"
                className="px-2.5 py-1.5 rounded bg-[#FAF8F5] hover:bg-[#F4EFEA] text-[#1C1917] border border-[#D6CFC7] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#B85C3A]" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            <button
              onClick={handleResetWithConfirm}
              aria-label="Reset Demo to Jaipur data"
              title="Reset to default Jaipur demo data"
              className="p-1.5 rounded text-[#5C554E] hover:text-[#1C1917] hover:bg-[#F4EFEA] border border-transparent hover:border-[#E6DFD5] text-xs flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reset Demo</span>
            </button>

            <button
              onClick={onOpenNewEventWizard}
              className="px-3 py-1.5 rounded bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-medium transition shadow-xs"
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
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#FAF0EB] text-[#B85C3A] font-semibold border border-[#E8C8BD]'
                    : 'text-[#5C554E] hover:text-[#1C1917] hover:bg-[#F4EFEA]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#B85C3A]' : 'text-[#78716C]'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    aria-label={`${tab.badge} overdue tasks`}
                    className="ml-1 px-1.5 py-0.2 bg-[#BE123C] text-white text-[10px] font-bold rounded-full"
                  >
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
