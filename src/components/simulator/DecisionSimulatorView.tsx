import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { calculateBudgetOverview, evaluateScenario } from '../../domain/budgetEngine';
import { formatCurrency } from '../../domain/currency';
import { BudgetScenario } from '../../types';
import { Modal } from '../common/Modal';
import {
  AlertCircle,
  AlertTriangle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

export const DecisionSimulatorView: React.FC = () => {
  const {
    state,
    createScenario,
    applyScenarioToBaseline,
    deleteScenario,
  } = useEvent();

  const baselineOverview = calculateBudgetOverview(
    state.event.totalBudget,
    state.categories,
    state.expenses
  );

  // Active sandbox state (does not mutate state.event until explicitly committed!)
  const [sandboxGuestCount, setSandboxGuestCount] = useState<number>(state.event.guestCount);
  const [sandboxAllocations, setSandboxAllocations] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const c of state.categories) {
      map[c.id] = c.allocatedAmount;
    }
    return map;
  });

  const [scenarioNameInput, setScenarioNameInput] = useState('');
  const [scenarioDescriptionInput, setScenarioDescriptionInput] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [confirmApplyScenarioId, setConfirmApplyScenarioId] = useState<string | null>(null);

  // Calculate live sandbox impact
  const tempScenario: BudgetScenario = {
    id: 'temp-sandbox',
    name: 'Interactive Sandbox',
    description: '',
    createdAt: new Date().toISOString(),
    modifiedGuestCount: sandboxGuestCount,
    categoryAllocations: sandboxAllocations,
    notes: '',
    isBaseline: false,
  };

  const evaluation = evaluateScenario(state, tempScenario);

  // Check venue capacity constraint
  const venueCat = state.categories.find((c) => c.id === 'venue');
  const capacityLimit = venueCat?.maxCapacity;
  const isCapacityExceeded = capacityLimit ? sandboxGuestCount > capacityLimit : false;

  const handleAllocationChange = (catId: string, newMajorAmount: number) => {
    const minorVal = Math.round(newMajorAmount * 100);
    setSandboxAllocations((prev) => ({
      ...prev,
      [catId]: minorVal,
    }));
  };

  const handleResetSandbox = () => {
    setSandboxGuestCount(state.event.guestCount);
    const map: Record<string, number> = {};
    for (const c of state.categories) {
      map[c.id] = c.allocatedAmount;
    }
    setSandboxAllocations(map);
  };

  const handleSaveAsScenario = () => {
    if (!scenarioNameInput.trim()) return;
    createScenario({
      name: scenarioNameInput.trim(),
      description: scenarioDescriptionInput.trim() || 'Custom simulation scenario',
      modifiedGuestCount: sandboxGuestCount,
      categoryAllocations: sandboxAllocations,
      notes: `Modeled with ${sandboxGuestCount} guests against ${state.event.guestCount} baseline.`,
      isBaseline: false,
    });
    setScenarioNameInput('');
    setScenarioDescriptionInput('');
    setIsSaveModalOpen(false);
  };

  const handleLoadScenarioIntoSandbox = (scen: BudgetScenario) => {
    setSandboxGuestCount(scen.modifiedGuestCount);
    const map: Record<string, number> = {};
    for (const c of state.categories) {
      map[c.id] = scen.categoryAllocations[c.id] !== undefined
        ? scen.categoryAllocations[c.id]
        : c.allocatedAmount;
    }
    setSandboxAllocations(map);
  };

  const handleExecuteApply = () => {
    if (confirmApplyScenarioId) {
      applyScenarioToBaseline(confirmApplyScenarioId);
      setConfirmApplyScenarioId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-heading">
            Decision Impact Simulator
          </h1>
          <p className="text-xs text-[#78716C] mt-1">
            Stress-test changes in guest count and category spending without touching your confirmed plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetSandbox}
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-[#5C554E] hover:text-[#1C1917] bg-white border border-[#D5CCC0] flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Baseline
          </button>
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#A2421D] hover:bg-[#863414] text-white flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Save as Scenario
          </button>
        </div>
      </div>

      {/* Main Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Interactive Controls (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guest Count Slider & Capacity Card */}
          <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1C1917] font-serif-heading flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#A2421D]" />
                  Simulate Guest Count ({sandboxGuestCount} Guests)
                </h3>
                <p className="text-xs text-[#78716C]">
                  Baseline confirmed count: <strong>{state.event.guestCount}</strong> guests.
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md ${
                    sandboxGuestCount > state.event.guestCount
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : sandboxGuestCount < state.event.guestCount
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {sandboxGuestCount - state.event.guestCount >= 0 ? '+' : ''}
                  {sandboxGuestCount - state.event.guestCount} guests
                </span>
              </div>
            </div>

            <input
              type="range"
              min="20"
              max={capacityLimit ? capacityLimit + 50 : 300}
              value={sandboxGuestCount}
              onChange={(e) => setSandboxGuestCount(parseInt(e.target.value, 10))}
              aria-label="Simulate guest count"
              className="w-full h-2 bg-[#EAE4DB] rounded-lg appearance-none cursor-pointer accent-[#A2421D]"
            />

            {/* Capacity Warning Banner */}
            {isCapacityExceeded && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#BE123C] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Venue Overcrowding Alert:</span> Modeled count of{' '}
                  <span className="font-bold">{sandboxGuestCount} guests</span> exceeds {venueCat?.name} max capacity of{' '}
                  <span className="font-bold">{capacityLimit} guests</span>. A secondary lawn or larger ballroom would be needed.
                </div>
              </div>
            )}
          </div>

          {/* Category Budget Adjusters */}
          <div className="bg-white p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
              Simulate Category Reallocations
            </h3>
            <p className="text-xs text-[#78716C]">
              Adjust caps to see how trade-offs between categories affect your bottom line.
            </p>

            <div className="space-y-4 divide-y divide-[#F4EFEA]">
              {state.categories.map((cat) => {
                const currentMinor = sandboxAllocations[cat.id] ?? cat.allocatedAmount;
                const baselineMinor = cat.allocatedAmount;
                const deltaMinor = currentMinor - baselineMinor;

                return (
                  <div key={cat.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-sm text-[#1C1917] block">
                          {cat.name}
                        </span>
                        <span className="text-[11px] text-[#78716C]">
                          Baseline: {formatCurrency(baselineMinor, state.event.currency)}
                          {cat.perGuestCost && ` • Scaling: ${formatCurrency(cat.perGuestCost, state.event.currency)}/guest`}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-[#1C1917]">
                          {formatCurrency(currentMinor, state.event.currency)}
                        </span>
                        {deltaMinor !== 0 && (
                          <span
                            className={`text-[10px] font-mono font-semibold block ${
                              deltaMinor > 0 ? 'text-[#BE123C]' : 'text-[#047857]'
                            }`}
                          >
                            {deltaMinor > 0 ? '+' : ''}
                            {formatCurrency(deltaMinor, state.event.currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={Math.max(baselineMinor * 2, 20000000)} // In minor units
                      step="1000000" // ₹10,000 steps
                      value={currentMinor}
                      onChange={(e) =>
                        handleAllocationChange(cat.id, parseInt(e.target.value, 10) / 100)
                      }
                      aria-label={`Simulate ${cat.name} allocation`}
                      className="w-full h-1.5 bg-[#EAE4DB] rounded-lg appearance-none cursor-pointer accent-[#A2421D]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Impact Evaluation Card */}
        <div className="space-y-6">
          <div className="bg-[#FAF8F5] p-6 rounded-xl border border-[#E6DFD5] shadow-xs space-y-5 sticky top-24">
            <div>
              <span className="text-xs font-semibold text-[#A2421D] uppercase tracking-wider">
                Simulated Impact
              </span>
              <h3 className="text-xl font-bold text-[#1C1917] font-serif-heading mt-0.5">
                Variance vs Baseline
              </h3>
            </div>

            <div className="space-y-3 divide-y divide-[#EAE4DB] text-xs">
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#5C554E]">Baseline Spend</span>
                <span className="font-mono font-semibold text-[#1C1917]">
                  {formatCurrency(baselineOverview.effectiveProjectedTotal, state.event.currency)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#5C554E]">Simulated Total</span>
                <span className="font-mono font-bold text-sm text-[#1C1917]">
                  {formatCurrency(evaluation.scenarioTotal, state.event.currency)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold text-[#1C1917]">Net Difference</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    evaluation.deltaFromBaseline > 0 ? 'text-[#BE123C]' : 'text-[#047857]'
                  }`}
                >
                  {evaluation.deltaFromBaseline >= 0 ? '+' : ''}
                  {formatCurrency(evaluation.deltaFromBaseline, state.event.currency)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#5C554E]">Projected Remaining Runway</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    evaluation.remainingBudget < 0 ? 'text-[#BE123C]' : 'text-[#047857]'
                  }`}
                >
                  {formatCurrency(evaluation.remainingBudget, state.event.currency)}
                </span>
              </div>
            </div>

            {/* Overrun Alert */}
            {evaluation.isOverrun && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-[#BE123C]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Exceeds Target Budget</span>
                </div>
                <p className="text-[11px]">
                  Simulated spend exceeds your ₹{(state.event.totalBudget / 100).toLocaleString()} cap by{' '}
                  <strong>{formatCurrency(evaluation.scenarioTotal - state.event.totalBudget, state.event.currency)}</strong>.
                </p>
              </div>
            )}

            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="w-full py-2.5 bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold rounded-md transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              Save As Named Scenario
            </button>
          </div>
        </div>
      </div>

      {/* Saved Scenarios Comparison Matrix */}
      <div className="bg-white rounded-xl border border-[#E6DFD5] shadow-xs overflow-hidden space-y-4 p-6">
        <div>
          <h3 className="text-base font-bold text-[#1C1917] font-serif-heading">
            Saved Scenarios Comparison ({state.scenarios.length})
          </h3>
          <p className="text-xs text-[#78716C]">
            Compare alternatives side-by-side or commit a vetted scenario to become the official plan.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#78716C] uppercase font-semibold border-b border-[#E6DFD5]">
              <tr>
                <th className="py-3 px-4">Scenario Name</th>
                <th className="py-3 px-4 text-center">Guest Count</th>
                <th className="py-3 px-4 text-right">Projected Spend</th>
                <th className="py-3 px-4 text-right">Variance vs Baseline</th>
                <th className="py-3 px-4 text-right">Runway Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EFEA]">
              {state.scenarios.map((scen) => {
                const scenEval = evaluateScenario(state, scen);
                return (
                  <tr key={scen.id} className="hover:bg-[#FAF8F5]/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {scen.isBaseline && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FAF0EB] text-[#A2421D] border border-[#F3CEBE]">
                            Active Plan
                          </span>
                        )}
                        <div>
                          <span className="font-semibold text-sm text-[#1C1917] block">
                            {scen.name}
                          </span>
                          <span className="text-[11px] text-[#78716C]">{scen.description}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-medium text-[#1C1917]">
                      {scen.modifiedGuestCount}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#1C1917]">
                      {formatCurrency(scenEval.scenarioTotal, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold">
                      <span
                        className={scenEval.deltaFromBaseline > 0 ? 'text-[#BE123C]' : 'text-[#047857]'}
                      >
                        {scenEval.deltaFromBaseline >= 0 ? '+' : ''}
                        {formatCurrency(scenEval.deltaFromBaseline, state.event.currency)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold">
                      <span className={scenEval.isOverrun ? 'text-[#BE123C]' : 'text-[#047857]'}>
                        {formatCurrency(scenEval.remainingBudget, state.event.currency)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleLoadScenarioIntoSandbox(scen)}
                          className="px-2 py-1 rounded bg-[#F4EFEA] hover:bg-[#EAE4DB] text-[#1C1917] font-medium text-[11px] transition"
                        >
                          Load Sandbox
                        </button>

                        {!scen.isBaseline && (
                          <>
                            <button
                              onClick={() => setConfirmApplyScenarioId(scen.id)}
                              className="px-2 py-1 rounded bg-[#047857] hover:bg-[#065F46] text-white font-medium text-[11px] transition"
                              title="Commit this scenario to become confirmed plan"
                              aria-label={`Apply to Plan: ${scen.name}`}
                            >
                              Apply to Plan
                            </button>
                            <button
                              onClick={() => deleteScenario(scen.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                              title="Delete Scenario"
                              aria-label={`Delete scenario "${scen.name}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Scenario Modal */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        title="Save Simulation as Scenario"
        description="Preserve this allocation and guest configuration for side-by-side review."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="save-scenario-name" className="block font-semibold text-[#1C1917] mb-1">Scenario Name</label>
            <input
              id="save-scenario-name"
              type="text"
              value={scenarioNameInput}
              onChange={(e) => setScenarioNameInput(e.target.value)}
              placeholder="e.g. Scaled 180 Guests + Drone Cinema Upgrade"
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div>
            <label htmlFor="save-scenario-desc" className="block font-semibold text-[#1C1917] mb-1">Description / Rationale</label>
            <textarea
              id="save-scenario-desc"
              rows={2}
              value={scenarioDescriptionInput}
              onChange={(e) => setScenarioDescriptionInput(e.target.value)}
              placeholder="e.g. Explores expanding guest list by trimming decor contingency..."
              className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
            />
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#E6DFD5] rounded-lg space-y-1">
            <span className="font-semibold text-[#1C1917]">Snapshot Highlights:</span>
            <p className="text-[#5C554E]">
              • {sandboxGuestCount} Guests ({sandboxGuestCount - state.event.guestCount >= 0 ? '+' : ''}{sandboxGuestCount - state.event.guestCount} delta)
            </p>
            <p className="text-[#5C554E]">
              • Total Projected: {formatCurrency(evaluation.scenarioTotal, state.event.currency)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setIsSaveModalOpen(false)}
              className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAsScenario}
              className="px-4 py-2 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md shadow-xs"
            >
              Save Scenario
            </button>
          </div>
        </div>
      </Modal>

      {/* Apply Scenario Confirmation Modal */}
      <Modal
        isOpen={!!confirmApplyScenarioId}
        onClose={() => setConfirmApplyScenarioId(null)}
        title="Confirm Plan Revision"
        description="Are you sure you want to apply this scenario to your official confirmed plan?"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Consequential State Change:</span> Applying this scenario will update your confirmed guest count and category allocations. Existing contracts and signed vendor records will remain intact.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setConfirmApplyScenarioId(null)}
              className="px-4 py-2 border border-[#D5CCC0] rounded-md text-[#5C554E] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteApply}
              className="px-4 py-2 bg-[#047857] hover:bg-[#065F46] text-white font-semibold rounded-md shadow-xs"
            >
              Yes, Apply to Confirmed Plan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
