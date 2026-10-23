import React, { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { CurrencyCode, EventDetails, EventType } from '../../types';
import { formatCurrency, parseDisplayToMinor } from '../../domain/currency';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
} from 'lucide-react';

interface WizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export const NeedsAssessmentWizard: React.FC<WizardProps> = ({ onComplete, onCancel }) => {
  const { updateEvent } = useEvent();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [guestCount, setGuestCount] = useState<number>(150);
  const [budgetDisplay, setBudgetDisplay] = useState('2000000'); // ₹20,00,000
  const [currency, setCurrency] = useState<CurrencyCode>('INR');

  const [style, setStyle] = useState('Classic Elegant with Modern Elements');
  const [cateringType, setCateringType] = useState('Multi-Course Buffet & Live Counters');
  const [dietaryRequirements, setDietaryRequirements] = useState<string[]>([
    'Vegetarian Options',
    'Vegan Friendly',
  ]);
  const [newDietaryInput, setNewDietaryInput] = useState('');

  const [photographyTier, setPhotographyTier] = useState('Full Day Candid Photo + Cinematic Film');
  const [venuePreference, setVenuePreference] = useState('Heritage Courtyard / Banquet');
  const [decorationPreference, setDecorationPreference] = useState('Warm Ambient Floral & Lanterns');

  const [accessibilityNeeds, setAccessibilityNeeds] = useState<string[]>([
    'Step-free ground level access',
  ]);
  const [newAccessInput, setNewAccessInput] = useState('');

  const [planningPriorities, setPlanningPriorities] = useState<string[]>([
    'venue',
    'catering',
    'photography',
    'decor',
    'entertainment',
    'logistics',
  ]);
  const [specialConstraints, setSpecialConstraints] = useState<string>('Music cutoff at 10 PM');
  const [optionalNotes, setOptionalNotes] = useState<string>('');

