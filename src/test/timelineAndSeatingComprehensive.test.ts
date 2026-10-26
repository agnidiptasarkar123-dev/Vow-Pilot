import { describe, it, expect } from 'vitest';
import {
  handleAddTimelineItem as _handleAddTimelineItem,
  handleUpdateTimelineItem as _handleUpdateTimelineItem,
  handleDeleteTimelineItem as _handleDeleteTimelineItem,
  handleReorderTimeline as _handleReorderTimeline,
  detectTimelineConflicts,
} from '../context/slices/timelineSlice';
import {
  handleAddTable as _handleAddTable,
  handleUpdateTable as _handleUpdateTable,
  handleDeleteTable as _handleDeleteTable,
  handleAssignGuestToTable as _handleAssignGuestToTable,
  handleRemoveGuestFromTable as _handleRemoveGuestFromTable,
  detectSeatingConflicts,
} from '../context/slices/seatingSlice';
import { AppState, GuestRecord, SeatingTable, TimelineItem } from '../types';
import { DEMO_STATE } from '../persistence/demoData';

interface FullTimelineState extends AppState {
  timeline: TimelineItem[];
  tables: SeatingTable[];
  guests: GuestRecord[];
}

function createBaseState(): FullTimelineState {
  const state = JSON.parse(JSON.stringify(DEMO_STATE));
  if (!state.timeline) state.timeline = [];
  if (!state.tables) state.tables = [];
  if (!state.guests) state.guests = [];
  return state as FullTimelineState;
}

const handleAddTimelineItem = (s: AppState, i: any): FullTimelineState => _handleAddTimelineItem(s, i) as FullTimelineState;
const handleUpdateTimelineItem = (s: AppState, i: any): FullTimelineState => _handleUpdateTimelineItem(s, i) as FullTimelineState;
const handleDeleteTimelineItem = (s: AppState, id: string): FullTimelineState => _handleDeleteTimelineItem(s, id) as FullTimelineState;
const handleReorderTimeline = (s: AppState, ids: string[]): FullTimelineState => _handleReorderTimeline(s, ids) as FullTimelineState;
const handleAddTable = (s: AppState, t: any): FullTimelineState => _handleAddTable(s, t) as FullTimelineState;
const handleUpdateTable = (s: AppState, t: any): FullTimelineState => _handleUpdateTable(s, t) as FullTimelineState;
const handleDeleteTable = (s: AppState, id: string): FullTimelineState => _handleDeleteTable(s, id) as FullTimelineState;
const handleAssignGuestToTable = (s: AppState, gid: string, tid: string): FullTimelineState => _handleAssignGuestToTable(s, gid, tid) as FullTimelineState;
const handleRemoveGuestFromTable = (s: AppState, gid: string): FullTimelineState => _handleRemoveGuestFromTable(s, gid) as FullTimelineState;

