import { describe, it, expect } from 'vitest';
import { RUN_SHEET_PRESETS } from '../components/timeline/timelineTemplates';
import { handleApplyTimelinePreset, detectTimelineConflicts } from '../context/slices/timelineSlice';
import { handleApplySeatingDraft } from '../context/slices/seatingSlice';
import { DEMO_STATE } from '../persistence/demoData';
import { AppState, GuestRecord, SeatingTable, TimelineItem } from '../types';

describe('VowPilot V2.1 — Run Sheet Starter Templates & Seating Draft Generation', () => {
  describe('1. Run Sheet Presets & Preset Application Strategies', () => {
    it('provides 5 distinct starter presets covering wedding, birthday, corporate, cultural, and general events', () => {
      expect(RUN_SHEET_PRESETS.length).toBe(5);

      const weddingPreset = RUN_SHEET_PRESETS.find((p) => p.id === 'wedding-classic');
      const birthdayPreset = RUN_SHEET_PRESETS.find((p) => p.id === 'birthday-anniversary');
      const corporatePreset = RUN_SHEET_PRESETS.find((p) => p.id === 'corporate-conference');
      const culturalPreset = RUN_SHEET_PRESETS.find((p) => p.id === 'cultural-celebration');
      const generalPreset = RUN_SHEET_PRESETS.find((p) => p.id === 'general-celebration');

      expect(weddingPreset).toBeDefined();
      expect(birthdayPreset).toBeDefined();
      expect(corporatePreset).toBeDefined();
      expect(culturalPreset).toBeDefined();
      expect(generalPreset).toBeDefined();

      // Wedding template should feature ceremony, vows, banquet, and reception milestones
      expect(weddingPreset!.items.length).toBeGreaterThanOrEqual(7);
      expect(weddingPreset!.items.some((i) => i.activity.includes('Ceremony'))).toBe(true);

      // Corporate template should feature registration, keynote, breakout sessions, and networking
      expect(corporatePreset!.items.some((i) => i.activity.includes('Keynote'))).toBe(true);
      expect(corporatePreset!.items.some((i) => i.activity.includes('Breakout'))).toBe(true);
    });

    it('safely appends template items to an existing run sheet without wiping user data', () => {
      let state: AppState = {
        ...DEMO_STATE,
        timeline: [
          {
            id: 'custom_1',
            eventId: 'event_jaipur',
            time: '10:00',
            endTime: '11:00',
            activity: 'Planner Site Inspection & Sound Check',
            durationMinutes: 60,
            orderIndex: 0,
          },
        ],
      };

      const preset = RUN_SHEET_PRESETS[0];
      const newItems: TimelineItem[] = preset.items.map((item, index) => ({
        ...item,
        id: `starter_${index}`,
        eventId: state.event.id,
        orderIndex: (state.timeline?.length || 0) + index,
      }));

      // Apply with 'append' strategy
      state = handleApplyTimelinePreset(state, newItems, 'append');

      // Original activity must still exist at the top!
      expect(state.timeline).toBeDefined();
      expect(state.timeline!.some((i) => i.id === 'custom_1')).toBe(true);
      expect(state.timeline!.length).toBe(1 + preset.items.length);
      expect(state.timeline![0].activity).toBe('Planner Site Inspection & Sound Check');
    });

    it('replaces the schedule only when explicitly commanded by the replace strategy', () => {
      let state: AppState = {
        ...DEMO_STATE,
        timeline: [
          {
            id: 'old_item_1',
            eventId: 'event_jaipur',
            time: '08:00',
            endTime: '09:00',
            activity: 'Outdated Schedule Item',
            durationMinutes: 60,
            orderIndex: 0,
          },
        ],
      };

      const preset = RUN_SHEET_PRESETS[1]; // Birthday
      const newItems: TimelineItem[] = preset.items.map((item, index) => ({
        ...item,
        id: `starter_bday_${index}`,
        eventId: state.event.id,
        orderIndex: index,
      }));

      state = handleApplyTimelinePreset(state, newItems, 'replace');

      expect(state.timeline).toBeDefined();
      expect(state.timeline!.some((i) => i.id === 'old_item_1')).toBe(false);
      expect(state.timeline!.length).toBe(preset.items.length);
      expect(state.timeline![0].activity).toBe(preset.items[0].activity);
    });

    it('validates conflict detection on sequenced starter presets', () => {
      const preset = RUN_SHEET_PRESETS[0];
      const items: TimelineItem[] = preset.items.map((item, index) => ({
        ...item,
        id: `item_${index}`,
        eventId: 'event_jaipur',
        orderIndex: index,
      }));

      // Cleanly sequenced presets should produce 0 conflicts
      const conflicts = detectTimelineConflicts(items);
      expect(conflicts.length).toBe(0);
    });
  });

  describe('2. Intelligent Seating Draft Generation', () => {
    it('distributes confirmed guests across newly generated draft tables respecting capacities', () => {
      // 18 confirmed guests in 3 households
      const testGuests: GuestRecord[] = [
        { id: 'g1', eventId: 'event_1', name: 'Aarav Sharma', partySize: 2, householdGroup: 'Sharma Family', rsvpStatus: 'accepted', confirmedCount: 2, invitationToken: 't1', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g2', eventId: 'event_1', name: 'Meera Sharma', partySize: 2, householdGroup: 'Sharma Family', rsvpStatus: 'accepted', confirmedCount: 2, invitationToken: 't2', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g3', eventId: 'event_1', name: 'Sunil Sharma', partySize: 2, householdGroup: 'Sharma Family', rsvpStatus: 'accepted', confirmedCount: 2, invitationToken: 't3', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g4', eventId: 'event_1', name: 'Rohan Verma', partySize: 3, householdGroup: 'Verma Family', rsvpStatus: 'accepted', confirmedCount: 3, invitationToken: 't4', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g5', eventId: 'event_1', name: 'Anita Verma', partySize: 3, householdGroup: 'Verma Family', rsvpStatus: 'accepted', confirmedCount: 3, invitationToken: 't5', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g6', eventId: 'event_1', name: 'Deepak Patel', partySize: 2, householdGroup: 'Patel Family', rsvpStatus: 'accepted', confirmedCount: 2, invitationToken: 't6', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g7', eventId: 'event_1', name: 'Kavita Patel', partySize: 2, householdGroup: 'Patel Family', rsvpStatus: 'accepted', confirmedCount: 2, invitationToken: 't7', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g8', eventId: 'event_1', name: 'Solo Guest 1', partySize: 1, rsvpStatus: 'accepted', confirmedCount: 1, invitationToken: 't8', updatedAt: '2026-10-27T00:00:00Z' },
        { id: 'g9', eventId: 'event_1', name: 'Solo Guest 2', partySize: 1, rsvpStatus: 'accepted', confirmedCount: 1, invitationToken: 't9', updatedAt: '2026-10-27T00:00:00Z' },
      ];

      let state: AppState = {
        ...DEMO_STATE,
        guests: testGuests,
        tables: [],
      };

      // Create 3 Round tables of capacity 8
      const draftTables: SeatingTable[] = [
        { id: 'tbl_1', eventId: 'event_1', name: 'Table 1', shape: 'round', capacity: 8, assignedGuestIds: ['g1', 'g2', 'g3'] },
        { id: 'tbl_2', eventId: 'event_1', name: 'Table 2', shape: 'round', capacity: 8, assignedGuestIds: ['g4', 'g5'] },
        { id: 'tbl_3', eventId: 'event_1', name: 'Table 3', shape: 'round', capacity: 8, assignedGuestIds: ['g6', 'g7', 'g8', 'g9'] },
      ];

      const updatedGuests = testGuests.map((g) => {
        if (['g1', 'g2', 'g3'].includes(g.id)) return { ...g, tableId: 'tbl_1' };
        if (['g4', 'g5'].includes(g.id)) return { ...g, tableId: 'tbl_2' };
        if (['g6', 'g7', 'g8', 'g9'].includes(g.id)) return { ...g, tableId: 'tbl_3' };
        return g;
      });

      state = handleApplySeatingDraft(state, draftTables, updatedGuests, 'Generate draft with 3 round tables');

      expect(state.tables).toBeDefined();
      const tables = state.tables!;
      const guests = state.guests!;

      expect(tables.length).toBe(3);
      expect(tables[0].assignedGuestIds.length).toBe(3);
      expect(tables[1].assignedGuestIds.length).toBe(2);
      expect(tables[2].assignedGuestIds.length).toBe(4);

      // Verify no table exceeds its capacity
      tables.forEach((t) => {
        const totalHeadcountAtTable = t.assignedGuestIds.reduce((sum, gId) => {
          const g = guests.find((guest) => guest.id === gId);
          return sum + (g?.partySize || 1);
        }, 0);
        expect(totalHeadcountAtTable).toBeLessThanOrEqual(t.capacity);
      });

      // Verify no guest is assigned more than once
      const allAssignedIds = tables.flatMap((t) => t.assignedGuestIds);
      const uniqueIds = new Set(allAssignedIds);
      expect(allAssignedIds.length).toBe(uniqueIds.size);
    });
  });
});
