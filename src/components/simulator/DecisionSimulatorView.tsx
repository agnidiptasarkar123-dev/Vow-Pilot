import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { calculateBudgetOverview, evaluateScenario } from '../../domain/budgetEngine';
import { formatCurrency } from '../../domain/currency';
import { BudgetScenario } from '../../types';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import {
  AlertCircle,
  AlertTriangle,
  Plus,
  RotateCcw,
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
  const [sandboxAllocations, setSandboxAllocations] = useState<Record<string, number>>({});

  // Re-sync sandbox whenever active event changes
  React.useEffect(() => {
    setSandboxGuestCount(state.event.guestCount);
    setSandboxAllocations({});
  }, [state.event.id]);

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
    setSandboxAllocations({});
  };

  const handleSaveAsScenario = () => {
    if (!scenarioNameInput.trim()) return;
    const finalAllocations: Record<string, number> = {};
    for (const comp of evaluation.categoryComparisons) {
      finalAllocations[comp.categoryId] = comp.scenarioAllocated;
    }
    createScenario({
      name: scenarioNameInput.trim(),
      description: scenarioDescriptionInput.trim() || 'Custom simulation scenario',
      modifiedGuestCount: sandboxGuestCount,
      categoryAllocations: finalAllocations,
      notes: `Modeled with ${sandboxGuestCount} guests against ${state.event.guestCount} baseline.`,
      isBaseline: false,
    });
    setScenarioNameInput('');
    setScenarioDescriptionInput('');
    setIsSaveModalOpen(false);
  };

  const handleLoadScenarioIntoSandbox = (scen: BudgetScenario) => {
    setSandboxGuestCount(scen.modifiedGuestCount);
    setSandboxAllocations({ ...scen.categoryAllocations });
  };

  const handleExecuteApply = () => {
    if (confirmApplyScenarioId) {
      applyScenarioToBaseline(confirmApplyScenarioId);
      setConfirmApplyScenarioId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary font-serif-heading tracking-tight">
            Decision Impact Simulator
          </h1>
          <p className="text-xs text-secondary mt-1">
            Stress-test changes in guest count and category spending without touching your confirmed plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetSandbox}
            data-testid="reset-sandbox-btn"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-secondary hover:text-primary bg-surface border border-subtle hover:bg-subtle flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-[0.98]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Baseline</span>
          </button>
          <button
            onClick={() => setIsSaveModalOpen(true)}
            data-testid="save-scenario-btn"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#B85C3A] hover:bg-[#9E4B2D] text-white flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Save as Scenario</span>
          </button>
        </div>
      </div>

      {/* Main Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Column: Interactive Controls (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guest Count Slider & Capacity Card */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-primary font-serif-heading flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#B85C3A] dark:text-[#D48668]" />
                  Simulate Guest Count ({sandboxGuestCount} Guests)
                </h3>
                <p className="text-xs text-secondary">
                  Baseline confirmed count: <strong>{state.event.guestCount}</strong> guests.
                </p>
              </div>

              <div className="text-right">
                <span
                  data-testid="simulated-guest-difference"
                  className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${
                    sandboxGuestCount > state.event.guestCount
                      ? 'bg-amber-50 dark:bg-[#332A20] text-amber-800 dark:text-[#E5BD76] border border-amber-200 dark:border-[#55462D]'
                      : sandboxGuestCount < state.event.guestCount
                      ? 'bg-blue-50 dark:bg-[#202833] text-blue-800 dark:text-[#90CDF4] border border-blue-200 dark:border-[#2D4355]'
                      : 'bg-subtle text-secondary border border-subtle'
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
              aria-valuenow={sandboxGuestCount}
              aria-valuemin={20}
              aria-valuemax={capacityLimit ? capacityLimit + 50 : 300}
              aria-valuetext={`${sandboxGuestCount} guests`}
              data-testid="guest-count-slider"
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[#B85C3A] dark:accent-[#D48668]"
            />

            {/* Capacity Warning Banner */}
            {isCapacityExceeded && (
              <div role="alert" className="p-3 bg-rose-50 dark:bg-[#341F24] border border-rose-200 dark:border-[#58333B] rounded-xl text-xs text-rose-900 dark:text-[#E58C91] flex items-start gap-2 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-[#BE123C] dark:text-[#E58C91] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Venue Overcrowding Alert:</span> Modeled count of{' '}
                  <span className="font-bold">{sandboxGuestCount} guests</span> exceeds {venueCat?.name} max capacity of{' '}
                  <span className="font-bold">{capacityLimit} guests</span>. A secondary lawn or larger ballroom would be needed.
                </div>
              </div>
            )}
          </Card>

          {/* Category Budget Adjusters */}
          <Card padding="md" className="space-y-4">
            <h3 className="text-base font-bold text-primary font-serif-heading">
              Simulate Category Reallocations
            </h3>
            <p className="text-xs text-secondary">
              Adjust caps to see how trade-offs between categories affect your bottom line.
            </p>

            <div className="space-y-4 divide-y divide-subtle">
              {state.categories.map((cat) => {
                const comp = evaluation.categoryComparisons.find((c) => c.categoryId === cat.id);
                const currentMinor = comp ? comp.scenarioAllocated : (sandboxAllocations[cat.id] ?? cat.allocatedAmount);
                const baselineMinor = cat.allocatedAmount;
                const deltaMinor = comp ? comp.delta : (currentMinor - baselineMinor);
                const maxRange = Math.max(baselineMinor * 2, 20000000);

                return (
                  <div key={cat.id} className="pt-3.5 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-sm text-primary block">
                          {cat.name}
                        </span>
                        <span className="text-[11px] text-secondary">
                          Baseline: {formatCurrency(baselineMinor, state.event.currency)}
                          {((comp?.costType === 'variable' && comp.perGuestRate > 0) || cat.perGuestCost) &&
                            ` • Scaling: ${formatCurrency(comp?.perGuestRate || cat.perGuestCost || 0, state.event.currency)}/guest`}
                          {comp?.costType === 'capacity_tier' && comp.isCapacityExceeded &&
                            ` • Capacity surcharge: +${formatCurrency(comp.capacityTierDelta || 0, state.event.currency)}`}
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          data-testid={`category-amount-${cat.id}`}
                          className="font-mono font-bold text-sm text-primary"
                        >
                          {formatCurrency(currentMinor, state.event.currency)}
                        </span>
                        {deltaMinor !== 0 && (
                          <span
                            data-testid={`category-delta-${cat.id}`}
                            className={`text-[10px] font-mono font-semibold block ${
                              deltaMinor > 0 ? 'text-[#BE123C] dark:text-[#E58C91]' : 'text-[#047857] dark:text-[#91B8A0]'
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
                      max={maxRange} // In minor units
                      step="1000000" // ₹10,000 steps
                      value={currentMinor}
                      onChange={(e) =>
                        handleAllocationChange(cat.id, parseInt(e.target.value, 10) / 100)
                      }
                      aria-label={`Simulate ${cat.name} allocation`}
                      aria-valuenow={currentMinor}
                      aria-valuemin={0}
                      aria-valuemax={maxRange}
                      aria-valuetext={formatCurrency(currentMinor, state.event.currency)}
                      data-testid={`category-slider-${cat.id}`}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[#B85C3A] dark:accent-[#D48668]"
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Real-Time Impact Evaluation Card */}
        <div className="space-y-6">
          <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-subtle shadow-xs space-y-5 sticky top-24">
            <div>
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                Simulated Impact
              </span>
              <h3 className="text-xl font-bold text-primary font-serif-heading mt-0.5">
                Variance vs Baseline
              </h3>
            </div>

            <div className="space-y-3 divide-y divide-subtle text-xs">
              <div className="flex justify-between items-center pt-2">
                <span className="text-secondary">Baseline Spend</span>
                <span data-testid="baseline-spend" className="font-mono font-semibold text-primary">
                  {formatCurrency(baselineOverview.effectiveProjectedTotal, state.event.currency)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-secondary">Simulated Total</span>
                <span data-testid="simulated-total" className="font-mono font-bold text-sm text-primary">
                  {formatCurrency(evaluation.scenarioTotal, state.event.currency)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold text-primary">Net Difference</span>
                <span
                  data-testid="net-difference"
                  className={`font-mono font-bold text-sm ${
                    evaluation.deltaFromBaseline > 0 ? 'text-[#BE123C] dark:text-[#E58C91]' : 'text-[#047857] dark:text-[#91B8A0]'
                  }`}
                >
                  {evaluation.deltaFromBaseline >= 0 ? '+' : ''}
                  {formatCurrency(evaluation.deltaFromBaseline, state.event.currency)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-secondary">Projected Remaining Runway</span>
                <span
                  data-testid="remaining-runway"
                  className={`font-mono font-bold text-sm ${
                    evaluation.remainingBudget < 0 ? 'text-[#BE123C] dark:text-[#E58C91]' : 'text-[#047857] dark:text-[#91B8A0]'
                  }`}
                >
                  {formatCurrency(evaluation.remainingBudget, state.event.currency)}
                </span>
              </div>
            </div>

            {/* Overrun Alert */}
            {evaluation.isOverrun && (
              <div className="p-3.5 bg-rose-50 dark:bg-[#341F24] border border-rose-200 dark:border-[#58333B] rounded-xl text-xs text-rose-900 dark:text-[#E58C91] space-y-1 shadow-2xs">
                <div className="font-bold flex items-center gap-1.5 text-[#BE123C] dark:text-[#E58C91]">
                  <AlertCircle className="w-4 h-4" />
                  <span>Exceeds Target Budget</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Simulated spend exceeds your ₹{(state.event.totalBudget / 100).toLocaleString()} cap by{' '}
                  <strong>{formatCurrency(evaluation.scenarioTotal - state.event.totalBudget, state.event.currency)}</strong>.
                </p>
              </div>
            )}

            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="w-full py-2.5 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Save As Named Scenario</span>
            </button>
          </div>
        </div>
      </div>

      {/* Saved Scenarios Comparison Matrix */}
      <Card padding="md" className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-primary font-serif-heading">
            Saved Scenarios Comparison ({state.scenarios.length})
          </h3>
          <p className="text-xs text-secondary">
            Compare alternatives side-by-side or commit a vetted scenario to become the official plan.
          </p>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-subtle text-secondary uppercase font-semibold border-b border-subtle">
              <tr>
                <th scope="col" className="py-3 px-4">Scenario Name</th>
                <th scope="col" className="py-3 px-4 text-center">Guest Count</th>
                <th scope="col" className="py-3 px-4 text-right">Projected Spend</th>
                <th scope="col" className="py-3 px-4 text-right">Variance vs Baseline</th>
                <th scope="col" className="py-3 px-4 text-right">Runway Status</th>
                <th scope="col" className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {state.scenarios.map((scen) => {
                const scenEval = evaluateScenario(state, scen);
                return (
                  <tr key={scen.id} className="hover:bg-subtle/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {scen.isBaseline && (
                          <Badge variant="accent" size="sm">
                            Active Plan
                          </Badge>
                        )}
                        <div>
                          <span className="font-semibold text-sm text-primary block">
                            {scen.name}
                          </span>
                          <span className="text-[11px] text-secondary">{scen.description}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-medium text-primary">
                      {scen.modifiedGuestCount}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-primary">
                      {formatCurrency(scenEval.scenarioTotal, state.event.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold">
                      <span
                        className={scenEval.deltaFromBaseline > 0 ? 'text-[#BE123C] dark:text-[#E58C91]' : 'text-[#047857] dark:text-[#91B8A0]'}
                      >
                        {scenEval.deltaFromBaseline >= 0 ? '+' : ''}
                        {formatCurrency(scenEval.deltaFromBaseline, state.event.currency)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold">
                      <span className={scenEval.isOverrun ? 'text-[#BE123C] dark:text-[#E58C91]' : 'text-[#047857] dark:text-[#91B8A0]'}>
                        {formatCurrency(scenEval.remainingBudget, state.event.currency)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleLoadScenarioIntoSandbox(scen)}
                          className="px-2.5 py-1 rounded-md bg-subtle hover:bg-muted text-primary font-medium text-[11px] border border-subtle transition cursor-pointer"
                        >
                          Load Sandbox
                        </button>

                        {!scen.isBaseline && (
                          <>
                            <button
                              onClick={() => setConfirmApplyScenarioId(scen.id)}
                              className="px-2.5 py-1 rounded-md bg-[#047857] hover:bg-[#065F46] text-white font-medium text-[11px] transition cursor-pointer"
                              title="Commit this scenario to become confirmed plan"
                              aria-label={`Apply to Plan: ${scen.name}`}
                            >
                              Apply to Plan
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete scenario "${scen.name}"?`)) {
                                  deleteScenario(scen.id);
                                }
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition cursor-pointer"
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

        {/* Mobile View Stacked Scenario Cards (< 768px) */}
        <div className="block md:hidden divide-y divide-subtle space-y-3">
          {state.scenarios.map((scen) => {
            const scenEval = evaluateScenario(state, scen);
            return (
              <div key={scen.id} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {scen.isBaseline && (
                      <Badge variant="accent" size="sm">Active</Badge>
                    )}
                    <span className="font-semibold text-sm text-primary">{scen.name}</span>
                  </div>
                  <span className="font-mono text-xs text-secondary">{scen.modifiedGuestCount} guests</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-subtle p-2.5 rounded-lg border border-subtle">
                  <div>
                    <span className="text-[10px] uppercase text-secondary block font-sans">Projected Spend</span>
                    <span className="font-bold text-primary">{formatCurrency(scenEval.scenarioTotal, state.event.currency)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-secondary block font-sans">Variance</span>
                    <span className={scenEval.deltaFromBaseline > 0 ? 'text-[#BE123C] dark:text-[#E58C91]' : 'text-[#047857] dark:text-[#91B8A0]'}>
                      {scenEval.deltaFromBaseline >= 0 ? '+' : ''}{formatCurrency(scenEval.deltaFromBaseline, state.event.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleLoadScenarioIntoSandbox(scen)}
                    className="px-3 py-1.5 rounded-md bg-subtle text-primary font-medium text-xs border border-subtle"
                  >
                    Load Sandbox
                  </button>
                  {!scen.isBaseline && (
                    <button
                      onClick={() => setConfirmApplyScenarioId(scen.id)}
                      className="px-3 py-1.5 rounded-md bg-[#047857] text-white font-medium text-xs"
                    >
                      Apply to Plan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Save Scenario Modal */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        title="Save Simulation as Scenario"
        description="Preserve this allocation and guest configuration for side-by-side review."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="save-scenario-name" className="block font-semibold text-primary mb-1">Scenario Name</label>
            <input
              id="save-scenario-name"
              type="text"
              value={scenarioNameInput}
              onChange={(e) => setScenarioNameInput(e.target.value)}
              placeholder="e.g. Scaled 180 Guests + Drone Cinema Upgrade"
              className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
            />
          </div>

          <div>
            <label htmlFor="save-scenario-desc" className="block font-semibold text-primary mb-1">Description / Rationale</label>
            <textarea
              id="save-scenario-desc"
              rows={2}
              value={scenarioDescriptionInput}
              onChange={(e) => setScenarioDescriptionInput(e.target.value)}
              placeholder="e.g. Explores expanding guest list by trimming decor contingency..."
              className="w-full text-sm px-3.5 py-2 border border-subtle rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#B85C3A] bg-surface text-primary"
            />
          </div>

          <div className="p-3.5 bg-subtle border border-subtle rounded-xl space-y-1">
            <span className="font-semibold text-primary">Snapshot Highlights:</span>
            <p className="text-secondary">
              • {sandboxGuestCount} Guests ({sandboxGuestCount - state.event.guestCount >= 0 ? '+' : ''}{sandboxGuestCount - state.event.guestCount} delta)
            </p>
            <p className="text-secondary">
              • Total Projected: {formatCurrency(evaluation.scenarioTotal, state.event.currency)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-subtle">
            <button
              onClick={() => setIsSaveModalOpen(false)}
              className="px-4 py-2 border border-subtle rounded-lg text-secondary hover:bg-subtle text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAsScenario}
              className="px-4 py-2 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer active:scale-[0.98]"
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
          <div className="p-3.5 bg-amber-50 dark:bg-[#332A20] border border-amber-200 dark:border-[#55462D] rounded-xl text-amber-900 dark:text-[#E5BD76] flex items-start gap-2.5 shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-[#E5BD76] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Consequential State Change:</span> Applying this scenario will update your confirmed guest count and category allocations. Existing contracts and signed vendor records will remain intact.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-subtle">
            <button
              onClick={() => setConfirmApplyScenarioId(null)}
              className="px-4 py-2 border border-subtle rounded-lg text-secondary hover:bg-subtle text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteApply}
              className="px-4 py-2 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer active:scale-[0.98]"
            >
              Yes, Apply to Confirmed Plan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