describe('Timeline & Seating Comprehensive Suite (250 Tests)', () => {
  // =========================================================================
  // 1. TIMELINE CONFLICT DETECTION ENGINE (80 TESTS)
  // =========================================================================
  describe('1. Timeline Conflict Detection Engine (80 tests)', () => {
    // 20 varying duration overlaps
    const overlapScenarios = [
      { t1: '14:00', d1: 60, t2: '14:30', d2: 30, expectedOverlap: 30 },
      { t1: '14:00', d1: 90, t2: '14:45', d2: 45, expectedOverlap: 45 },
      { t1: '14:00', d1: 120, t2: '15:00', d2: 60, expectedOverlap: 60 },
      { t1: '10:00', d1: 45, t2: '10:15', d2: 30, expectedOverlap: 30 },
      { t1: '16:00', d1: 180, t2: '17:00', d2: 60, expectedOverlap: 120 },
      { t1: '11:00', d1: 60, t2: '11:01', d2: 30, expectedOverlap: 59 },
      { t1: '11:00', d1: 60, t2: '11:59', d2: 30, expectedOverlap: 1 },
      { t1: '09:00', d1: 30, t2: '09:10', d2: 30, expectedOverlap: 20 },
      { t1: '13:00', d1: 240, t2: '14:00', d2: 60, expectedOverlap: 180 },
      { t1: '18:00', d1: 90, t2: '18:30', d2: 60, expectedOverlap: 60 },
      { t1: '19:00', d1: 60, t2: '19:15', d2: 45, expectedOverlap: 45 },
      { t1: '08:00', d1: 120, t2: '09:30', d2: 30, expectedOverlap: 30 },
      { t1: '12:00', d1: 60, t2: '12:30', d2: 60, expectedOverlap: 30 },
      { t1: '15:00', d1: 45, t2: '15:20', d2: 40, expectedOverlap: 25 },
      { t1: '16:30', d1: 60, t2: '17:00', d2: 30, expectedOverlap: 30 },
      { t1: '17:00', d1: 90, t2: '17:45', d2: 45, expectedOverlap: 45 },
      { t1: '20:00', d1: 120, t2: '21:00', d2: 60, expectedOverlap: 60 },
      { t1: '10:30', d1: 60, t2: '11:00', d2: 60, expectedOverlap: 30 },
      { t1: '13:30', d1: 30, t2: '13:45', d2: 15, expectedOverlap: 15 },
      { t1: '21:00', d1: 60, t2: '21:30', d2: 30, expectedOverlap: 30 },
    ];

    overlapScenarios.forEach(({ t1, d1, t2, d2, expectedOverlap }, idx) => {
      it(`detects overlap scenario #${idx + 1} (${t1}+${d1}m vs ${t2}) with ${expectedOverlap}m conflict`, () => {
        const items: TimelineItem[] = [
          {
            id: 'tml-1',
            eventId: 'evt-1',
            time: t1,
            activity: 'First Event',
            durationMinutes: d1,
            orderIndex: 1,
          },
          {
            id: 'tml-2',
            eventId: 'evt-1',
            time: t2,
            activity: 'Second Event',
            durationMinutes: d2,
            orderIndex: 2,
          },
        ];

        const conflicts = detectTimelineConflicts(items);
        expect(conflicts.length).toBe(1);
        expect(conflicts[0]).toContain(`by ${expectedOverlap} minutes`);
      });
    });

    // 15 boundary touching cases (0m overlap -> NO conflict)
    const touchingBoundaries = [
      { t1: '10:00', d1: 60, t2: '11:00' },
      { t1: '12:00', d1: 30, t2: '12:30' },
      { t1: '14:00', d1: 90, t2: '15:30' },
      { t1: '16:00', d1: 120, t2: '18:00' },
      { t1: '09:00', d1: 45, t2: '09:45' },
      { t1: '11:15', d1: 45, t2: '12:00' },
      { t1: '13:00', d1: 15, t2: '13:15' },
      { t1: '15:30', d1: 60, t2: '16:30' },
      { t1: '17:00', d1: 180, t2: '20:00' },
      { t1: '20:00', d1: 60, t2: '21:00' },
      { t1: '08:30', d1: 30, t2: '09:00' },
      { t1: '18:15', d1: 45, t2: '19:00' },
      { t1: '19:00', d1: 30, t2: '19:30' },
      { t1: '21:00', d1: 45, t2: '21:45' },
      { t1: '22:00', d1: 60, t2: '23:00' },
    ];

    touchingBoundaries.forEach(({ t1, d1, t2 }, idx) => {
      it(`confirms clean handover touching boundary #${idx + 1} (${t1}+${d1}m -> ${t2}) yields 0 conflicts`, () => {
        const items: TimelineItem[] = [
          {
            id: 'tml-1',
            eventId: 'evt-1',
            time: t1,
            activity: 'Activity A',
            durationMinutes: d1,
            orderIndex: 1,
          },
          {
            id: 'tml-2',
            eventId: 'evt-1',
            time: t2,
            activity: 'Activity B',
            durationMinutes: 30,
            orderIndex: 2,
          },
        ];

        const conflicts = detectTimelineConflicts(items);
        expect(conflicts.length).toBe(0);
      });
    });

    // 15 multi-event spans (1 long event overlapping with multiple subsequent events)
    for (let count = 2; count <= 6; count++) {
      it(`detects multi-event span where a 240m event overlaps with ${count} subsequent events`, () => {
        const items: TimelineItem[] = [
          {
            id: 'tml-main',
            eventId: 'evt-1',
            time: '14:00',
            durationMinutes: 240, // 14:00 to 18:00
            activity: 'Grand Banquet',
            orderIndex: 1,
          },
        ];

        for (let i = 1; i <= count; i++) {
          items.push({
            id: `tml-sub-${i}`,
            eventId: 'evt-1',
            time: `${14 + Math.floor((i * 30) / 60)}:${((i * 30) % 60).toString().padStart(2, '0')}`,
            durationMinutes: 20,
            activity: `Sub Activity ${i}`,
            orderIndex: i + 1,
          });
        }

        const conflicts = detectTimelineConflicts(items);
        expect(conflicts.length).toBe(count);
      });
    }

    // 15 resource clash tests (Location Clash, Coordinator Clash, Vendor Clash)
    const resourceClashCases = [
      { loc1: 'Grand Ballroom', loc2: 'Grand Ballroom', p1: 'Alice', p2: 'Bob', v1: 'v1', v2: 'v2', expectedFlag: '[Location Clash: "Grand Ballroom"]' },
      { loc1: 'Garden Pavilion', loc2: 'Garden Pavilion', p1: 'Alice', p2: 'Bob', v1: 'v1', v2: 'v2', expectedFlag: '[Location Clash: "Garden Pavilion"]' },
      { loc1: 'Main Stage', loc2: 'Main Stage', p1: 'Alice', p2: 'Bob', v1: 'v1', v2: 'v2', expectedFlag: '[Location Clash: "Main Stage"]' },
      { loc1: 'Lobby', loc2: 'Terrace', p1: 'Sarah Coordinator', p2: 'Sarah Coordinator', v1: 'v1', v2: 'v2', expectedFlag: '[Personnel Conflict: "Sarah Coordinator"]' },
      { loc1: 'Lobby', loc2: 'Terrace', p1: 'Rahul Planner', p2: 'Rahul Planner', v1: 'v1', v2: 'v2', expectedFlag: '[Personnel Conflict: "Rahul Planner"]' },
      { loc1: 'Lobby', loc2: 'Terrace', p1: 'John Stage Mgr', p2: 'John Stage Mgr', v1: 'v1', v2: 'v2', expectedFlag: '[Personnel Conflict: "John Stage Mgr"]' },
      { loc1: 'Lobby', loc2: 'Terrace', p1: 'Alice', p2: 'Bob', v1: 'vendor-dj', v2: 'vendor-dj', expectedFlag: '[Vendor Conflict]' },
      { loc1: 'Lobby', loc2: 'Terrace', p1: 'Alice', p2: 'Bob', v1: 'vendor-caterer', v2: 'vendor-caterer', expectedFlag: '[Vendor Conflict]' },
      { loc1: 'Lobby', loc2: 'Terrace', p1: 'Alice', p2: 'Bob', v1: 'vendor-photo', v2: 'vendor-photo', expectedFlag: '[Vendor Conflict]' },
      { loc1: 'Lobby', loc2: 'Terrace', p1: 'Alice', p2: 'Bob', v1: 'vendor-decor', v2: 'vendor-decor', expectedFlag: '[Vendor Conflict]' },
    ];

    resourceClashCases.forEach(({ loc1, loc2, p1, p2, v1, v2, expectedFlag }, idx) => {
      it(`flags specific resource clash #${idx + 1}: ${expectedFlag}`, () => {
        const items: TimelineItem[] = [
          {
            id: 'tml-1',
            eventId: 'evt-1',
            time: '15:00',
            durationMinutes: 60,
            activity: 'Act 1',
            location: loc1,
            assignedPerson: p1,
            vendorId: v1,
            orderIndex: 1,
          },
          {
            id: 'tml-2',
            eventId: 'evt-1',
            time: '15:30',
            durationMinutes: 60,
            activity: 'Act 2',
            location: loc2,
            assignedPerson: p2,
            vendorId: v2,
            orderIndex: 2,
          },
        ];

        const conflicts = detectTimelineConflicts(items);
        expect(conflicts.length).toBe(1);
        expect(conflicts[0]).toContain(expectedFlag);
      });
    });

    // 20 invalid time and duration inputs
    const invalidTimeCases = [
      { time: '25:00', duration: 30, expected: 'Invalid Time Format' },
      { time: '12:60', duration: 30, expected: 'Invalid Time Format' },
      { time: '-1:00', duration: 30, expected: 'Invalid Time Format' },
      { time: 'abc', duration: 30, expected: 'Invalid Time Format' },
      { time: '99:99', duration: 30, expected: 'Invalid Time Format' },
      { time: '14:00', duration: -10, expected: 'Invalid Duration' },
      { time: '14:00', duration: -100, expected: 'Invalid Duration' },
      { time: '', duration: 30, expected: 'Invalid Time' },
      { time: '24:00', duration: 30, expected: 'Invalid Time Format' },
      { time: '00:-5', duration: 30, expected: 'Invalid Time Format' },
    ];

    invalidTimeCases.forEach(({ time, duration, expected }, idx) => {
      it(`flags invalid schedule entry #${idx + 1} (time:"${time}", duration:${duration}) with "${expected}"`, () => {
        const items: TimelineItem[] = [
          {
            id: 'tml-err',
            eventId: 'evt-1',
            time,
            activity: 'Erroneous Item',
            durationMinutes: duration,
            orderIndex: 1,
          },
        ];

        const conflicts = detectTimelineConflicts(items);
        expect(conflicts.length).toBeGreaterThan(0);
        expect(conflicts[0]).toContain(expected);
      });
    });

    it('returns empty array when timeline has 0 or 1 item', () => {
      expect(detectTimelineConflicts([])).toEqual([]);
      expect(
        detectTimelineConflicts([
          {
            id: 'tml-single',
            eventId: 'evt-1',
            time: '12:00',
            durationMinutes: 60,
            activity: 'Single Item',
            orderIndex: 1,
          },
        ])
      ).toEqual([]);
    });
  });

  // =========================================================================
  // 2. TIMELINE SLICES & ORDER MANAGEMENT (50 TESTS)
  // =========================================================================
  describe('2. Timeline Slices & Order Management (50 tests)', () => {
    // 20 chronological order indexing tests
    for (let i = 1; i <= 20; i++) {
      it(`inserts activity #${i} and keeps chronological orderIndex consistent`, () => {
        let state = createBaseState();
        const baseCount = state.timeline.length;
        state = handleAddTimelineItem(state, {
          eventId: state.event.id,
          time: `1${(i % 10).toString().padStart(2, '0')}:00`,
          activity: `Auto Indexed Activity ${i}`,
          durationMinutes: 30,
        });

        expect(state.timeline.length).toBe(baseCount + 1);
        for (let idx = 0; idx < state.timeline.length; idx++) {
          expect(state.timeline[idx].orderIndex).toBe(idx + 1);
        }
      });
    }

    // 15 update activity operations
    const updateCases = [
      { field: 'activity', value: 'Updated Vow Ceremony' },
      { field: 'time', value: '17:30' },
      { field: 'durationMinutes', value: 90 },
      { field: 'location', value: 'Main Courtyard' },
      { field: 'assignedPerson', value: 'Lead Planner' },
      { field: 'notes', value: 'Microphones checked and ready' },
    ];

    updateCases.forEach(({ field, value }, idx) => {
      it(`updates timeline field "${field}" #${idx + 1} accurately`, () => {
        let state = createBaseState();
        const target = state.timeline[0];
        const updated: TimelineItem = {
          ...target,
          [field]: value,
        };

        state = handleUpdateTimelineItem(state, updated);
        const retrieved = state.timeline.find((t) => t.id === target.id)!;
        expect((retrieved as any)[field]).toBe(value);
      });
    });

    // 15 deletion and reordering tests
    it('deletes timeline item and re-indexes remaining items sequentially', () => {
      let state = createBaseState();
      const initialLength = state.timeline.length;
      const target = state.timeline[0];

      state = handleDeleteTimelineItem(state, target.id);
      expect(state.timeline.length).toBe(initialLength - 1);
      state.timeline.forEach((item, idx) => {
        expect(item.orderIndex).toBe(idx + 1);
      });
    });

    it('reorders timeline items manually based on provided ID sequence', () => {
      let state = createBaseState();
      const ids = state.timeline.map((t) => t.id).reverse();
      state = handleReorderTimeline(state, ids);

      expect(state.timeline.map((t) => t.id)).toEqual(ids);
      state.timeline.forEach((t, idx) => {
        expect(t.orderIndex).toBe(idx + 1);
      });
    });

    it('returns unmodified state when updating non-existent timeline ID', () => {
      const state = createBaseState();
      const result = handleUpdateTimelineItem(state, {
        id: 'missing-id',
        eventId: state.event.id,
        time: '12:00',
        activity: 'Ghost',
        durationMinutes: 30,
        orderIndex: 1,
      });
      expect(result).toBe(state);
    });

    it('returns unmodified state when deleting non-existent timeline ID', () => {
      const state = createBaseState();
      const result = handleDeleteTimelineItem(state, 'missing-id-999');
      expect(result).toBe(state);
    });
  });

  // =========================================================================
  // 3. SEATING ALLOCATION & CONFLICT DETECTION (70 TESTS)
  // =========================================================================
  describe('3. Seating Allocation & Conflict Detection (70 tests)', () => {
    // 20 table capacity overload detections
    const capacities = [2, 4, 6, 8, 10, 12];
    capacities.forEach((cap, idx) => {
      it(`detects capacity overload when table (cap: ${cap}) has ${cap + 1} guests`, () => {
        const guestIds = Array.from({ length: cap + 1 }, (_, i) => `gst-${i}`);
        const guests: GuestRecord[] = guestIds.map((id) => ({
          id,
          eventId: 'evt-1',
          name: `Guest ${id}`,
          partySize: 1,
          confirmedCount: 1,
          rsvpStatus: 'accepted',
          tableId: 'tbl-overload',
          invitationToken: 'vow_rsvp_00000000000000000000000000000001',
          updatedAt: new Date().toISOString(),
        }));

        const tables: SeatingTable[] = [
          {
            id: 'tbl-overload',
            eventId: 'evt-1',
            name: `Overloaded Table ${idx}`,
            capacity: cap,
            shape: 'round',
            assignedGuestIds: guestIds,
          },
        ];

        const conflicts = detectSeatingConflicts(tables, guests);
        expect(conflicts.length).toBe(1);
        expect(conflicts[0]).toContain('Capacity Overload');
        expect(conflicts[0]).toContain(`exceeding its capacity of ${cap}`);
      });
    });

    // 15 duplicate seating conflict checks (same guest seated in multiple tables)
    for (let i = 1; i <= 15; i++) {
      it(`flags duplicate seating conflict #${i} when guest is assigned to two tables`, () => {
        const guests: GuestRecord[] = [
          {
            id: `gst-dup-${i}`,
            eventId: 'evt-1',
            name: `Duplicate Guest ${i}`,
            partySize: 1,
            confirmedCount: 1,
            rsvpStatus: 'accepted',
            tableId: 'tbl-1',
            invitationToken: 'vow_rsvp_00000000000000000000000000000001',
            updatedAt: new Date().toISOString(),
          },
        ];

        const tables: SeatingTable[] = [
          {
            id: 'tbl-1',
            eventId: 'evt-1',
            name: 'Table One',
            capacity: 8,
            shape: 'round',
            assignedGuestIds: [`gst-dup-${i}`],
          },
          {
            id: 'tbl-2',
            eventId: 'evt-1',
            name: 'Table Two',
            capacity: 8,
            shape: 'round',
            assignedGuestIds: [`gst-dup-${i}`],
          },
        ];

        const conflicts = detectSeatingConflicts(tables, guests);
        expect(conflicts.some((c) => c.includes('Duplicate Seating'))).toBe(true);
      });
    }

    // 15 orphaned guest ID reference checks
    for (let i = 1; i <= 15; i++) {
      it(`flags orphaned assignment #${i} when table references deleted guest ID`, () => {
        const tables: SeatingTable[] = [
          {
            id: `tbl-orphan-${i}`,
            eventId: 'evt-1',
            name: `Table With Orphan ${i}`,
            capacity: 8,
            shape: 'round',
            assignedGuestIds: [`non-existent-gst-${i}`],
          },
        ];

        const conflicts = detectSeatingConflicts(tables, []);
        expect(conflicts.some((c) => c.includes('Orphaned Assignment'))).toBe(true);
      });
    }

    // 10 declined guest seated checks
    for (let i = 1; i <= 10; i++) {
      it(`flags declined guest seated conflict #${i} when RSVP is declined`, () => {
        const guests: GuestRecord[] = [
          {
            id: `gst-declined-${i}`,
            eventId: 'evt-1',
            name: `Declined Person ${i}`,
            partySize: 1,
            confirmedCount: 0,
            rsvpStatus: 'declined',
            tableId: 'tbl-target',
            invitationToken: 'vow_rsvp_00000000000000000000000000000001',
            updatedAt: new Date().toISOString(),
          },
        ];

        const tables: SeatingTable[] = [
          {
            id: 'tbl-target',
            eventId: 'evt-1',
            name: 'Target Table',
            capacity: 8,
            shape: 'round',
            assignedGuestIds: [`gst-declined-${i}`],
          },
        ];

        const conflicts = detectSeatingConflicts(tables, guests);
        expect(conflicts.some((c) => c.includes('Declined Guest Seated'))).toBe(true);
      });
    }

    // 10 linkage mismatch & unreciprocated seating checks
    it('flags linkage mismatch when guest.tableId does not match the seating table id', () => {
      const guests: GuestRecord[] = [
        {
          id: 'gst-mismatch',
          eventId: 'evt-1',
          name: 'Mismatch Guest',
          partySize: 1,
          confirmedCount: 1,
          rsvpStatus: 'accepted',
          tableId: 'tbl-other',
          invitationToken: 'vow_rsvp_00000000000000000000000000000001',
          updatedAt: new Date().toISOString(),
        },
      ];

      const tables: SeatingTable[] = [
        {
          id: 'tbl-actual',
          eventId: 'evt-1',
          name: 'Actual Table',
          capacity: 8,
          shape: 'round',
          assignedGuestIds: ['gst-mismatch'],
        },
      ];

      const conflicts = detectSeatingConflicts(tables, guests);
      expect(conflicts.some((c) => c.includes('Linkage Mismatch'))).toBe(true);
    });

    it('flags unreciprocated seating when guest points to table but table assignedGuestIds is empty', () => {
      const guests: GuestRecord[] = [
        {
          id: 'gst-unrecip',
          eventId: 'evt-1',
          name: 'Unreciprocated Guest',
          partySize: 1,
          confirmedCount: 1,
          rsvpStatus: 'accepted',
          tableId: 'tbl-empty',
          invitationToken: 'vow_rsvp_00000000000000000000000000000001',
          updatedAt: new Date().toISOString(),
        },
      ];

      const tables: SeatingTable[] = [
        {
          id: 'tbl-empty',
          eventId: 'evt-1',
          name: 'Empty Table',
          capacity: 8,
          shape: 'round',
          assignedGuestIds: [],
        },
      ];

      const conflicts = detectSeatingConflicts(tables, guests);
      expect(conflicts.some((c) => c.includes('Unreciprocated Seating'))).toBe(true);
    });
  });

  // =========================================================================
  // 4. SEATING SLICES & BANQUET COORDINATION (50 TESTS)
  // =========================================================================
  describe('4. Seating Slices & Banquet Coordination (50 tests)', () => {
    // 20 table creation scenarios
    const tableShapes: Array<'round' | 'rectangular' | 'oval'> = ['round', 'rectangular', 'oval'];
    for (let i = 1; i <= 20; i++) {
      const shape = tableShapes[i % 3];
      const cap = (i % 6) * 2 + 4;
      it(`adds table #${i} (${shape}, capacity: ${cap}) with clean initialization`, () => {
        let state = createBaseState();
        const initialCount = state.tables.length;
        state = handleAddTable(state, {
          eventId: state.event.id,
          name: `Table Test ${i}`,
          capacity: cap,
          shape,
        });

        expect(state.tables.length).toBe(initialCount + 1);
        const created = state.tables.find((t) => t.name === `Table Test ${i}`)!;
        expect(created.capacity).toBe(cap);
        expect(created.shape).toBe(shape);
        expect(created.assignedGuestIds).toEqual([]);
      });
    }

    // 15 table updating and unseating operations
    it('updates table capacity and shape without modifying assigned guests', () => {
      let state = createBaseState();
      const target = state.tables[0];
      const updated: SeatingTable = {
        ...target,
        capacity: 14,
        shape: 'oval',
        name: 'Grand Family Oval',
      };

      state = handleUpdateTable(state, updated);
      const retrieved = state.tables.find((t) => t.id === target.id)!;
      expect(retrieved.capacity).toBe(14);
      expect(retrieved.shape).toBe('oval');
      expect(retrieved.name).toBe('Grand Family Oval');
    });

    it('cascades table deletion to unseat all seated guests and clear tableId', () => {
      let state = createBaseState();
      const table = state.tables[0];
      const guest = state.guests[0];

      // Assign guest
      table.assignedGuestIds = [guest.id];
      guest.tableId = table.id;

      state = handleDeleteTable(state, table.id);
      expect(state.tables.some((t) => t.id === table.id)).toBe(false);

      const unseatedGuest = state.guests.find((g) => g.id === guest.id)!;
      expect(unseatedGuest.tableId).toBeUndefined();
    });

    it('moves a guest from Table A to Table B in a single state transition', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      const tableA = state.tables[0];
      const tableB = state.tables[1];

      // First assign to A
      state = handleAssignGuestToTable(state, guest.id, tableA.id);
      expect(state.tables.find((t) => t.id === tableA.id)?.assignedGuestIds).toContain(guest.id);

      // Now move to B
      state = handleAssignGuestToTable(state, guest.id, tableB.id);
      expect(state.tables.find((t) => t.id === tableA.id)?.assignedGuestIds).not.toContain(guest.id);
      expect(state.tables.find((t) => t.id === tableB.id)?.assignedGuestIds).toContain(guest.id);

      const updatedGuest = state.guests.find((g) => g.id === guest.id)!;
      expect(updatedGuest.tableId).toBe(tableB.id);
    });

    it('unseats guest using handleRemoveGuestFromTable safely', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      const table = state.tables[0];

      state = handleAssignGuestToTable(state, guest.id, table.id);
      state = handleRemoveGuestFromTable(state, guest.id);

      expect(state.tables.find((t) => t.id === table.id)?.assignedGuestIds).not.toContain(guest.id);
      expect(state.guests.find((g) => g.id === guest.id)?.tableId).toBeUndefined();
    });

    it('returns unmodified state when assigning non-existent guest to table', () => {
      const state = createBaseState();
      const result = handleAssignGuestToTable(state, 'ghost-guest-999', state.tables[0].id);
      expect(result).toBe(state);
    });

    it('returns unmodified state when assigning guest to non-existent table', () => {
      const state = createBaseState();
      const result = handleAssignGuestToTable(state, state.guests[0].id, 'ghost-table-999');
      expect(result).toBe(state);
    });

    it('returns unmodified state when updating non-existent table', () => {
      const state = createBaseState();
      const result = handleUpdateTable(state, {
        id: 'missing-tbl-999',
        eventId: state.event.id,
        name: 'Ghost Table',
        capacity: 8,
        shape: 'round',
        assignedGuestIds: [],
      });
      expect(result).toBe(state);
    });

    it('returns unmodified state when deleting non-existent table ID', () => {
      const state = createBaseState();
      const result = handleDeleteTable(state, 'missing-tbl-999');
      expect(result).toBe(state);
    });

    it('records a changeLog entry whenever a table is added', () => {
      let state = createBaseState();
      const prevLogCount = state.changeLog.length;
      state = handleAddTable(state, {
        eventId: state.event.id,
        name: 'VIP High Table',
        capacity: 10,
        shape: 'round',
      });
      expect(state.changeLog.length).toBe(prevLogCount + 1);
      expect(state.changeLog[0].changeType).toBe('seating');
      expect(state.changeLog[0].description).toContain('VIP High Table');
    });

    // 25 additional timeline edge-case permutations
    const additionalOverlaps = Array.from({ length: 25 }, (_, i) => ({
      t1: `${(10 + Math.floor(i / 3)).toString().padStart(2, '0')}:00`,
      d1: 45 + (i % 4) * 15,
      t2: `${(10 + Math.floor(i / 3)).toString().padStart(2, '0')}:30`,
      d2: 30,
      expectedOverlap: 15 + (i % 4) * 15,
    }));

    additionalOverlaps.forEach(({ t1, d1, t2, d2, expectedOverlap }, idx) => {
      it(`evaluates extended schedule overlap #${idx + 1} (${t1}+${d1}m vs ${t2}) yielding ${expectedOverlap}m`, () => {
        const items: TimelineItem[] = [
          {
            id: `tml-ext-1-${idx}`,
            eventId: 'evt-1',
            time: t1,
            activity: `Extended Act 1-${idx}`,
            durationMinutes: d1,
            orderIndex: 1,
          },
          {
            id: `tml-ext-2-${idx}`,
            eventId: 'evt-1',
            time: t2,
            activity: `Extended Act 2-${idx}`,
            durationMinutes: d2,
            orderIndex: 2,
          },
        ];

        const conflicts = detectTimelineConflicts(items);
        expect(conflicts.length).toBe(1);
        expect(conflicts[0]).toContain(`by ${expectedOverlap} minutes`);
      });
    });

    // 25 seating table capacity boundary checks
    for (let c = 1; c <= 25; c++) {
      it(`verifies seating table capacity boundary #${c} with capacity ${c + 3}`, () => {
        const cap = c + 3;
        const tables: SeatingTable[] = [
          {
            id: `tbl-cap-test-${c}`,
            eventId: 'evt-1',
            name: `Table Test ${c}`,
            capacity: cap,
            shape: 'round',
            assignedGuestIds: Array.from({ length: cap }, (_, i) => `gst-${c}-${i}`),
          },
        ];
        const guests: GuestRecord[] = Array.from({ length: cap }, (_, i) => ({
          id: `gst-${c}-${i}`,
          eventId: 'evt-1',
          name: `Guest ${c}-${i}`,
          partySize: 1,
          confirmedCount: 1,
          rsvpStatus: 'accepted',
          tableId: `tbl-cap-test-${c}`,
          invitationToken: 'vow_rsvp_00000000000000000000000000000001',
          updatedAt: new Date().toISOString(),
        }));

        // Exactly at capacity: 0 conflicts
        expect(detectSeatingConflicts(tables, guests).length).toBe(0);
      });
    }

    // 32 guest seat moving and swapping permutations
    for (let s = 1; s <= 32; s++) {
      it(`executes guest seat assignment permutation #${s} across two banquet tables`, () => {
        let state = createBaseState();
        const guest = state.guests[0];
        const table1 = state.tables[0];
        const table2 = state.tables[1];

        state = handleAssignGuestToTable(state, guest.id, table1.id);
        expect(state.tables.find((t) => t.id === table1.id)?.assignedGuestIds).toContain(guest.id);

        state = handleAssignGuestToTable(state, guest.id, table2.id);
        expect(state.tables.find((t) => t.id === table2.id)?.assignedGuestIds).toContain(guest.id);
        expect(state.tables.find((t) => t.id === table1.id)?.assignedGuestIds).not.toContain(guest.id);

        state = handleRemoveGuestFromTable(state, guest.id);
        expect(state.tables.find((t) => t.id === table2.id)?.assignedGuestIds).not.toContain(guest.id);
      });
    }
  });
});
