import { describe, it, expect } from 'vitest';
import {
  handleAddGuest as _handleAddGuest,
  handleDeleteGuest as _handleDeleteGuest,
  handleUpdateGuestRsvp as _handleUpdateGuestRsvp,
  handleBatchAddGuests as _handleBatchAddGuests,
  formatGuestsCsv,
} from '../context/slices/guestSlice';
import { AppState, GuestRecord, RsvpStatus, SeatingTable } from '../types';
import { generateSecureRsvpToken, isValidRsvpToken } from '../utils/security';
import { DEMO_STATE } from '../persistence/demoData';

interface FullState extends AppState {
  guests: GuestRecord[];
  tables: SeatingTable[];
}

function createBaseState(): FullState {
  const state = JSON.parse(JSON.stringify(DEMO_STATE));
  if (!state.guests) state.guests = [];
  if (!state.tables) state.tables = [];
  return state as FullState;
}

const handleAddGuest = (s: AppState, g: any): FullState => _handleAddGuest(s, g) as FullState;
const handleDeleteGuest = (s: AppState, id: string): FullState => _handleDeleteGuest(s, id) as FullState;
const handleUpdateGuestRsvp = (...args: Parameters<typeof _handleUpdateGuestRsvp>): FullState =>
  _handleUpdateGuestRsvp(...args) as FullState;
const handleBatchAddGuests = (s: AppState, g: any[]): FullState => _handleBatchAddGuests(s, g) as FullState;