  // Follow-up question trigger: if guest count > 200, ask about crowd logistics
  const [hasLargeCrowdProtocol, setHasLargeCrowdProtocol] = useState(false);

  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};
    const today = new Date().toISOString().split('T')[0];

    if (step === 1) {
      if (!eventName.trim()) errs.eventName = 'Event title is required.';
      if (!date) {
        errs.date = 'Event date is required.';
      } else if (date < today) {
        errs.date = 'Event date cannot be in the past.';
      }
      if (!location.trim()) errs.location = 'Event city/venue location is required.';
      if (guestCount <= 0 || isNaN(guestCount)) {
        errs.guestCount = 'Guest count must be at least 1.';
      }
      const budgetNum = parseDisplayToMinor(budgetDisplay);
      if (budgetNum <= 0) {
        errs.budgetDisplay = 'Total budget must be greater than zero.';
      }
    }

    if (step === 2) {
      if (!style.trim()) errs.style = 'Please select or describe an event style.';
      if (!cateringType.trim()) errs.cateringType = 'Catering style selection is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleAddDietary = () => {
    if (newDietaryInput.trim() && !dietaryRequirements.includes(newDietaryInput.trim())) {
      setDietaryRequirements([...dietaryRequirements, newDietaryInput.trim()]);
      setNewDietaryInput('');
    }
  };

  const handleRemoveDietary = (item: string) => {
    setDietaryRequirements(dietaryRequirements.filter((d) => d !== item));
  };

  const handleAddAccess = () => {
    if (newAccessInput.trim() && !accessibilityNeeds.includes(newAccessInput.trim())) {
      setAccessibilityNeeds([...accessibilityNeeds, newAccessInput.trim()]);
      setNewAccessInput('');
    }
  };

  const handleRemoveAccess = (item: string) => {
    setAccessibilityNeeds(accessibilityNeeds.filter((a) => a !== item));
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newPriorities = [...planningPriorities];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newPriorities.length) {
      const temp = newPriorities[index];
      newPriorities[index] = newPriorities[targetIndex];
      newPriorities[targetIndex] = temp;
      setPlanningPriorities(newPriorities);
    }
  };

  const handleFinalSubmit = () => {
    const totalBudgetMinor = parseDisplayToMinor(budgetDisplay);

    const newEvent: EventDetails = {
      id: `evt-${Date.now()}`,
      name: eventName,
      eventType,
      date,
      location,
      guestCount,
      totalBudget: totalBudgetMinor,
      currency,
      status: 'planning',
      preferences: {
        style,
        cateringType,
        dietaryRequirements,
        photographyTier,
        venuePreference,
        decorationPreference,
        accessibilityNeeds,
        planningPriorities,
        specialConstraints: specialConstraints ? [specialConstraints] : [],
        optionalNotes,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateEvent(newEvent);
    onComplete();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-[#E6DFD5] overflow-hidden max-w-3xl mx-auto">
      {/* Wizard Progress Stepper */}
      <div className="bg-[#FAF8F5] px-6 py-4 border-b border-[#E6DFD5]">
        <div className="flex items-center justify-between text-xs text-[#78716C] mb-2">
          <span>Step {currentStep} of 5</span>
          <span className="font-semibold text-[#1C1917]">
            {currentStep === 1 && 'Core Constraints & Budget'}
            {currentStep === 2 && 'Dining & Aesthetics'}
            {currentStep === 3 && 'Venue & Accessibility'}
            {currentStep === 4 && 'Priority Ranking'}
            {currentStep === 5 && 'Plan Review & Confirmation'}
          </span>
        </div>
        <div className="w-full bg-[#EAE4DB] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#A2421D] h-full transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Wizard Form Body */}
      <div className="p-6 sm:p-8 space-y-6">
        {/* STEP 1: Core Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1C1917] font-serif-heading">
                Define Event Foundation
              </h2>
              <p className="text-xs text-[#78716C] mt-1">
                Fields marked with <span className="text-[#BE123C] font-bold">*</span> are required to establish valid budget boundaries.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Event Title <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Diya & Kabir's Wedding"
                  className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D] ${
                    errors.eventName ? 'border-[#BE123C] bg-red-50/20' : 'border-[#D5CCC0]'
                  }`}
                />
                {errors.eventName && <p className="text-xs text-[#BE123C] mt-1">{errors.eventName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Event Type <span className="text-[#BE123C]">*</span>
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                >
                  <option value="wedding">Wedding</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="birthday">Milestone Birthday</option>
                  <option value="corporate">Corporate Event</option>
                  <option value="other">Other Celebration</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Event Date <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D] ${
                    errors.date ? 'border-[#BE123C] bg-red-50/20' : 'border-[#D5CCC0]'
                  }`}
                />
                {errors.date && <p className="text-xs text-[#BE123C] mt-1">{errors.date}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  City & Destination <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Udaipur, Rajasthan"
                  className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D] ${
                    errors.location ? 'border-[#BE123C] bg-red-50/20' : 'border-[#D5CCC0]'
                  }`}
                />
                {errors.location && <p className="text-xs text-[#BE123C] mt-1">{errors.location}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Expected Guest Count <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value, 10) || 0)}
                  className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D] ${
                    errors.guestCount ? 'border-[#BE123C] bg-red-50/20' : 'border-[#D5CCC0]'
                  }`}
                />
                {errors.guestCount && <p className="text-xs text-[#BE123C] mt-1">{errors.guestCount}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Total Budget ({currency}) <span className="text-[#BE123C]">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-24 text-xs px-2 py-2 border border-[#D5CCC0] rounded-md bg-[#FAF8F5]"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                  <input
                    type="text"
                    value={budgetDisplay}
                    onChange={(e) => setBudgetDisplay(e.target.value)}
                    placeholder="2500000"
                    className={`flex-1 text-sm px-3 py-2 border rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D] ${
                      errors.budgetDisplay ? 'border-[#BE123C] bg-red-50/20' : 'border-[#D5CCC0]'
                    }`}
                  />
                </div>
                {errors.budgetDisplay && (
                  <p className="text-xs text-[#BE123C] mt-1">{errors.budgetDisplay}</p>
                )}
              </div>
            </div>

            {/* Follow-up Question if Guest Count is Large (>200) */}
            {guestCount > 200 && (
              <div className="p-3 bg-[#FAF0EB] border border-[#F3CEBE] rounded-lg text-xs space-y-2 mt-4">
                <div className="flex items-center gap-1.5 font-semibold text-[#A2421D]">
                  <Info className="w-4 h-4" />
                  <span>Large Attendance Protocol Detected ({guestCount} Guests)</span>
                </div>
                <p className="text-[#5C554E]">
                  Events with over 200 attendees usually require dedicated parking valets and separate fire exits. Would you like VowPilot to include guest transit and municipal acoustic compliance in your task plan?
                </p>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#1C1917]">
                  <input
                    type="checkbox"
                    checked={hasLargeCrowdProtocol}
                    onChange={(e) => setHasLargeCrowdProtocol(e.target.checked)}
                    className="accent-[#A2421D]"
                  />
                  Yes, add large-capacity logistics milestones
                </label>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Style & Dining */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1C1917] font-serif-heading">
                Dining Style & Visual Atmosphere
              </h2>
              <p className="text-xs text-[#78716C] mt-1">
                Helps configure per-guest catering variables and photography requirements.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Overall Aesthetic & Style <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  type="text"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  placeholder="e.g. Traditional Royal Rajputana with Contemporary Lighting"
                  className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Catering Format <span className="text-[#BE123C]">*</span>
                </label>
                <select
                  value={cateringType}
                  onChange={(e) => setCateringType(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                >
                  <option value="Multi-Course Buffet & Live Counters">Multi-Course Buffet & Live Counters</option>
                  <option value="Plated Formal Sit-Down Service">Plated Formal Sit-Down Service</option>
                  <option value="Cocktails & Artisanal Small Plates">Cocktails & Artisanal Small Plates</option>
                  <option value="Traditional Banana Leaf / Family Feast">Traditional Banana Leaf / Family Feast</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Dietary Requirements & Kitchen Specifications (Optional)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDietaryInput}
                    onChange={(e) => setNewDietaryInput(e.target.value)}
                    placeholder="e.g. Dedicated Jain Kitchen"
                    className="flex-1 text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                  />
                  <button
                    type="button"
                    onClick={handleAddDietary}
                    className="px-3 py-2 text-xs font-medium bg-[#F4EFEA] hover:bg-[#EAE4DB] text-[#1C1917] rounded-md border border-[#D5CCC0]"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dietaryRequirements.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#FAF0EB] text-[#A2421D] border border-[#F3CEBE]"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => handleRemoveDietary(d)}
                        className="hover:text-black"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Photography & Documentation Preference
                </label>
                <select
                  value={photographyTier}
                  onChange={(e) => setPhotographyTier(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                >
                  <option value="Full Day Candid Photo + Cinematic Film">Full Day Candid Photo + Cinematic Film</option>
                  <option value="Traditional Photography Only">Traditional Photography Only</option>
                  <option value="Fine Art Editorial with Drone Footage">Fine Art Editorial with Drone Footage</option>
                  <option value="Photo Highlights & Same-Day Reel Edit">Photo Highlights & Same-Day Reel Edit</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Venue & Accessibility */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1C1917] font-serif-heading">
                Venue, Decor & Accessibility Constraints
              </h2>
              <p className="text-xs text-[#78716C] mt-1">
                Ensures all physical guest limitations and curfew restrictions are tracked.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Venue Setting Preference
                </label>
                <input
                  type="text"
                  value={venuePreference}
                  onChange={(e) => setVenuePreference(e.target.value)}
                  placeholder="e.g. Open-Air Lawn with Heritage Courtyard Backup"
                  className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Decoration & Floral Direction
                </label>
                <input
                  type="text"
                  value={decorationPreference}
                  onChange={(e) => setDecorationPreference(e.target.value)}
                  placeholder="e.g. Marigolds, Warm Fairy Lights, Fabric Drapes"
                  className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Accessibility & Inclusivity Needs
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newAccessInput}
                    onChange={(e) => setNewAccessInput(e.target.value)}
                    placeholder="e.g. Wheelchair Ramp at Dining Entry"
                    className="flex-1 text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                  />
                  <button
                    type="button"
                    onClick={handleAddAccess}
                    className="px-3 py-2 text-xs font-medium bg-[#F4EFEA] hover:bg-[#EAE4DB] text-[#1C1917] rounded-md border border-[#D5CCC0]"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {accessibilityNeeds.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#F4EFEA] text-[#1C1917] border border-[#D5CCC0]"
                    >
                      {a}
                      <button
                        type="button"
                        onClick={() => handleRemoveAccess(a)}
                        className="hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Special Constraints or Curfews (Optional)
                </label>
                <input
                  type="text"
                  value={specialConstraints}
                  onChange={(e) => setSpecialConstraints(e.target.value)}
                  placeholder="e.g. Strict outdoor sound cessation at 10:00 PM"
                  className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Priority Ranking */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1C1917] font-serif-heading">
                Rank Planning Priorities
              </h2>
              <p className="text-xs text-[#78716C] mt-1">
                VowPilot will protect high-ranking categories when resolving budget overruns or recommending trade-offs. (1 = Highest Priority).
              </p>
            </div>

            <div className="space-y-2">
              {planningPriorities.map((catKey, index) => {
                const labelMap: Record<string, string> = {
                  venue: 'Venue & Facilities',
                  catering: 'Catering & Beverages',
                  photography: 'Photography & Cinema',
                  decor: 'Decor & Production',
                  entertainment: 'Music & Entertainment',
                  logistics: 'Guest Logistics & Transport',
                };
                return (
                  <div
                    key={catKey}
                    className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-[#E6DFD5] rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#FAF0EB] text-[#A2421D] font-bold text-xs flex items-center justify-center border border-[#F3CEBE]">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-[#1C1917]">{labelMap[catKey] || catKey}</span>
                      {index === 0 && (
                        <span className="text-[10px] uppercase font-bold text-[#A2421D] bg-[#FAF0EB] px-2 py-0.5 rounded-full border border-[#F3CEBE]">
                          Shielded from Cuts
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => movePriority(index, 'up')}
                        className="p-1 rounded text-[#78716C] hover:text-[#1C1917] disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === planningPriorities.length - 1}
                        onClick={() => movePriority(index, 'down')}
                        className="p-1 rounded text-[#78716C] hover:text-[#1C1917] disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                Additional Notes or Specific Instructions (Optional)
              </label>
              <textarea
                rows={2}
                value={optionalNotes}
                onChange={(e) => setOptionalNotes(e.target.value)}
                placeholder="Any special personal requests or family notes..."
                className="w-full text-sm px-3 py-2 border border-[#D5CCC0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#A2421D]"
              />
            </div>
          </div>
        )}

        {/* STEP 5: Summary & Confirmation */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1C1917] font-serif-heading">
                Confirm Event Specification
              </h2>
              <p className="text-xs text-[#78716C] mt-1">
                Verify constraints before generating your deterministic event plan and task graph.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF8F5] p-5 rounded-xl border border-[#E6DFD5] text-xs">
              <div>
                <span className="text-[#78716C]">Event Name</span>
                <p className="font-semibold text-sm text-[#1C1917]">{eventName}</p>
              </div>

              <div>
                <span className="text-[#78716C]">Type & Date</span>
                <p className="font-semibold text-sm text-[#1C1917]">
                  {eventType.toUpperCase()} • {date}
                </p>
              </div>

              <div>
                <span className="text-[#78716C]">Location</span>
                <p className="font-semibold text-sm text-[#1C1917]">{location}</p>
              </div>

              <div>
                <span className="text-[#78716C]">Guest Count</span>
                <p className="font-semibold text-sm text-[#1C1917]">{guestCount} Guests</p>
              </div>

              <div>
                <span className="text-[#78716C]">Total Target Budget</span>
                <p className="font-semibold text-sm font-mono text-[#A2421D]">
                  {formatCurrency(parseDisplayToMinor(budgetDisplay), currency)}
                </p>
              </div>

              <div>
                <span className="text-[#78716C]">Top Priority Category</span>
                <p className="font-semibold text-sm text-[#047857]">
                  #{1} {planningPriorities[0].toUpperCase()}
                </p>
              </div>

              <div className="col-span-1 sm:col-span-2 border-t border-[#EAE4DB] pt-3">
                <span className="text-[#78716C]">Dining & Catering:</span>
                <p className="text-[#1C1917]">{cateringType}</p>
                {dietaryRequirements.length > 0 && (
                  <p className="text-[#78716C] mt-0.5">
                    Dietary: {dietaryRequirements.join(', ')}
                  </p>
                )}
              </div>

              {specialConstraints && (
                <div className="col-span-1 sm:col-span-2 border-t border-[#EAE4DB] pt-2">
                  <span className="text-[#78716C]">Special Constraints:</span>
                  <p className="text-[#BE123C] font-medium">{specialConstraints}</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#F4EFEA] border border-[#E6DFD5] rounded-lg text-xs text-[#5C554E] flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
              <span>
                You can adjust any of these constraints or fine-tune individual category allocations at any time in the <strong>Event & Data</strong> settings screen.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer Controls */}
      <div className="bg-[#FAF8F5] px-6 py-4 border-t border-[#E6DFD5] flex items-center justify-between">
        <div>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 rounded-md text-xs font-semibold text-[#5C554E] hover:text-[#1C1917] bg-white border border-[#D5CCC0] flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-md text-xs font-medium text-[#78716C] hover:text-[#1C1917] transition"
              >
                Cancel
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 rounded-md text-xs font-semibold bg-[#A2421D] hover:bg-[#863414] text-white flex items-center gap-1 transition shadow-xs"
            >
              Next Step
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="px-6 py-2 rounded-md text-xs font-semibold bg-[#047857] hover:bg-[#065F46] text-white flex items-center gap-1.5 transition shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              Generate Actionable Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
