import React, { useState, useId, Suspense } from 'react';
import { useEvent } from '../../context/EventContext';
import {
  InvitationDesign,
  InvitationTemplateId,
  PrintSize,
  PaperPalette,
} from '../../types';
import {
  Printer,
  Copy,
  Plus,
  Trash2,
  Sparkles,
  Languages,
  Check,
  FileText,
} from 'lucide-react';

const BotanicalEmbroideryTemplate = React.lazy(() =>
  import('./templates/BotanicalEmbroideryTemplate').then((m) => ({ default: m.BotanicalEmbroideryTemplate }))
);
const EmbossedBotanicalTemplate = React.lazy(() =>
  import('./templates/EmbossedBotanicalTemplate').then((m) => ({ default: m.EmbossedBotanicalTemplate }))
);
const ForestSageTemplate = React.lazy(() =>
  import('./templates/ForestSageTemplate').then((m) => ({ default: m.ForestSageTemplate }))
);
const MinimalEditorialTemplate = React.lazy(() =>
  import('./templates/MinimalEditorialTemplate').then((m) => ({ default: m.MinimalEditorialTemplate }))
);
const CelebrationClassicTemplate = React.lazy(() =>
  import('./templates/CelebrationClassicTemplate').then((m) => ({ default: m.CelebrationClassicTemplate }))
);