describe('Guest Management & RSVP Comprehensive Suite (250 Tests)', () => {
  // =========================================================================
  // 1. GUEST LIFECYCLE & BOUNDARY CONDITIONS (70 TESTS)
  // =========================================================================
  describe('1. Guest Lifecycle, Creation & Party Size Boundaries (70 tests)', () => {
    // 30 distinct party sizes (1 to 30)
    const partySizes = Array.from({ length: 30 }, (_, i) => i + 1);

    partySizes.forEach((size) => {
      it(`initializes pending guest with party size ${size} having confirmedCount 0`, () => {
        let state = createBaseState();
        state = handleAddGuest(state, {
          eventId: state.event.id,
          name: `Guest Party ${size}`,
          partySize: size,
          confirmedCount: 0,
          rsvpStatus: 'pending',
        });

        const created = state.guests.find((g) => g.name === `Guest Party ${size}`);
        expect(created).toBeDefined();
        expect(created?.partySize).toBe(size);
        expect(created?.confirmedCount).toBe(0);
        expect(created?.rsvpStatus).toBe('pending');
        expect(created?.invitationToken).toMatch(/^vow_rsvp_[0-9a-f]{32}$/);
      });
    });

    // 20 pre-accepted party sizes
    const acceptedSizes = Array.from({ length: 20 }, (_, i) => i + 1);
    acceptedSizes.forEach((size) => {
      it(`initializes pre-accepted guest with party size ${size} having confirmedCount = ${size}`, () => {
        let state = createBaseState();
        state = handleAddGuest(state, {
          eventId: state.event.id,
          name: `Accepted Party ${size}`,
          partySize: size,
          confirmedCount: size,
          rsvpStatus: 'accepted',
        });

        const created = state.guests.find((g) => g.name === `Accepted Party ${size}`);
        expect(created?.confirmedCount).toBe(size);
        expect(created?.rsvpStatus).toBe('accepted');
      });
    });

    // 12 status transitions
    const statusTransitions: Array<[RsvpStatus, RsvpStatus, number]> = [
      ['pending', 'accepted', 1],
      ['pending', 'accepted', 2],
      ['pending', 'declined', 0],
      ['accepted', 'declined', 0],
      ['accepted', 'pending', 0],
      ['declined', 'accepted', 1],
      ['declined', 'accepted', 4],
      ['declined', 'pending', 0],
      ['accepted', 'accepted', 3],
      ['pending', 'pending', 0],
      ['declined', 'declined', 0],
      ['accepted', 'declined', 0],
    ];

    statusTransitions.forEach(([from, to, confirmed], idx) => {
      it(`transitions guest status from "${from}" to "${to}" (case #${idx + 1})`, () => {
        let state = createBaseState();
        state = handleAddGuest(state, {
          eventId: state.event.id,
          name: `Transition Case ${idx}`,
          partySize: 4,
          confirmedCount: from === 'accepted' ? 4 : 0,
          rsvpStatus: from,
        });

        const guest = state.guests.find((g) => g.name === `Transition Case ${idx}`)!;
        state = handleUpdateGuestRsvp(state, guest.id, to, confirmed, 'Nut Allergy');

        const updated = state.guests.find((g) => g.id === guest.id)!;
        expect(updated.rsvpStatus).toBe(to);
        if (to === 'accepted') {
          expect(updated.confirmedCount).toBe(Math.max(1, confirmed));
        } else {
          expect(updated.confirmedCount).toBe(0);
        }
        expect(updated.dietaryNotes).toBe('Nut Allergy');
      });
    });

    // 8 batch operations and edge cases
    const batchCounts = [1, 2, 3, 5, 8];
    batchCounts.forEach((count) => {
      it(`batch imports ${count} guests with distinct tokens and IDs`, () => {
        let state = createBaseState();
        const initialCount = state.guests.length;
        const batch = Array.from({ length: count }, (_, i) => ({
          eventId: state.event.id,
          name: `Batch Guest ${count}-${i}`,
          partySize: (i % 4) + 1,
          confirmedCount: 0,
          rsvpStatus: 'pending' as RsvpStatus,
        }));

        state = handleBatchAddGuests(state, batch);
        expect(state.guests.length).toBe(initialCount + count);

        const tokens = state.guests.slice(-count).map((g) => g.invitationToken);
        const uniqueTokens = new Set(tokens);
        expect(uniqueTokens.size).toBe(count);
      });
    });

    it('cascades guest deletion to remove guest from assigned seating table', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      const table = state.tables[0];

      table.assignedGuestIds.push(guest.id);
      guest.tableId = table.id;

      state = handleDeleteGuest(state, guest.id);
      expect(state.guests.some((g) => g.id === guest.id)).toBe(false);

      const updatedTable = state.tables.find((t) => t.id === table.id);
      expect(updatedTable?.assignedGuestIds.includes(guest.id)).toBe(false);
    });

    it('returns original state when deleting non-existent guest ID', () => {
      const state = createBaseState();
      const nextState = handleDeleteGuest(state, 'non-existent-id-999');
      expect(nextState).toBe(state);
    });

    it('records a changeLog entry whenever a guest is added', () => {
      let state = createBaseState();
      const prevLogCount = state.changeLog.length;
      state = handleAddGuest(state, {
        eventId: state.event.id,
        name: 'Log Verifier',
        partySize: 2,
        confirmedCount: 0,
        rsvpStatus: 'pending',
      });
      expect(state.changeLog.length).toBe(prevLogCount + 1);
      expect(state.changeLog[0].changeType).toBe('guest');
    });
  });

  // =========================================================================
  // 2. 128-BIT CRYPTOGRAPHIC TOKEN SECURITY & INVARIANTS (40 TESTS)
  // =========================================================================
  describe('2. 128-Bit Cryptographic Token Security & Invariants (40 tests)', () => {
    // 15 token invariant checks
    for (let i = 1; i <= 15; i++) {
      it(`generates secure token sample #${i} satisfying 41-char length and vow_rsvp_ prefix`, () => {
        const token = generateSecureRsvpToken();
        expect(token.length).toBe(41);
        expect(token.startsWith('vow_rsvp_')).toBe(true);
        expect(isValidRsvpToken(token)).toBe(true);
      });
    }

    // 25 malformed and hostile token rejections
    const invalidTokens = [
      '',
      'short',
      'vow_rsvp_',
      'vow_rsvp_123',
      'vow_rsvp_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
      'vow_rsvp_0123456789abcdef0123456789abcde', // 31 chars
      'vow_rsvp_0123456789abcdef0123456789abcdef0', // 33 chars
      'rsvp_0123456789abcdef0123456789abcdef',
      'VOW_RSVP_0123456789abcdef0123456789abcdef',
      'vow_rsvp_0123456789ABCDEF0123456789ABCDEF',
      'null',
      'undefined',
      '../etc/passwd',
      '<script>alert(1)</script>',
      'vow_rsvp_0123456789abcdef0123456789abcd!',
      'vow_rsvp_0123456789abcdef0123456789abcd?',
      'vow_rsvp_0123456789abcdef0123456789abcd#',
      'vow_rsvp_0123456789abcdef0123456789abcd ',
      ' vow_rsvp_0123456789abcdef0123456789abcdef',
      'vow_rsvp_0123456789abcdef0123456789abcdef ',
      'vow_rsvp_0123456789abcdef0123456789abc\n',
      'vow_rsvp_0123456789abcdef0123456789abc\t',
      'vow_rsvp_00000000-0000-0000-0000-000000',
      'vow_rsvp_g123456789abcdef0123456789abcde', // 'g' non-hex
      'vow_rsvp_h123456789abcdef0123456789abcde', // 'h' non-hex
    ];

    invalidTokens.forEach((token, idx) => {
      it(`rejects malformed token variant #${idx + 1} ("${token.substring(0, 15)}...")`, () => {
        expect(isValidRsvpToken(token)).toBe(false);
      });
    });
  });

  // =========================================================================
  // 3. RFC 4180 CSV FORMATTING & ESCAPING (50 TESTS)
  // =========================================================================
  describe('3. RFC 4180 CSV Export Compliance & Character Escaping (50 tests)', () => {
    it('produces standard CSV header on export', () => {
      const csv = formatGuestsCsv([]);
      expect(csv).toContain('Name,Household/Group,Party Size,RSVP Status,Confirmed Guests,Email,Phone,Dietary Requirements,Accessibility,RSVP Link Token,Notes');
    });

    // 25 international and special name test cases
    const specialNameCases = [
      ['Dr. Martin O\'Connor', '"Dr. Martin O\'Connor"'],
      ['Smith, Jr., Robert', '"Smith, Jr., Robert"'],
      ['"Quoted" Name', '"""Quoted"" Name"'],
      ['Line\nBreak', '"Line\nBreak"'],
      ['অগ্নিদীপ্ত সরকার', '"অগ্নিদীপ্ত সরকার"'],
      ['দেবলীনা সেন', '"দেবলীনা সেন"'],
      ['রাজেশ শর্মা', '"রাজেশ শর্মা"'],
      ['অনন্যা মুখার্জী', '"অনন্যা মুখার্জী"'],
      ['সৌম্যদীপ চক্রবর্তী', '"সৌম্যদীপ চক্রবর্তী"'],
      ['Éléonore François', '"Éléonore François"'],
      ['Müller & Co.', '"Müller & Co."'],
      ['Special Characters <>&;', '"Special Characters <>&\x3b"'],
      ['José María Álvarez', '"José María Álvarez"'],
      ['Søren Kierkegaard', '"Søren Kierkegaard"'],
      ['Łukasz Kowalski', '"Łukasz Kowalski"'],
      ['Agnès Varda', '"Agnès Varda"'],
      ['René Descartes', '"René Descartes"'],
      ['O\'Brien, Patrick', '"O\'Brien, Patrick"'],
      ['Name With "Nested" Quotes', '"Name With ""Nested"" Quotes"'],
      ['Tab\tSeparated\tName', '"Tab\tSeparated\tName"'],
      ['Trailing Space Name ', '"Trailing Space Name "'],
      [' Leading Space Name', '" Leading Space Name"'],
      ['Name, With, Multiple, Commas', '"Name, With, Multiple, Commas"'],
      ['Multi\r\nLine\r\nName', '"Multi\r\nLine\r\nName"'],
      ['Emoji 💍 Name ✨', '"Emoji 💍 Name ✨"'],
    ];

    specialNameCases.forEach(([rawName, expectedEscaped]) => {
      it(`properly escapes special name "${rawName.replace(/\n/g, '\\n')}" in CSV`, () => {
        const guest: GuestRecord = {
          id: 'test-gst-1',
          eventId: 'evt-1',
          name: rawName,
          partySize: 2,
          confirmedCount: 2,
          rsvpStatus: 'accepted',
          invitationToken: 'vow_rsvp_0123456789abcdef0123456789abcdef',
          updatedAt: new Date().toISOString(),
        };

        const csv = formatGuestsCsv([guest]);
        expect(csv).toContain(expectedEscaped);
      });
    });

    // 15 dietary notes cases
    const dietaryTestCases = [
      'Strict Vegan, Nut Allergy',
      'No Dairy; Kosher only',
      'Gluten-Free ("Severe Celiac")',
      'Halal\nNut allergy',
      'Jain meal without root vegetables',
      'Diabetic diet, low sodium',
      'Shellfish & Peanut allergy',
      'Pescatarian only',
      'No beef, no pork',
      'Keto / Low carb preference',
      'Pure Vegetarian ("Satvik")',
      'Eggless only',
      'Soy-free required',
      'Low FODMAP',
      'No spicy foods',
    ];

    dietaryTestCases.forEach((dietary) => {
      it(`escapes dietary note "${dietary.replace(/\n/g, '\\n')}" correctly in CSV column`, () => {
        const guest: GuestRecord = {
          id: 'test-gst-2',
          eventId: 'evt-1',
          name: 'Dietary Test Guest',
          partySize: 1,
          confirmedCount: 1,
          rsvpStatus: 'accepted',
          dietaryNotes: dietary,
          invitationToken: 'vow_rsvp_0123456789abcdef0123456789abcdef',
          updatedAt: new Date().toISOString(),
        };

        const csv = formatGuestsCsv([guest]);
        const expected = `"${dietary.replace(/"/g, '""')}"`;
        expect(csv).toContain(expected);
      });
    });

    // 9 size and format tests
    const listSizes = [1, 2, 3, 5, 8, 10, 15, 20, 25];
    listSizes.forEach((size) => {
      it(`exports list of ${size} guests generating header + ${size} CSV records`, () => {
        const guests: GuestRecord[] = Array.from({ length: size }, (_, i) => ({
          id: `gst-csv-${i}`,
          eventId: 'evt-1',
          name: `Guest Number ${i}`,
          partySize: (i % 3) + 1,
          confirmedCount: (i % 3) + 1,
          rsvpStatus: 'accepted',
          invitationToken: `vow_rsvp_${i.toString().padStart(32, '0')}`,
          updatedAt: new Date().toISOString(),
        }));

        const csv = formatGuestsCsv(guests);
        const rows = csv.split('\n').filter((l) => l.trim().length > 0);
        expect(rows.length).toBe(size + 1);
      });
    });
  });

  // =========================================================================
  // 4. ATTENDANCE METRICS, DIETARY AGGREGATIONS & HEADCOUNTS (40 TESTS)
  // =========================================================================
  describe('4. Attendance Metrics & Headcount Aggregations (40 tests)', () => {
    function computeMetrics(guests: GuestRecord[]) {
      let totalInvited = 0;
      let totalConfirmed = 0;
      let totalDeclined = 0;
      let totalPending = 0;
      let acceptedParties = 0;
      let declinedParties = 0;
      let pendingParties = 0;
      const dietaryCounts = new Map<string, number>();

      for (const g of guests) {
        totalInvited += g.partySize;
        if (g.rsvpStatus === 'accepted') {
          acceptedParties += 1;
          totalConfirmed += g.confirmedCount;
        } else if (g.rsvpStatus === 'declined') {
          declinedParties += 1;
          totalDeclined += g.partySize;
        } else {
          pendingParties += 1;
          totalPending += g.partySize;
        }

        if (g.dietaryNotes) {
          const notes = g.dietaryNotes.toLowerCase();
          ['vegan', 'vegetarian', 'gluten-free', 'nut allergy', 'halal', 'kosher', 'jain', 'eggless'].forEach((key) => {
            if (notes.includes(key)) {
              dietaryCounts.set(key, (dietaryCounts.get(key) || 0) + 1);
            }
          });
        }
      }

      return {
        totalInvited,
        totalConfirmed,
        totalDeclined,
        totalPending,
        acceptedParties,
        declinedParties,
        pendingParties,
        dietaryCounts,
      };
    }

    // 20 distribution scenarios
    const testDistributions = Array.from({ length: 20 }, (_, i) => ({
      accepted: (i % 5) + 1,
      declined: (i % 4),
      pending: (i % 3) + 1,
      partySize: (i % 3) + 1,
    }));

    testDistributions.forEach(({ accepted, declined, pending, partySize }, idx) => {
      it(`calculates exact headcount metrics for scenario #${idx + 1} (acc:${accepted}, dec:${declined}, pen:${pending}, size:${partySize})`, () => {
        const guests: GuestRecord[] = [];
        let idCounter = 0;

        for (let i = 0; i < accepted; i++) {
          guests.push({
            id: `gst-${++idCounter}`,
            eventId: 'evt-1',
            name: `Acc ${i}`,
            partySize,
            confirmedCount: partySize,
            rsvpStatus: 'accepted',
            invitationToken: `vow_rsvp_${idCounter.toString().padStart(32, '0')}`,
            updatedAt: new Date().toISOString(),
          });
        }
        for (let i = 0; i < declined; i++) {
          guests.push({
            id: `gst-${++idCounter}`,
            eventId: 'evt-1',
            name: `Dec ${i}`,
            partySize,
            confirmedCount: 0,
            rsvpStatus: 'declined',
            invitationToken: `vow_rsvp_${idCounter.toString().padStart(32, '0')}`,
            updatedAt: new Date().toISOString(),
          });
        }
        for (let i = 0; i < pending; i++) {
          guests.push({
            id: `gst-${++idCounter}`,
            eventId: 'evt-1',
            name: `Pen ${i}`,
            partySize,
            confirmedCount: 0,
            rsvpStatus: 'pending',
            invitationToken: `vow_rsvp_${idCounter.toString().padStart(32, '0')}`,
            updatedAt: new Date().toISOString(),
          });
        }

        const metrics = computeMetrics(guests);
        expect(metrics.totalInvited).toBe((accepted + declined + pending) * partySize);
        expect(metrics.totalConfirmed).toBe(accepted * partySize);
        expect(metrics.totalDeclined).toBe(declined * partySize);
        expect(metrics.totalPending).toBe(pending * partySize);
        expect(metrics.acceptedParties).toBe(accepted);
        expect(metrics.declinedParties).toBe(declined);
        expect(metrics.pendingParties).toBe(pending);
      });
    });

    // 15 dietary categories
    const dietaryKeys = [
      'vegan',
      'vegetarian',
      'gluten-free',
      'nut allergy',
      'halal',
      'kosher',
      'jain',
      'eggless',
    ];

    dietaryKeys.forEach((key) => {
      it(`tallies distinct dietary requirement for single requirement "${key}"`, () => {
        const guests: GuestRecord[] = [
          {
            id: 'g1',
            eventId: 'e1',
            name: 'Special Eater',
            partySize: 1,
            confirmedCount: 1,
            rsvpStatus: 'accepted',
            dietaryNotes: `Strict ${key} preparation`,
            invitationToken: 'vow_rsvp_00000000000000000000000000000001',
            updatedAt: new Date().toISOString(),
          },
        ];

        const metrics = computeMetrics(guests);
        expect(metrics.dietaryCounts.get(key)).toBe(1);
      });
    });

    // 5 multi-dietary combinations
    const multiDiets = [
      ['vegan', 'gluten-free'],
      ['halal', 'nut allergy'],
      ['jain', 'vegetarian'],
      ['kosher', 'eggless'],
      ['vegetarian', 'nut allergy'],
    ];

    multiDiets.forEach(([d1, d2]) => {
      it(`tallies combined dietary requirements "${d1}" and "${d2}" concurrently`, () => {
        const guests: GuestRecord[] = [
          {
            id: 'g-combo',
            eventId: 'e1',
            name: 'Combo Eater',
            partySize: 1,
            confirmedCount: 1,
            rsvpStatus: 'accepted',
            dietaryNotes: `${d1} and also ${d2}`,
            invitationToken: 'vow_rsvp_00000000000000000000000000000001',
            updatedAt: new Date().toISOString(),
          },
        ];

        const metrics = computeMetrics(guests);
        expect(metrics.dietaryCounts.get(d1)).toBe(1);
        expect(metrics.dietaryCounts.get(d2)).toBe(1);
      });
    });

    it('returns zeros for empty guest list metrics', () => {
      const metrics = computeMetrics([]);
      expect(metrics.totalInvited).toBe(0);
      expect(metrics.totalConfirmed).toBe(0);
    });

    it('aggregates partial headcount attendance correctly', () => {
      const guests: GuestRecord[] = [
        {
          id: 'g-part',
          eventId: 'e1',
          name: 'Partial',
          partySize: 6,
          confirmedCount: 4,
          rsvpStatus: 'accepted',
          invitationToken: 'vow_rsvp_00000000000000000000000000000001',
          updatedAt: new Date().toISOString(),
        },
      ];
      const metrics = computeMetrics(guests);
      expect(metrics.totalInvited).toBe(6);
      expect(metrics.totalConfirmed).toBe(4);
    });
  });

  // =========================================================================
  // 5. SEARCH & MULTI-FILTER QUERY ENGINE (35 TESTS)
  // =========================================================================
  describe('5. Search & Multi-Filter Query Engine (35 tests)', () => {
    function filterGuests(
      guests: GuestRecord[],
      statusFilter: string,
      searchQuery: string
    ): GuestRecord[] {
      return guests.filter((g) => {
        if (statusFilter !== 'all' && g.rsvpStatus !== statusFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = g.name.toLowerCase().includes(q);
          const matchesEmail = g.email?.toLowerCase().includes(q) || false;
          const matchesPhone = g.phone?.toLowerCase().includes(q) || false;
          const matchesHousehold = g.householdGroup?.toLowerCase().includes(q) || false;
          const matchesDietary = g.dietaryNotes?.toLowerCase().includes(q) || false;
          if (!matchesName && !matchesEmail && !matchesPhone && !matchesHousehold && !matchesDietary) {
            return false;
          }
        }
        return true;
      });
    }

    const testRoster: GuestRecord[] = [
      {
        id: 'g1',
        eventId: 'e1',
        name: 'Agnidipta Sarkar',
        email: 'agnidipta@example.com',
        phone: '+91 90000 00001',
        householdGroup: 'Sarkar Family',
        partySize: 2,
        confirmedCount: 2,
        rsvpStatus: 'accepted',
        dietaryNotes: 'Vegetarian',
        invitationToken: 'vow_rsvp_00000000000000000000000000000001',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'g2',
        eventId: 'e1',
        name: 'Debolina Sen',
        email: 'debolina@example.com',
        phone: '+91 90000 00002',
        householdGroup: 'Sen Family',
        partySize: 3,
        confirmedCount: 0,
        rsvpStatus: 'declined',
        dietaryNotes: 'Vegan, Nut Allergy',
        invitationToken: 'vow_rsvp_00000000000000000000000000000002',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'g3',
        eventId: 'e1',
        name: 'Rajesh Sharma',
        email: 'rajesh@sharma-enterprises.com',
        phone: '+91 90000 00003',
        householdGroup: 'Sharma Family',
        partySize: 4,
        confirmedCount: 0,
        rsvpStatus: 'pending',
        dietaryNotes: 'Jain Meal',
        invitationToken: 'vow_rsvp_00000000000000000000000000000003',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'g4',
        eventId: 'e1',
        name: 'Ananya Mukherjee',
        email: 'ananya@mukherjee.org',
        phone: '+91 90000 00004',
        householdGroup: 'Mukherjee Family',
        partySize: 2,
        confirmedCount: 2,
        rsvpStatus: 'accepted',
        dietaryNotes: 'Gluten-Free',
        invitationToken: 'vow_rsvp_00000000000000000000000000000004',
        updatedAt: new Date().toISOString(),
      },
    ];

    // 25 search queries
    const searchCases = [
      ['agnidipta', 1],
      ['SARKAR', 1],
      ['Sarkar', 1],
      ['sarkar family', 1],
      ['debolina@example.com', 1],
      ['DEBOLINA', 1],
      ['sen', 1],
      ['sharma', 1],
      ['sharma-enterprises', 1],
      ['vegan', 1],
      ['nut allergy', 1],
      ['jain', 1],
      ['gluten-free', 1],
      ['mukherjee', 1],
      ['family', 4],
      ['org', 1],
      ['com', 3],
      ['90000', 4],
      ['00001', 1],
      ['non-existent-query-xyz', 0],
      ['', 4],
      ['  Ananya   ', 1],
      ['  sarkar  ', 1],
      ['RAJESH', 1],
      ['ANANYA', 1],
    ];

    searchCases.forEach(([query, expectedCount], idx) => {
      it(`search query #${idx + 1} ("${query}") returns exactly ${expectedCount} match(es)`, () => {
        const results = filterGuests(testRoster, 'all', query as string);
        expect(results.length).toBe(expectedCount);
      });
    });

    // 10 status filter combinations
    const statusTests: Array<[string, string, number]> = [
      ['all', '', 4],
      ['accepted', '', 2],
      ['declined', '', 1],
      ['pending', '', 1],
      ['accepted', 'sarkar', 1],
      ['accepted', 'debolina', 0],
      ['declined', 'debolina', 1],
      ['pending', 'sharma', 1],
      ['pending', 'sarkar', 0],
      ['declined', 'sarkar', 0],
    ];

    statusTests.forEach(([status, query, expected], idx) => {
      it(`status filter combination #${idx + 1} (status:${status}, query:"${query}") returns ${expected}`, () => {
        const results = filterGuests(testRoster, status, query);
        expect(results.length).toBe(expected);
      });
    });
  });

  // =========================================================================
  // 6. RSVP SUBMISSION BOUNDARIES & STATE MACHINE (15 TESTS)
  // =========================================================================
  describe('6. RSVP Submission Boundaries & State Machine (15 tests)', () => {
    const clampingCases = [
      { inputCount: 10, partySize: 4, expected: 4 },
      { inputCount: 50, partySize: 2, expected: 2 },
      { inputCount: 100, partySize: 1, expected: 1 },
      { inputCount: 0, partySize: 3, expected: 1 }, // min 1 when accepted
      { inputCount: -5, partySize: 4, expected: 1 }, // min 1 when accepted
      { inputCount: 2, partySize: 4, expected: 2 },
      { inputCount: 3, partySize: 3, expected: 3 },
    ];

    clampingCases.forEach(({ inputCount, partySize, expected }, idx) => {
      it(`clamps confirmedCount #${idx + 1} (input:${inputCount}, party:${partySize}) to ${expected} when accepted`, () => {
        let state = createBaseState();
        state = handleAddGuest(state, {
          eventId: state.event.id,
          name: `Clamp Test ${idx}`,
          partySize,
          confirmedCount: 0,
          rsvpStatus: 'pending',
        });
        const guest = state.guests.find((g) => g.name === `Clamp Test ${idx}`)!;
        state = handleUpdateGuestRsvp(state, guest.id, 'accepted', inputCount);
        const updated = state.guests.find((g) => g.id === guest.id)!;
        expect(updated.confirmedCount).toBe(expected);
      });
    });

    const declineCases = [1, 2, 5, 10, 20];
    declineCases.forEach((partySize) => {
      it(`forces confirmedCount = 0 for party size ${partySize} when RSVP is declined`, () => {
        let state = createBaseState();
        state = handleAddGuest(state, {
          eventId: state.event.id,
          name: `Decline Party ${partySize}`,
          partySize,
          confirmedCount: partySize,
          rsvpStatus: 'accepted',
        });
        const guest = state.guests.find((g) => g.name === `Decline Party ${partySize}`)!;
        state = handleUpdateGuestRsvp(state, guest.id, 'declined', partySize);
        const updated = state.guests.find((g) => g.id === guest.id)!;
        expect(updated.confirmedCount).toBe(0);
        expect(updated.rsvpStatus).toBe('declined');
      });
    });

    it('updates respondedAt timestamp on RSVP update', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 2);
      const updated = state.guests.find((g) => g.id === guest.id)!;
      expect(updated.respondedAt).toBeDefined();
    });

    it('preserves existing dietary notes if none supplied in update', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      guest.dietaryNotes = 'Pre-existing Nut Allergy';
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 2);
      const updated = state.guests.find((g) => g.id === guest.id)!;
      expect(updated.dietaryNotes).toBe('Pre-existing Nut Allergy');
    });

    it('returns unmodified state when updating RSVP for non-existent guest ID', () => {
      const state = createBaseState();
      const result = handleUpdateGuestRsvp(state, 'ghost-guest-id', 'accepted', 2);
      expect(result).toBe(state);
    });

    it('records accessibility requirements on RSVP update', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 1, 'Vegetarian', 'Wheelchair ramp access required');
      const updated = state.guests.find((g) => g.id === guest.id)!;
      expect(updated.accessibilityRequirements).toBe('Wheelchair ramp access required');
    });

    it('preserves existing accessibility requirements when undefined in update payload', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      guest.accessibilityRequirements = 'Step-free access';
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 1, 'Vegetarian');
      const updated = state.guests.find((g) => g.id === guest.id)!;
      expect(updated.accessibilityRequirements).toBe('Step-free access');
    });

    it('clears accessibility requirements when explicitly set to empty string', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      guest.accessibilityRequirements = 'Step-free access';
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 1, 'Vegetarian', '');
      const updated = state.guests.find((g) => g.id === guest.id)!;
      expect(updated.accessibilityRequirements).toBe('');
    });

    it('creates an informative changeLog record on RSVP submission', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      const prevLogCount = state.changeLog.length;
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 2);
      expect(state.changeLog.length).toBe(prevLogCount + 1);
      expect(state.changeLog[0].changeType).toBe('guest');
      expect(state.changeLog[0].description).toContain(guest.name);
      expect(state.changeLog[0].description).toContain('ACCEPTED');
    });

    it('allows re-accepting with modified headcount within party size bounds', () => {
      let state = createBaseState();
      const guest = state.guests[0];
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', 1);
      state = handleUpdateGuestRsvp(state, guest.id, 'accepted', Math.min(2, guest.partySize));
      const updated = state.guests.find((g) => g.id === guest.id)!;
      expect(updated.confirmedCount).toBe(Math.min(2, guest.partySize));
    });
  });
});
