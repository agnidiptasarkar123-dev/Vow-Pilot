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
    allEvents,
    switchEvent,
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
          bg: 'bg-emerald-50 dark:bg-[#1E2E24] text-emerald-800 dark:text-[#91B8A0] border-emerald-200 dark:border-[#385242]',
          dot: 'bg-emerald-600 dark:bg-[#91B8A0]',
          label: 'Cloud Synced',
          version: collabState.serverVersion ? `Rev #${collabState.serverVersion}` : '',
          tooltip: collabState.serverVersion
            ? `Cloud connected and synced (Revision #${collabState.serverVersion}).`
            : 'Cloud connected and synced.',
        };
      case 'syncing':
        return {
          bg: 'bg-blue-50 dark:bg-[#202833] text-blue-800 dark:text-[#90CDF4] border-blue-200 dark:border-[#2D4355]',
          dot: 'bg-blue-600 dark:bg-[#63B3ED]',
          label: 'Saving...',
          version: collabState.serverVersion ? `Rev #${collabState.serverVersion}` : '',
          tooltip: 'Syncing updates with server...',
        };
      case 'connecting':
        return {
          bg: 'bg-amber-50 dark:bg-[#332A20] text-amber-800 dark:text-[#E5BD76] border-amber-200 dark:border-[#55462D]',
          dot: 'bg-amber-600 dark:bg-[#E5BD76]',
          label: 'Connecting...',
          version: '',
          tooltip: 'Connecting to server SSE stream...',
        };
      case 'conflict':
        return {
          bg: 'bg-rose-50 dark:bg-[#341F24] text-rose-800 dark:text-[#E58C91] border-rose-300 dark:border-[#58333B]',
          dot: 'bg-rose-600 dark:bg-[#E58C91]',
          label: 'Conflict Detected',
          version: collabState.serverVersion ? `Rev #${collabState.serverVersion}` : '',
          tooltip: 'Version mismatch detected. Open Collaborate to resolve.',
        };
      case 'offline_queued':
        return {
          bg: 'bg-amber-50 dark:bg-[#332A20] text-amber-800 dark:text-[#E5BD76] border-amber-200 dark:border-[#55462D]',
          dot: 'bg-amber-500 dark:bg-[#E5BD76]',
          label: 'Offline Queued',
          version: '',
          tooltip: 'Network offline. Changes queued locally on this device.',
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-[#361E20] text-red-800 dark:text-[#E58C91] border-red-200 dark:border-[#5A2C30]',
          dot: 'bg-red-600 dark:bg-[#E58C91]',
          label: 'Sync Failed',
          version: '',
          tooltip: 'Backend is offline or sync failed. Changes are kept locally on this device.',
        };
      default:
        return {
          bg: 'bg-stone-100 dark:bg-[#2A2428] text-stone-700 dark:text-[#C5B9B3] border-stone-200 dark:border-[#41373D]',
          dot: 'bg-stone-400 dark:bg-[#A99C96]',
          label: 'Local · This device',
          version: '',
          tooltip: 'Data is stored locally on this device. Click to connect to cloud or collaborate.',
        };
    }
  };

  const collabBadge = getCollabBadge();

  return (
    <header className="border-b border-subtle bg-surface sticky top-0 z-30 shadow-xs transition-colors duration-200 text-primary">
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
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-subtle text-accent dark:text-[#E8D7C4] font-semibold border border-accent-subtle tracking-tight">
            V2 Studio
          </span>
        </div>

        {/* Event Quick Info */}
        <div className="flex items-center space-x-3 sm:space-x-5 text-sm">
          <div className="hidden md:flex flex-col text-right">
            {allEvents && allEvents.length > 1 ? (
              <div className="flex items-center gap-1.5 justify-end">
                <label htmlFor="header-event-switcher" className="sr-only">
                  Select Active Event
                </label>
                <select
                  id="header-event-switcher"
                  data-testid="event-switcher-select"
                  aria-label="Select Active Event"
                  value={state.event.id}
                  onChange={(e) => switchEvent(e.target.value)}
                  className="text-xs font-semibold text-primary bg-subtle border border-subtle rounded-md px-2 py-0.5 max-w-[240px] truncate cursor-pointer hover:border-accent-subtle transition"
                >
                  {allEvents.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name} ({formatCurrency(evt.totalBudget, evt.currency)})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="font-semibold text-primary truncate max-w-[240px]">
                {state.event.name}
              </span>
            )}
            <span className="text-xs text-secondary flex items-center justify-end gap-1">
              <Calendar className="w-3 h-3" />
              {state.event.date} • {state.event.guestCount} Guests
            </span>
          </div>

          <div className="h-8 w-px bg-subtle hidden md:block" />

          {/* Budget Health Pill */}
          <div className="flex flex-col text-right">
            <span className="text-xs text-secondary">
              {overview.isOverrun ? 'Deficit Overrun' : 'Remaining Runway'}
            </span>
            <span
              className={`font-mono text-sm font-semibold ${
                overview.isOverrun
                  ? 'text-[#BE123C] dark:text-[#E58C91]'
                  : 'text-[#047857] dark:text-[#91B8A0]'
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
            {collabBadge.version && (
              <span className="font-mono text-[10px] opacity-75 font-bold">{collabBadge.version}</span>
            )}
            {userRole && (
              <span className="ml-1 uppercase text-[9px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-extrabold tracking-wider">
                {userRole}
              </span>
            )}
          </button>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-1.5">
            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              data-testid="theme-toggle-btn"
              aria-label={isDark ? 'Switch to Warm Cream Light Theme' : 'Switch to Midnight Cocoa Dark Mode'}
              title={isDark ? 'Switch to Warm Cream Light Theme' : 'Switch to Midnight Cocoa Dark Mode'}
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-subtle border border-subtle transition cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#E8D7C4]" /> : <Moon className="w-4 h-4 text-[#1C1917]" />}
            </button>

            <button
              onClick={() => setCollabModalOpen(true)}
              data-testid="open-collab-btn"
              title="Invite collaborators or view active members"
              aria-label={`Collaborate${collabState.members.length > 0 ? ` (${collabState.members.length})` : ''}`}
              className="px-2.5 py-1.5 rounded bg-accent-subtle hover:bg-[#E8C8BD] dark:hover:bg-[#5C3830] text-accent dark:text-[#E8D7C4] border border-accent-subtle text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Collaborate</span>
              {collabState.members.length > 0 && (
                <span className="bg-[#964222] dark:bg-[#D48668] text-white dark:text-[#171517] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {collabState.members.length}
                </span>
              )}
            </button>

            {/* Account / Authentication Button */}
            {currentUser ? (
              <div className="flex items-center gap-1 pl-1 border-l border-subtle">
                <button
                  onClick={() => setCollabModalOpen(true)}
                  title={`Signed in as ${currentUser.name}. Click to view collaboration settings.`}
                  className="px-2 py-1 rounded bg-subtle border border-subtle text-primary text-xs font-medium flex items-center gap-1.5 hover:bg-muted transition cursor-pointer"
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
                  className="p-1.5 rounded text-secondary hover:text-[#BE123C] dark:hover:text-[#E58C91] hover:bg-rose-50 dark:hover:bg-[#341F24] transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                data-testid="header-sign-in-btn"
                title="Sign in or create an account"
                className="px-2.5 py-1.5 rounded bg-subtle hover:bg-muted text-primary border border-subtle text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668]" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            <button
              onClick={handleResetWithConfirm}
              aria-label="Reset Demo to Jaipur data"
              title="Reset to default Jaipur demo data"
              className="p-1.5 rounded text-secondary hover:text-primary hover:bg-subtle border border-transparent hover:border-subtle text-xs flex items-center gap-1 transition cursor-pointer"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto no-scrollbar border-t border-subtle">
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
                    ? 'bg-accent-subtle text-accent dark:text-[#E8D7C4] font-semibold border border-accent-subtle'
                    : 'text-secondary hover:text-primary hover:bg-subtle'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive
                      ? 'text-accent dark:text-[#E8D7C4]'
                      : 'text-secondary'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    aria-label={`${tab.badge}`}
                    className={`ml-1 px-1.5 py-0.2 text-[9px] font-bold rounded-full ${
                      tab.id === 'tasks'
                        ? 'bg-[#BE123C] text-white'
                        : 'bg-emerald-100 dark:bg-[#1E2E24] text-emerald-800 dark:text-[#91B8A0]'
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