export const InvitationStudioView: React.FC = () => {
  const {
    state,
    saveInvitation,
    deleteInvitation,
    duplicateInvitation,
    isReadOnly,
  } = useEvent();

  const invitations = state.invitations || [];

  // Active selected invitation id, defaults to first or creates one
  const [activeInvitationId, setActiveInvitationId] = useState<string>(() => {
    return invitations.length > 0 ? invitations[0].id : 'new';
  });

  // Local draft state for the active invitation
  const currentInvitation: InvitationDesign = (() => {
    const existing = invitations.find((inv) => inv.id === activeInvitationId);
    if (existing) return existing;

    // Create a sensible initial invitation from the event data
    return {
      id: `inv-${Date.now().toString(36)}`,
      eventId: state.event.id,
      name: `${state.event.name} Invitation`,
      templateId: 'botanical-embroidery',
      printSize: '5x7',
      palette: 'cream-terracotta',
      title: state.event.name,
      hostNames: 'The Host Families',
      invitationHeading: 'cordially invite you to celebrate',
      bodyText: 'We request the honor of your presence to celebrate with us.',
      eventDate: state.event.date,
      startTime: '5:00 PM',
      venueName: state.event.location,
      venueAddress: state.event.location,
      rsvpDeadline: 'Please respond 3 weeks prior',
      contactInfo: 'celebration@vowpilot.org',
      dressCode: 'Festive / Traditional',
      additionalDetails: state.event.preferences.optionalNotes || '',
      isBilingual: false,
      bilingualLanguage: 'bn',
      bilingualTitle: 'শুভ পরিণয়',
      bilingualHeading: 'সবিনয় নিবেদন',
      bilingualBody: 'আমাদের সন্তানের শুভ অনুষ্ঠানে আপনার সপরিবারে উপস্থিতি ও আশীর্বাদ একান্ত কাম্য।',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  })();

  const [draft, setDraft] = useState<InvitationDesign>(currentInvitation);
  const [isSavedNoticeVisible, setIsSavedNoticeVisible] = useState(false);

  // Form field IDs for accessibility
  const titleId = useId();
  const hostNamesId = useId();
  const headingId = useId();
  const bodyTextId = useId();
  const dateId = useId();
  const timeId = useId();
  const venueId = useId();
  const addressId = useId();
  const rsvpDeadlineId = useId();
  const contactId = useId();
  const dressCodeId = useId();
  const detailsId = useId();
  const bnTitleId = useId();
  const bnHeadingId = useId();
  const bnBodyId = useId();
  const bnDateId = useId();
  const bnVenueId = useId();
  const bnFooterId = useId();

  // If user switches active invitation from picker
  const handleSelectInvitation = (id: string) => {
    setActiveInvitationId(id);
    const target = invitations.find((inv) => inv.id === id);
    if (target) {
      setDraft(target);
    }
  };

  const handleCreateNew = () => {
    const newId = `inv-${Date.now().toString(36)}`;
    const newInv: InvitationDesign = {
      id: newId,
      eventId: state.event.id,
      name: `New Celebration Invitation ${invitations.length + 1}`,
      templateId: 'botanical-embroidery',
      printSize: '5x7',
      palette: 'cream-terracotta',
      title: state.event.name,
      hostNames: 'Together with their families',
      invitationHeading: 'request the pleasure of your company',
      bodyText: 'To celebrate joy, unity, and unforgettable memories.',
      eventDate: state.event.date,
      startTime: '6:00 PM',
      venueName: state.event.location,
      venueAddress: state.event.location,
      rsvpDeadline: 'RSVP 2 weeks in advance',
      contactInfo: 'events@vowpilot.org',
      dressCode: 'Festive Attire',
      isBilingual: false,
      bilingualLanguage: 'bn',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveInvitation(newInv);
    setActiveInvitationId(newId);
    setDraft(newInv);
  };

  const handleFieldChange = <K extends keyof InvitationDesign>(field: K, value: InvitationDesign[K]) => {
    const updated = { ...draft, [field]: value, updatedAt: new Date().toISOString() };
    setDraft(updated);
    // Auto-save debounced or direct
    saveInvitation(updated);
    setIsSavedNoticeVisible(true);
    setTimeout(() => setIsSavedNoticeVisible(false), 2000);
  };

  const handleDuplicate = () => {
    duplicateInvitation(draft.id);
  };

  const handleDelete = () => {
    if (invitations.length <= 1) {
      alert('You must keep at least one invitation design.');
      return;
    }
    if (window.confirm(`Delete invitation "${draft.name}"?`)) {
      deleteInvitation(draft.id);
      const remaining = invitations.filter((inv) => inv.id !== draft.id);
      if (remaining.length > 0) {
        setActiveInvitationId(remaining[0].id);
        setDraft(remaining[0]);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Aspect ratio styling based on print size
  const getAspectRatioClass = (size: PrintSize) => {
    switch (size) {
      case 'a5':
        return 'aspect-[148/210] max-w-[480px]'; // A5: 148 x 210 mm
      case 'a6':
        return 'aspect-[105/148] max-w-[420px]'; // A6: 105 x 148 mm
      case '5x7':
        return 'aspect-[5/7] max-w-[500px]'; // 5 x 7 inches
      case 'a4-sheet':
        return 'aspect-[210/297] max-w-[540px]'; // A4
      default:
        return 'aspect-[5/7] max-w-[500px]';
    }
  };

  const renderActiveTemplate = (inv: InvitationDesign, isPrint = false) => {
    let content: React.ReactNode;
    switch (inv.templateId) {
      case 'botanical-embroidery':
        content = <BotanicalEmbroideryTemplate invitation={inv} isPrintMode={isPrint} />;
        break;
      case 'embossed-botanical':
        content = <EmbossedBotanicalTemplate invitation={inv} isPrintMode={isPrint} />;
        break;
      case 'forest-sage':
        content = <ForestSageTemplate invitation={inv} isPrintMode={isPrint} />;
        break;
      case 'minimal-editorial':
        content = <MinimalEditorialTemplate invitation={inv} isPrintMode={isPrint} />;
        break;
      case 'celebration-classic':
        content = <CelebrationClassicTemplate invitation={inv} isPrintMode={isPrint} />;
        break;
      default:
        content = <BotanicalEmbroideryTemplate invitation={inv} isPrintMode={isPrint} />;
        break;
    }
    return (
      <Suspense fallback={<div className="p-12 text-center text-xs text-secondary">Loading stationery canvas...</div>}>
        {content}
      </Suspense>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Studio Control Bar */}
      <div className="no-print bg-surface border border-border-subtle rounded-xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: Design Selection & Management */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
              Design:
            </span>
            <select
              value={draft.id}
              onChange={(e) => handleSelectInvitation(e.target.value)}
              className="bg-subtle border border-border-strong rounded-md px-3 py-1.5 text-xs font-semibold text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A] cursor-pointer"
            >
              {invitations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCreateNew}
              disabled={isReadOnly}
              title="Create another invitation design"
              className="px-2.5 py-1.5 rounded-md bg-[#FAF0EB] dark:bg-[#2B211E] hover:bg-[#E8C8BD] dark:hover:bg-[#4D332B] text-[#B85C3A] dark:text-[#E8D7C4] text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <button
              onClick={handleDuplicate}
              disabled={isReadOnly}
              title="Duplicate this design"
              className="p-1.5 rounded-md border border-border-subtle hover:bg-[#F4EFEA] dark:hover:bg-[#26362C] text-secondary text-xs transition cursor-pointer disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isReadOnly || invitations.length <= 1}
              title="Delete this design"
              className="p-1.5 rounded-md border border-border-subtle hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-500 hover:text-rose-600 transition cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {isSavedNoticeVisible && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-fade-in">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        {/* Right: Print & PDF Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            data-testid="print-invitation-btn"
            className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invitation / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Studio Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (7 cols on lg) */}
        <div className="no-print lg:col-span-6 xl:col-span-5 space-y-6">
          {/* Card: Template & Print Specs */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
            <h3 className="font-serif-heading text-sm font-semibold text-primary mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B85C3A] dark:text-[#C66B49]" />
              Stationery Style & Paper Format
            </h3>

            {/* Template Selector */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Artistic Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'botanical-embroidery', name: 'Botanical Embroidery', desc: 'Vector running stitches & vines' },
                    { id: 'embossed-botanical', name: 'Embossed Botanical', desc: 'Pressed ivory paper & debossed crest' },
                    { id: 'forest-sage', name: 'Forest & Sage', desc: 'Deep botanical green & gold foil' },
                    { id: 'minimal-editorial', name: 'Minimal Editorial', desc: 'Generous whitespace & serif layout' },
                    { id: 'celebration-classic', name: 'Celebration Classic', desc: 'Versatile formal border & cartouche' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleFieldChange('templateId', tpl.id as InvitationTemplateId)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                        draft.templateId === tpl.id
                          ? 'border-[#B85C3A] bg-[#FAF0EB] dark:bg-[#2B211E] dark:border-[#C66B49] text-primary'
                          : 'border-border-subtle hover:bg-[#FAF8F5] dark:hover:bg-[#26362C] text-secondary'
                      }`}
                    >
                      <div className="font-semibold">{tpl.name}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical Print Size */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Print Format & Aspect Ratio
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: '5x7', label: '5 × 7 in', sub: 'Classic Card' },
                    { id: 'a5', label: 'A5', sub: '148 × 210 mm' },
                    { id: 'a6', label: 'A6', sub: '105 × 148 mm' },
                    { id: 'a4-sheet', label: 'A4 Page', sub: 'Full Sheet' },
                  ].map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => handleFieldChange('printSize', sz.id as PrintSize)}
                      className={`p-2 rounded-md border text-center text-xs transition cursor-pointer ${
                        draft.printSize === sz.id
                          ? 'border-[#B85C3A] bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] font-semibold'
                          : 'border-border-subtle text-secondary hover:bg-[#FAF8F5] dark:hover:bg-[#26362C]'
                      }`}
                    >
                      <div>{sz.label}</div>
                      <div className="text-[9px] opacity-75">{sz.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Palette */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Paper & Thread Palette
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'cream-terracotta', name: 'Cream & Terracotta', dot: '#B85C3A' },
                    { id: 'forest-gold', name: 'Forest & Gold', dot: '#1F2D24' },
                    { id: 'sage-blush', name: 'Sage & Blush', dot: '#586E58' },
                    { id: 'pearl-charcoal', name: 'Pearl & Charcoal', dot: '#33302B' },
                    { id: 'terracotta-sand', name: 'Terracotta & Sand', dot: '#9E4B2D' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleFieldChange('palette', p.id as PaperPalette)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition cursor-pointer ${
                        draft.palette === p.id
                          ? 'border-[#B85C3A] bg-[#FAF0EB] dark:bg-[#2B211E] text-[#B85C3A] dark:text-[#E8D7C4] font-semibold'
                          : 'border-border-subtle text-secondary hover:bg-[#FAF8F5] dark:hover:bg-[#26362C]'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.dot }} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card: Celebration Content Editor */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-serif-heading text-sm font-semibold text-primary flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#B85C3A] dark:text-[#C66B49]" />
              Invitation Wording & Details
            </h3>

            <div className="space-y-3">
              <div>
                <label htmlFor={titleId} className="block text-xs font-medium text-secondary mb-1">
                  Event / Celebration Title
                </label>
                <input
                  id={titleId}
                  type="text"
                  value={draft.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="e.g. The Wedding of Aarav & Meera"
                  className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs font-semibold text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div>
                <label htmlFor={hostNamesId} className="block text-xs font-medium text-secondary mb-1">
                  Host or Family Names
                </label>
                <input
                  id={hostNamesId}
                  type="text"
                  value={draft.hostNames}
                  onChange={(e) => handleFieldChange('hostNames', e.target.value)}
                  placeholder="e.g. Mr. & Mrs. Sharma and Dr. & Mrs. Sen"
                  className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div>
                <label htmlFor={headingId} className="block text-xs font-medium text-secondary mb-1">
                  Invitation Heading
                </label>
                <input
                  id={headingId}
                  type="text"
                  value={draft.invitationHeading}
                  onChange={(e) => handleFieldChange('invitationHeading', e.target.value)}
                  placeholder="e.g. cordially request the honour of your presence"
                  className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div>
                <label htmlFor={bodyTextId} className="block text-xs font-medium text-secondary mb-1">
                  Invitation Body Passage
                </label>
                <textarea
                  id={bodyTextId}
                  rows={2}
                  value={draft.bodyText}
                  onChange={(e) => handleFieldChange('bodyText', e.target.value)}
                  placeholder="Enter welcoming copy and sentimental message..."
                  className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={dateId} className="block text-xs font-medium text-secondary mb-1">
                    Event Date
                  </label>
                  <input
                    id={dateId}
                    type="text"
                    value={draft.eventDate}
                    onChange={(e) => handleFieldChange('eventDate', e.target.value)}
                    placeholder="e.g. Friday, December 18, 2026"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label htmlFor={timeId} className="block text-xs font-medium text-secondary mb-1">
                    Start Time
                  </label>
                  <input
                    id={timeId}
                    type="text"
                    value={draft.startTime}
                    onChange={(e) => handleFieldChange('startTime', e.target.value)}
                    placeholder="e.g. 4:30 PM"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={venueId} className="block text-xs font-medium text-secondary mb-1">
                    Venue Name
                  </label>
                  <input
                    id={venueId}
                    type="text"
                    value={draft.venueName}
                    onChange={(e) => handleFieldChange('venueName', e.target.value)}
                    placeholder="e.g. Jaipur Heritage Palace"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label htmlFor={addressId} className="block text-xs font-medium text-secondary mb-1">
                    Venue Address
                  </label>
                  <input
                    id={addressId}
                    type="text"
                    value={draft.venueAddress}
                    onChange={(e) => handleFieldChange('venueAddress', e.target.value)}
                    placeholder="e.g. Amer Fort Road, Jaipur, Rajasthan"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={rsvpDeadlineId} className="block text-xs font-medium text-secondary mb-1">
                    RSVP Deadline
                  </label>
                  <input
                    id={rsvpDeadlineId}
                    type="text"
                    value={draft.rsvpDeadline}
                    onChange={(e) => handleFieldChange('rsvpDeadline', e.target.value)}
                    placeholder="e.g. November 25, 2026"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label htmlFor={contactId} className="block text-xs font-medium text-secondary mb-1">
                    Contact / RSVP Info
                  </label>
                  <input
                    id={contactId}
                    type="text"
                    value={draft.contactInfo}
                    onChange={(e) => handleFieldChange('contactInfo', e.target.value)}
                    placeholder="e.g. rsvp@vowpilot.org • +91 98300 12345"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={dressCodeId} className="block text-xs font-medium text-secondary mb-1">
                    Dress Code (Optional)
                  </label>
                  <input
                    id={dressCodeId}
                    type="text"
                    value={draft.dressCode || ''}
                    onChange={(e) => handleFieldChange('dressCode', e.target.value)}
                    placeholder="e.g. Royal Festive / Black Tie"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
                <div>
                  <label htmlFor={detailsId} className="block text-xs font-medium text-secondary mb-1">
                    Additional Event Details
                  </label>
                  <input
                    id={detailsId}
                    type="text"
                    value={draft.additionalDetails || ''}
                    onChange={(e) => handleFieldChange('additionalDetails', e.target.value)}
                    placeholder="e.g. Baraat procession starts 5:15 PM"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Bilingual Section (English + Bengali) */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-[#B85C3A] dark:text-[#C66B49]" />
                <h3 className="font-serif-heading text-sm font-semibold text-primary">
                  Bilingual Invitation Section
                </h3>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isBilingual || false}
                  onChange={(e) => handleFieldChange('isBilingual', e.target.checked)}
                  className="rounded border-[#D5CCC0] text-[#B85C3A] focus:ring-[#B85C3A]"
                />
                <span className="text-xs font-medium text-secondary">
                  Enable Bengali (বাংলা)
                </span>
              </label>
            </div>

            {draft.isBilingual && (
              <div className="space-y-3 pt-2 border-t border-[#F4EFEA] dark:border-[#26362C] animate-fade-in">
                <div>
                  <label htmlFor={bnTitleId} className="block text-xs font-medium text-secondary mb-1">
                    Bengali Title (শিরোনাম)
                  </label>
                  <input
                    id={bnTitleId}
                    type="text"
                    value={draft.bilingualTitle || ''}
                    onChange={(e) => handleFieldChange('bilingualTitle', e.target.value)}
                    placeholder="শুভ পরিণয়"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>

                <div>
                  <label htmlFor={bnHeadingId} className="block text-xs font-medium text-secondary mb-1">
                    Bengali Heading (সবিনয় নিবেদন)
                  </label>
                  <input
                    id={bnHeadingId}
                    type="text"
                    value={draft.bilingualHeading || ''}
                    onChange={(e) => handleFieldChange('bilingualHeading', e.target.value)}
                    placeholder="সবিনয় নিবেদন"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>

                <div>
                  <label htmlFor={bnBodyId} className="block text-xs font-medium text-secondary mb-1">
                    Bengali Body (আমন্ত্রণ বার্তা)
                  </label>
                  <textarea
                    id={bnBodyId}
                    rows={2}
                    value={draft.bilingualBody || ''}
                    onChange={(e) => handleFieldChange('bilingualBody', e.target.value)}
                    placeholder="আমাদের স্নেহের সন্তানের শুভ পরিণয়ে আপনাদের সপরিবারে সস্নেহ উপস্থিতি প্রার্থনা করছি..."
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={bnDateId} className="block text-xs font-medium text-secondary mb-1">
                      Bengali Date (তারিখ ও লগ্ন)
                    </label>
                    <input
                      id={bnDateId}
                      type="text"
                      value={draft.bilingualDate || ''}
                      onChange={(e) => handleFieldChange('bilingualDate', e.target.value)}
                      placeholder="শুক্রবার, ৩রা পৌষ ১৪৩৩"
                      className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                    />
                  </div>
                  <div>
                    <label htmlFor={bnVenueId} className="block text-xs font-medium text-secondary mb-1">
                      Bengali Venue (স্থান)
                    </label>
                    <input
                      id={bnVenueId}
                      type="text"
                      value={draft.bilingualVenue || ''}
                      onChange={(e) => handleFieldChange('bilingualVenue', e.target.value)}
                      placeholder="জয়পুর হেরিটেজ প্যালেস"
                      className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={bnFooterId} className="block text-xs font-medium text-secondary mb-1">
                    Bengali Footer (মার্জনীয় ইত্যাদি)
                  </label>
                  <input
                    id={bnFooterId}
                    type="text"
                    value={draft.bilingualFooter || ''}
                    onChange={(e) => handleFieldChange('bilingualFooter', e.target.value)}
                    placeholder="— পত্রদ্বারা নিমন্ত্রণজনিত ত্রুটি মার্জনীয় —"
                    className="w-full bg-subtle border border-border-strong rounded-md px-3 py-2 text-xs text-primary focus:outline-hidden focus:ring-1 focus:ring-[#B85C3A]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Tactile Preview & Print Container (5/7 cols on lg) */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center w-full">
          <div className="sticky top-20 w-full flex flex-col items-center">
            {/* Live Preview Label & Specs */}
            <div className="no-print w-full max-w-[500px] mb-3 flex items-center justify-between text-xs text-tertiary">
              <span className="font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Print Preview ({draft.printSize.toUpperCase()})
              </span>
              <span>Aspect ratio calibrated</span>
            </div>

            {/* Tactile Invitation Container (Target for browser print) */}
            <div
              className={`printable-invitation-container w-full ${getAspectRatioClass(
                draft.printSize
              )} rounded-2xl overflow-hidden transition-all duration-200`}
            >
              {renderActiveTemplate(draft, false)}
            </div>

            {/* Print & Export Help Footnote */}
            <div className="no-print mt-4 text-center max-w-sm text-[11px] text-tertiary space-y-1">
              <p>
                <strong>Tip:</strong> Clicking <em>Print Invitation / PDF</em> activates clean print-specific styles. In Chrome/Safari, choose "Save as PDF" to generate high-resolution print files.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
