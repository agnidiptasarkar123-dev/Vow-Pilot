import { AppState, ChangeRecord, TimelineItem } from '../../types';

export function handleAddTimelineItem(
  state: AppState,
  itemInput: Omit<TimelineItem, 'id' | 'orderIndex'>
): AppState {
  const existingTimeline = state.timeline || [];
  const now = new Date().toISOString();
  const id = `tml-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const newItem: TimelineItem = {
    ...itemInput,
    id,
    orderIndex: existingTimeline.length + 1,
  };

  const sorted = [...existingTimeline, newItem].sort((a, b) => a.time.localeCompare(b.time));
  const reIndexed = sorted.map((item, idx) => ({ ...item, orderIndex: idx + 1 }));

  const changeRecord: ChangeRecord = {
    id: `chg-tml-${Date.now()}`,
    timestamp: now,
    changeType: 'timeline',
    description: `Added schedule activity "${newItem.activity}" at ${newItem.time}.`,
    deltaSummary: `Duration: ${newItem.durationMinutes} mins.`,
  };

  return {
    ...state,
    timeline: reIndexed,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleUpdateTimelineItem(state: AppState, item: TimelineItem): AppState {
  const existingTimeline = state.timeline || [];
  const index = existingTimeline.findIndex((t) => t.id === item.id);
  if (index === -1) return state;

  const now = new Date().toISOString();
  const updatedList = [...existingTimeline];
  updatedList[index] = item;

  const sorted = updatedList.sort((a, b) => a.time.localeCompare(b.time));
  const reIndexed = sorted.map((t, idx) => ({ ...t, orderIndex: idx + 1 }));

  const changeRecord: ChangeRecord = {
    id: `chg-tml-${Date.now()}`,
    timestamp: now,
    changeType: 'timeline',
    description: `Updated schedule activity "${item.activity}".`,
  };

  return {
    ...state,
    timeline: reIndexed,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleDeleteTimelineItem(state: AppState, itemId: string): AppState {
  const existingTimeline = state.timeline || [];
  const target = existingTimeline.find((t) => t.id === itemId);
  if (!target) return state;

  const now = new Date().toISOString();
  const remaining = existingTimeline
    .filter((t) => t.id !== itemId)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((t, idx) => ({ ...t, orderIndex: idx + 1 }));

  const changeRecord: ChangeRecord = {
    id: `chg-tml-${Date.now()}`,
    timestamp: now,
    changeType: 'timeline',
    description: `Removed schedule activity "${target.activity}".`,
  };

  return {
    ...state,
    timeline: remaining,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleReorderTimeline(state: AppState, itemIds: string[]): AppState {
  const existingTimeline = state.timeline || [];
  const itemMap = new Map(existingTimeline.map((item) => [item.id, item]));

  const reordered: TimelineItem[] = [];
  itemIds.forEach((id, idx) => {
    const item = itemMap.get(id);
    if (item) {
      reordered.push({ ...item, orderIndex: idx + 1 });
    }
  });

  return {
    ...state,
    timeline: reordered,
  };
}

/**
 * Checks for timeline schedule conflicts or overlaps.
 * Returns array of conflict warning messages.
 */
export function detectTimelineConflicts(timeline: TimelineItem[]): string[] {
  const conflicts: string[] = [];
  if (!timeline || timeline.length < 2) return conflicts;

  const sorted = [...timeline].sort((a, b) => a.time.localeCompare(b.time));

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    // Parse HH:mm to minutes from midnight
    const [cHours, cMins] = current.time.split(':').map((v) => parseInt(v, 10));
    const [nHours, nMins] = next.time.split(':').map((v) => parseInt(v, 10));

    if (!isNaN(cHours) && !isNaN(cMins) && !isNaN(nHours) && !isNaN(nMins)) {
      const currentStart = cHours * 60 + cMins;
      const currentEnd = currentStart + current.durationMinutes;
      const nextStart = nHours * 60 + nMins;

      if (currentEnd > nextStart) {
        conflicts.push(
          `Schedule Overlap: "${current.activity}" (${current.time}, ${current.durationMinutes}m) overlaps with "${next.activity}" (${next.time}) by ${currentEnd - nextStart} minutes.`
        );
      }
    }
  }

  return conflicts;
}
