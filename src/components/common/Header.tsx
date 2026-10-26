import React from 'react';
import { useEvent } from '../../context/EventContext';
import { useTheme } from '../../context/ThemeContext';
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
  Sun,
  Moon,
  Mail,
  UserCheck,
  Clock,
  LayoutGrid,
  FileText,
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
  const { isDark, toggleTheme } = useTheme();

  const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
  const evaluations = evaluateTasks(state.tasks, state.event.date);
  const overdueCount = evaluations.filter((e) => e.risks.isOverdue).length;

  const confirmedGuests = state.guests
    ? state.guests.reduce((sum, g) => sum + (g.confirmedCount || 0), 0)
    : 0;

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: Compass },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    {
      id: 'guests',
      label: 'Guests & RSVP',
      icon: UserCheck,
      badge: confirmedGuests > 0 ? `${confirmedGuests} Confirmed` : undefined,
    },
    { id: 'timeline', label: 'Run Sheet', icon: Clock },
    { id: 'seating', label: 'Seating', icon: LayoutGrid },
    { id: 'brief', label: 'Planning Brief', icon: FileText },
    { id: 'budget', label: 'Budget Planner', icon: PieChart },
    { id: 'simulator', label: 'Decision Simulator', icon: Sliders },
    {
      id: 'tasks',
      label: 'Tasks & Graph',
      icon: CheckSquare,
      badge: overdueCount > 0 ? `${overdueCount} Late` : undefined,
    },
    { id: 'vendors', label: 'Vendors & Quotes', icon: Users },
    { id: 'assistant', label: 'Planner Assistant', icon: MessageSquare },
    { id: 'settings', label: 'Event & Data', icon: Settings },
  ];

  const handleResetWithConfirm = () => {
    if (
      window.confirm(
        'Reset the workspace back to the initial Jaipur Wedding demonstration dataset? Any unexported custom changes will be replaced.'
      )
    ) {
      resetToDemo();
    }
  };

  const getCollabBadge = () => {
    switch (collabState.status) {
      case 'synced':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-600 dark:bg-emerald-400',
          label: 'Live Synced',
          version: `Rev #${collabState.serverVersion}`,
          tooltip: `Live Synced with backend. Event Revision #${collabState.serverVersion}.`,
        };
      case 'syncing':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
          dot: 'bg-blue-600 dark:bg-blue-400',
          label: 'Syncing...',
          version: `Rev #${collabState.serverVersion}`,
          tooltip: 'Syncing updates with server...',
        };
      case 'connecting':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-600 dark:bg-amber-400',
          label: 'Connecting...',
          version: `v${collabState.serverVersion}`,
          tooltip: 'Connecting to server SSE stream...',
        };
      case 'conflict':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800',
          dot: 'bg-rose-600 dark:bg-rose-400',
          label: 'Conflict Detected',
          version: `Rev #${collabState.serverVersion}`,
          tooltip: 'Version mismatch detected. Open Collaborate to resolve.',
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
          dot: 'bg-red-600 dark:bg-red-400',
          label: 'Sync Offline',
          version: `v${collabState.serverVersion}`,
          tooltip: 'Backend is offline or unreachable. Saving in local storage.',
        };
      default:
        return {
          bg: 'bg-stone-50 dark:bg-[#26362C] text-stone-700 dark:text-[#C5D1C8] border-stone-200 dark:border-[#2D3F33]',
          dot: 'bg-stone-400 dark:bg-[#8FA895]',
          label: 'Local Mode',
          version: 'Storage v1',
          tooltip: 'Operating in local browser storage (Schema v1). Click to connect to cloud or collaborate.',
        };
    }
  };

  const collabBadge = getCollabBadge();

  return (
    <header className="border-b border-[#E6DFD5] dark:border-[#2D3F33] bg-[#FFFFFF] dark:bg-[#1F2D24] sticky top-0 z-30 shadow-xs transition-colors duration-200">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center space-x-2.5">
          <VowPilotLogo
            variant="compact"
            size="md"
            theme={isDark ? 'dark' : 'default'}
            onClick={() => setActiveTab('dashboard')}
            className="cursor-pointer"
          />
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] font-semibold border border-[#E8C8BD] dark:border-[#4D332B] tracking-tight">
            V2 Studio
          </span>
        </div>

        {/* Event Quick Info */}
        <div className="flex items-center space-x-3 sm:space-x-5 text-sm">
          <div className="hidden md:flex flex-col text-right">
            <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5] truncate max-w-[240px]">
              {state.event.name}
            </span>
            <span className="text-xs text-[#78716C] dark:text-[#8FA895] flex items-center justify-end gap-1">
              <Calendar className="w-3 h-3" />
              {state.event.date} • {state.event.guestCount} Guests
            </span>
          </div>

          <div className="h-8 w-px bg-[#E6DFD5] dark:bg-[#2D3F33] hidden md:block" />

          {/* Budget Health Pill */}
          <div className="flex flex-col text-right">
            <span className="text-xs text-[#5C554E] dark:text-[#C5D1C8]">
              {overview.isOverrun ? 'Deficit Overrun' : 'Remaining Runway'}
            </span>
            <span
              className={`font-mono text-sm font-semibold ${
                overview.isOverrun
                  ? 'text-[#BE123C] dark:text-[#FB7185]'
                  : 'text-[#047857] dark:text-[#34D399]'
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
              <span className="ml-1 uppercase text-[9px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-extrabold tracking-wider">
                {userRole}
              </span>
            )}
          </button>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-1.5">
            {/* Forest Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              data-testid="theme-toggle-btn"
              aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Forest-Green Dark Mode'}
              title={isDark ? 'Switch to Warm Cream Light Theme' : 'Switch to Forest-Green Dark Mode'}
              className="p-1.5 rounded-md text-[#5C554E] dark:text-[#C5D1C8] hover:text-[#B85C3A] dark:hover:text-[#FAF8F5] hover:bg-[#FAF0EB] dark:hover:bg-[#26362C] border border-[#E6DFD5] dark:border-[#2D3F33] transition cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#E8D7C4]" /> : <Moon className="w-4 h-4 text-[#1F2D24]" />}
            </button>

            <button
              onClick={() => setCollabModalOpen(true)}
              data-testid="open-collab-btn"
              title="Invite collaborators or view active members"
              aria-label={`Collaborate${collabState.members.length > 0 ? ` (${collabState.members.length})` : ''}`}
              className="px-2.5 py-1.5 rounded bg-[#FAF0EB] dark:bg-[#2B211E] hover:bg-[#E8C8BD] dark:hover:bg-[#4D332B] text-[#B85C3A] dark:text-[#E8D7C4] border border-[#E8C8BD] dark:border-[#4D332B] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
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
              <div className="flex items-center gap-1 pl-1 border-l border-[#E6DFD5] dark:border-[#2D3F33]">
                <button
                  onClick={() => setCollabModalOpen(true)}
                  title={`Signed in as ${currentUser.name}. Click to view collaboration settings.`}
                  className="px-2 py-1 rounded bg-[#FAF8F5] dark:bg-[#26362C] border border-[#E6DFD5] dark:border-[#2D3F33] text-[#1C1917] dark:text-[#FAF8F5] text-xs font-medium flex items-center gap-1.5 hover:bg-[#F4EFEA] dark:hover:bg-[#2E4034] transition cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="max-w-[100px] truncate">{currentUser.name}</span>
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm('Sign out of your VowPilot account? Local event data will be preserved.')
                    ) {
                      logoutUser();
                    }
                  }}
                  data-testid="header-sign-out-btn"
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-1.5 rounded text-[#78716C] dark:text-[#8FA895] hover:text-[#BE123C] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                data-testid="header-sign-in-btn"
                title="Sign in or create an account"
                className="px-2.5 py-1.5 rounded bg-[#FAF8F5] dark:bg-[#26362C] hover:bg-[#F4EFEA] dark:hover:bg-[#2E4034] text-[#1C1917] dark:text-[#FAF8F5] border border-[#D6CFC7] dark:border-[#2D3F33] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#C66B49]" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            <button
              onClick={handleResetWithConfirm}
              aria-label="Reset Demo to Jaipur data"
              title="Reset to default Jaipur demo data"
              className="p-1.5 rounded text-[#5C554E] dark:text-[#8FA895] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#F4EFEA] dark:hover:bg-[#26362C] border border-transparent hover:border-[#E6DFD5] dark:hover:border-[#2D3F33] text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reset Demo</span>
            </button>

            <button
              onClick={onOpenNewEventWizard}
              className="px-3 py-1.5 rounded bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-medium transition shadow-xs cursor-pointer"
            >
              + New Event
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto no-scrollbar border-t border-[#F4EFEA] dark:border-[#26362C]">
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
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] font-semibold border border-[#E8C8BD] dark:border-[#4D332B]'
                    : 'text-[#5C554E] dark:text-[#C5D1C8] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#F4EFEA] dark:hover:bg-[#26362C]'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive
                      ? 'text-[#B85C3A] dark:text-[#E8D7C4]'
                      : 'text-[#78716C] dark:text-[#8FA895]'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    aria-label={`${tab.badge}`}
                    className={`ml-1 px-1.5 py-0.2 text-[9px] font-bold rounded-full ${
                      tab.id === 'tasks'
                        ? 'bg-[#BE123C] text-white'
                        : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                    }`}
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
