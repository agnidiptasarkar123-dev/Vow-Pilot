import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { VowPilotLogo } from '../components/common/VowPilotLogo';
import { BotanicalEmbroideryTemplate } from '../components/invitations/templates/BotanicalEmbroideryTemplate';
import { EmbossedBotanicalTemplate } from '../components/invitations/templates/EmbossedBotanicalTemplate';
import { ForestSageTemplate } from '../components/invitations/templates/ForestSageTemplate';
import { MinimalEditorialTemplate } from '../components/invitations/templates/MinimalEditorialTemplate';
import { CelebrationClassicTemplate } from '../components/invitations/templates/CelebrationClassicTemplate';
import { detectTimelineConflicts } from '../context/slices/timelineSlice';
import { handleAddGuest, handleUpdateGuestRsvp } from '../context/slices/guestSlice';
import { handleAddTable, handleAssignGuestToTable, handleRemoveGuestFromTable } from '../context/slices/seatingSlice';
import { DEMO_STATE } from '../persistence/demoData';
import { InvitationDesign, TimelineItem } from '../types';

describe('VowPilot V2 — Product Upgrade Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  describe('1. Botanical Logo System', () => {
    it('renders botanical monogram mark with accessible SVG attributes', () => {
      const { container } = render(<VowPilotLogo variant="mark" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
      expect(svg?.getAttribute('aria-label')).toBe('VowPilot');
      // Verifies presence of botanical stem, leaves, and serif V paths
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBeGreaterThanOrEqual(6);
    });

    it('renders horizontal lockup with wordmark and tagline', () => {
      render(<VowPilotLogo variant="horizontal" size="md" showTagline={true} />);
      expect(screen.getByText('VowPilot')).toBeDefined();
      expect(screen.getByText(/Plan with clarity/i)).toBeDefined();
    });

    it('supports light, forest-dark, monochrome, and terracotta palettes', () => {
      const { container: lightContainer } = render(<VowPilotLogo variant="mark" theme="default" />);
      const { container: darkContainer } = render(<VowPilotLogo variant="mark" theme="dark" />);
      const { container: monoContainer } = render(<VowPilotLogo variant="mark" theme="monochrome" />);

      const lightV = lightContainer.querySelector('path[fill="#B85C3A"]');
      expect(lightV).not.toBeNull();

      const darkV = darkContainer.querySelector('path[fill="#FAF8F5"]');
      expect(darkV).not.toBeNull();

      const monoV = monoContainer.querySelector('path[fill="currentColor"]');
      expect(monoV).not.toBeNull();
    });
  });

  describe('2. Forest-Green Dark Mode & Theme Persistence', () => {
    const TestThemeComponent = () => {
      const { theme, toggleTheme, isDark } = useTheme();
      return (
        <div>
          <span data-testid="current-theme">{theme}</span>
          <span data-testid="is-dark">{isDark ? 'true' : 'false'}</span>
          <button data-testid="toggle-btn" onClick={toggleTheme}>
            Toggle Theme
          </button>
        </div>
      );
    };

    it('defaults to light theme and toggles to forest-green dark mode', () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme').textContent).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Toggle to dark
      act(() => {
        fireEvent.click(screen.getByTestId('toggle-btn'));
      });

      expect(screen.getByTestId('current-theme').textContent).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('vowpilot_theme_v2')).toBe('dark');

      // Toggle back to light
      act(() => {
        fireEvent.click(screen.getByTestId('toggle-btn'));
      });

      expect(screen.getByTestId('current-theme').textContent).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('vowpilot_theme_v2')).toBe('light');
    });

    it('restores saved theme preference from localStorage on initialization', () => {
      localStorage.setItem('vowpilot_theme_v2', 'dark');

      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme').textContent).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('3. Invitation Studio Templates & Bilingual Support', () => {
    const sampleInvitation: InvitationDesign = {
      id: 'inv-test-1',
      eventId: 'evt-demo-001',
      name: 'Regal Test Wedding Card',
      templateId: 'botanical-embroidery',
      printSize: '5x7',
      palette: 'cream-terracotta',
      title: 'Aarav & Meera Wedding Celebration',
      hostNames: 'The Sharma & Sen Families',
      invitationHeading: 'request the honour of your presence',
      bodyText: 'To share in their joy as they exchange sacred vows.',
      eventDate: 'December 18, 2026',
      startTime: '5:00 PM',
      venueName: 'Jaipur Heritage Palace',
      venueAddress: 'Amer Fort Road, Jaipur, Rajasthan',
      rsvpDeadline: 'November 25, 2026',
      contactInfo: 'rsvp@vowpilot.org',
      dressCode: 'Royal Festive',
      additionalDetails: 'Dinner buffet following garland exchange.',
      isBilingual: true,
      bilingualLanguage: 'bn',
      bilingualTitle: 'শুভ পরিণয়',
      bilingualHeading: 'সবিনয় নিবেদন',
      bilingualBody: 'আমাদের স্নেহের আরভ ও মীরার শুভ পরিণয়ে আপনার উপস্থিতি ও আশীর্বাদ প্রার্থনা করছি।',
      bilingualDate: '১৮ই ডিসেম্বর ২০২৬',
      bilingualVenue: 'জয়পুর হেরিটেজ প্যালেস',
      bilingualFooter: '— পত্রদ্বারা নিমন্ত্রণজনিত ত্রুটি মার্জনীয় —',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
    };

    it('renders Botanical Embroidery template with embroidery stitches and bilingual text', () => {
      render(<BotanicalEmbroideryTemplate invitation={sampleInvitation} />);
      expect(screen.getByText('Aarav & Meera Wedding Celebration')).toBeDefined();
      expect(screen.getByText('The Sharma & Sen Families')).toBeDefined();
      expect(screen.getByText('December 18, 2026')).toBeDefined();
      // Verifies Bengali characters render correctly
      expect(screen.getByText('শুভ পরিণয়')).toBeDefined();
      expect(screen.getByText(/আমাদের স্নেহের আরভ/)).toBeDefined();
    });

    it('renders Embossed Botanical template with debossed styling', () => {
      render(<EmbossedBotanicalTemplate invitation={{ ...sampleInvitation, templateId: 'embossed-botanical' }} />);
      expect(screen.getByText('Aarav & Meera Wedding Celebration')).toBeDefined();
      expect(screen.getByText('Jaipur Heritage Palace')).toBeDefined();
    });

    it('renders Forest & Sage template with deep botanical palette', () => {
      render(<ForestSageTemplate invitation={{ ...sampleInvitation, templateId: 'forest-sage' }} />);
      expect(screen.getByText('Aarav & Meera Wedding Celebration')).toBeDefined();
      expect(screen.getByText('Jaipur Heritage Palace')).toBeDefined();
    });

    it('renders Minimal Editorial template with typography-focused hierarchy', () => {
      render(<MinimalEditorialTemplate invitation={{ ...sampleInvitation, templateId: 'minimal-editorial' }} />);
      expect(screen.getByText('Aarav & Meera Wedding Celebration')).toBeDefined();
      expect(screen.getByText('When')).toBeDefined();
      expect(screen.getByText('Where')).toBeDefined();
    });

    it('renders Celebration Classic template with formal cartouche border', () => {
      render(<CelebrationClassicTemplate invitation={{ ...sampleInvitation, templateId: 'celebration-classic' }} />);
      expect(screen.getByText('Aarav & Meera Wedding Celebration')).toBeDefined();
      expect(screen.getByText('Jaipur Heritage Palace')).toBeDefined();
    });
  });

  describe('4. Timeline Conflict Detection & Run Sheet Ordering', () => {
    it('detects overlapping schedule activities and calculates conflict duration', () => {
      const schedule: TimelineItem[] = [
        {
          id: 'tml-1',
          eventId: 'evt-1',
          time: '16:00',
          durationMinutes: 60, // Ends at 17:00
          activity: 'Welcome Mocktails',
          orderIndex: 1,
        },
        {
          id: 'tml-2',
          eventId: 'evt-1',
          time: '16:45', // Starts 15 mins before tml-1 ends!
          durationMinutes: 60,
          activity: 'Baraat Procession',
          orderIndex: 2,
        },
      ];

      const conflicts = detectTimelineConflicts(schedule);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0]).toContain('overlaps with "Baraat Procession"');
      expect(conflicts[0]).toContain('by 15 minutes');
    });

    it('returns empty conflict array for cleanly sequenced schedule', () => {
      const cleanSchedule: TimelineItem[] = [
        {
          id: 'tml-1',
          eventId: 'evt-1',
          time: '16:00',
          durationMinutes: 45, // Ends at 16:45
          activity: 'Welcome Mocktails',
          orderIndex: 1,
        },
        {
          id: 'tml-2',
          eventId: 'evt-1',
          time: '17:00', // Starts 15 mins after tml-1 ends
          durationMinutes: 60,
          activity: 'Baraat Procession',
          orderIndex: 2,
        },
      ];

      const conflicts = detectTimelineConflicts(cleanSchedule);
      expect(conflicts.length).toBe(0);
    });
  });

  describe('5. Guest List & Seating Assignment Integrity', () => {
    it('generates unguessable invitation token when adding guests', () => {
      const updated = handleAddGuest(DEMO_STATE, {
        eventId: 'evt-demo-001',
        name: 'Pooja & Rohan Varma',
        partySize: 2,
        confirmedCount: 0,
        rsvpStatus: 'pending',
        householdGroup: 'College Friends',
      });

      const newGuest = updated.guests?.find((g) => g.name === 'Pooja & Rohan Varma');
      expect(newGuest).toBeDefined();
      expect(newGuest?.invitationToken).toMatch(/^vow_rsvp_[a-f0-9]{32}$/);
      expect(newGuest?.invitationToken.length).toBe(41); // 9 prefix chars + 32 hex chars (128 bits entropy)
      expect(newGuest?.partySize).toBe(2);
    });

    it('correctly updates guest RSVP response and confirmed headcounts', () => {
      const guest = DEMO_STATE.guests![0];
      const updated = handleUpdateGuestRsvp(
        DEMO_STATE,
        guest.id,
        'accepted',
        2,
        'Vegetarian preparation',
        'Wheelchair ramp'
      );

      const target = updated.guests?.find((g) => g.id === guest.id);
      expect(target?.rsvpStatus).toBe('accepted');
      expect(target?.confirmedCount).toBe(2);
      expect(target?.dietaryNotes).toBe('Vegetarian preparation');
      expect(target?.accessibilityRequirements).toBe('Wheelchair ramp');
    });

    it('assigns guests to tables and prevents duplicate table assignment', () => {
      const initial = handleAddTable(DEMO_STATE, {
        eventId: 'evt-demo-001',
        name: 'VIP High Table',
        capacity: 4,
        shape: 'round',
      });

      const tableId = initial.tables![initial.tables!.length - 1].id;
      const guestId = initial.guests![0].id;

      const seated = handleAssignGuestToTable(initial, guestId, tableId);
      const seatedTable = seated.tables?.find((t) => t.id === tableId);
      const seatedGuest = seated.guests?.find((g) => g.id === guestId);

      expect(seatedTable?.assignedGuestIds).toContain(guestId);
      expect(seatedGuest?.tableId).toBe(tableId);

      // Remove guest from table
      const unseated = handleRemoveGuestFromTable(seated, guestId);
      const cleanTable = unseated.tables?.find((t) => t.id === tableId);
      const cleanGuest = unseated.guests?.find((g) => g.id === guestId);

      expect(cleanTable?.assignedGuestIds).not.toContain(guestId);
      expect(cleanGuest?.tableId).toBeUndefined();
    });
  });
});
