import React from 'react';
import { useEvent } from '../../context/EventContext';
import { Card } from '../common/Card';
import {
  ArrowRight,
  GitBranch,
  Sliders,
  Sparkles,
  Users2,
} from 'lucide-react';

interface LandingViewProps {
  onStartNewEvent: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onStartNewEvent }) => {
  const { setActiveTab } = useEvent();

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-10 sm:space-y-14">
      {/* Editorial Hero */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FAF0EB] text-[#A2421D] text-xs font-semibold border border-[#F3CEBE] shadow-2xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Prompt Wars Virtual — Challenge 5: Celebration & Event Planner</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1C1917] font-serif-heading leading-tight">
          Plan with clarity.<br />Coordinate with confidence.
        </h1>

        <p className="text-base sm:text-lg text-[#5C554E] leading-relaxed max-w-2xl mx-auto">
          VowPilot is an intelligent event-planning coordinator. We turn complex requirements, guest headcounts, and supplier quotations into an actionable, constraint-aware plan with real-time decision simulation.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-6 py-3 rounded-lg bg-[#A2421D] hover:bg-[#863414] text-white text-sm font-semibold transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>Explore Active Demo Event</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onStartNewEvent}
            className="px-6 py-3 rounded-lg bg-white hover:bg-[#FAF8F5] text-[#1C1917] text-sm font-semibold border border-[#D5CCC0] transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            Create New Event Plan
          </button>
        </div>
        <p className="text-xs text-[#6E665E]">
          Deterministic rules • Client-side local persistence • Zero required external API keys
        </p>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card padding="lg" className="space-y-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center border border-[#F3CEBE]/80 shadow-2xs">
            <Sliders className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
            Decision Impact Simulator
          </h3>
          <p className="text-xs sm:text-sm text-[#5C554E] leading-relaxed">
            Test headcount increases, catering upgrades, and allocation shifts in a dedicated sandbox. See the exact financial and capacity consequences before committing.
          </p>
        </Card>

        <Card padding="lg" className="space-y-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center border border-[#F3CEBE]/80 shadow-2xs">
            <GitBranch className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
            Dependency-Aware Scheduling
          </h3>
          <p className="text-xs sm:text-sm text-[#5C554E] leading-relaxed">
            Tasks track explicit prerequisite chains with cycle detection. Blocked milestones cannot be prematurely completed, preventing costly downstream logistical missteps.
          </p>
        </Card>

        <Card padding="lg" className="space-y-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center border border-[#F3CEBE]/80 shadow-2xs">
            <Users2 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
            Vendor Quotation Matrix
          </h3>
          <p className="text-xs sm:text-sm text-[#5C554E] leading-relaxed">
            Compare proposals side-by-side. Automatically detect missing quote validity dates or omitted exclusions, and draft professional clarification inquiries.
          </p>
        </Card>
      </div>

      {/* Demo Event Preview Banner */}
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-2xl p-6 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xs">
        <div className="space-y-1.5 text-center md:text-left">
          <span className="text-xs font-semibold text-[#A2421D] uppercase tracking-wider">
            Ready-to-Explore Demonstration
          </span>
          <h4 className="text-lg sm:text-xl font-bold text-[#1C1917] font-serif-heading">
            Aarav & Meera's Jaipur Wedding Celebration
          </h4>
          <p className="text-xs text-[#6E665E]">
            Includes 150 guests, 7 budget categories, confirmed vendor milestones, and active dependency risks.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('dashboard')}
          className="px-5 py-2.5 rounded-lg bg-[#1C1917] hover:bg-[#33302B] text-white text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-[0.98] shadow-xs"
        >
          Open Dashboard ➔
        </button>
      </div>
    </div>
  );
};
