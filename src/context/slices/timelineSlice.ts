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
 * Checks for timeline schedule conflicts, overlaps, resource clashes, and invalid times.
 * Returns array of conflict warning messages.
 */
export function detectTimelineConflicts(timeline: TimelineItem[]): string[] {
  const conflicts: string[] = [];
  if (!timeline || timeline.length === 0) return conflicts;

  // Validate individual item times and durations
  for (const item of timeline) {
    if (!item.time || typeof item.time !== 'string') {
      conflicts.push(`Invalid Time: Activity "${item.activity}" is missing a valid time.`);
      continue;
    }
    const [hours, mins] = item.time.split(':').map((v) => parseInt(v, 10));
    if (isNaN(hours) || isNaN(mins) || hours < 0 || hours > 23 || mins < 0 || mins > 59) {
      conflicts.push(`Invalid Time Format: Activity "${item.activity}" has invalid time "${item.time}".`);
    }
    if (typeof item.durationMinutes !== 'number' || isNaN(item.durationMinutes) || item.durationMinutes < 0) {
      conflicts.push(`Invalid Duration: Activity "${item.activity}" has invalid duration (${item.durationMinutes}m).`);
    }
  }

  if (timeline.length < 2) return conflicts;

  const sorted = [...timeline].sort((a, b) => a.time.localeCompare(b.time));

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const [cHours, cMins] = current.time.split(':').map((v) => parseInt(v, 10));
    if (isNaN(cHours) || isNaN(cMins) || cHours < 0 || cHours > 23 || cMins < 0 || cMins > 59) {
      continue;
    }
    const safeDuration = Math.max(0, current.durationMinutes || 0);
    const currentStart = cHours * 60 + cMins;
    const currentEnd = currentStart + safeDuration;

    // Check against ALL subsequent overlapping activities, not just the immediately adjacent one
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      const [nHours, nMins] = next.time.split(':').map((v) => parseInt(v, 10));
      if (isNaN(nHours) || isNaN(nMins) || nHours < 0 || nHours > 23 || nMins < 0 || nMins > 59) {
        continue;
      }
      const nextStart = nHours * 60 + nMins;

      // Because sorted chronologically, once nextStart exceeds or equals currentEnd,
      // no subsequent activity can overlap with current unless same start time.
      if (nextStart >= currentEnd) {
        break;
      }

      const overlapMinutes = currentEnd - nextStart;
      let conflictMsg = `Schedule Overlap: "${current.activity}" (${current.time}, ${current.durationMinutes}m) overlaps with "${next.activity}" (${next.time}) by ${overlapMinutes} minutes.`;

      if (
        current.location &&
        next.location &&
        current.location.trim().toLowerCase() === next.location.trim().toLowerCase()
      ) {
        conflictMsg += ` [Location Clash: "${current.location}"]`;
      }
      if (
        current.assignedPerson &&
        next.assignedPerson &&
        current.assignedPerson.trim().toLowerCase() === next.assignedPerson.trim().toLowerCase()
      ) {
        conflictMsg += ` [Personnel Conflict: "${current.assignedPerson}"]`;
      }
      if (current.vendorId && next.vendorId && current.vendorId === next.vendorId) {
        conflictMsg += ` [Vendor Conflict]`;
      }

      conflicts.push(conflictMsg);
    }
  }

  return conflicts;
}

export function handleApplyTimelinePreset(
  state: AppState,
  newItems: Array<Omit<TimelineItem, 'id'>>,
  strategy: 'replace' | 'append'
): AppState {
  const existingTimeline = state.timeline || [];
  const now = new Date().toISOString();

  let finalItems: TimelineItem[] = [];

  if (strategy === 'append') {
    const existingMapped = [...existingTimeline];
    const startingIndex = existingMapped.length + 1;
    const mappedNew: TimelineItem[] = newItems.map((item, idx) => ({
      ...item,
      id: `tml-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
      orderIndex: startingIndex + idx,
    }));
    finalItems = [...existingMapped, ...mappedNew].sort((a, b) => a.time.localeCompare(b.time));
  } else {
    // Replace strategy
    finalItems = newItems
      .map((item, idx) => ({
        ...item,
        id: `tml-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
        orderIndex: idx + 1,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  const reIndexed = finalItems.map((item, idx) => ({ ...item, orderIndex: idx + 1 }));

  const changeRecord: ChangeRecord = {
    id: `chg-tml-${Date.now()}`,
    timestamp: now,
    changeType: 'timeline',
    description: `Applied starter run sheet template (${strategy === 'append' ? 'Appended' : 'Replaced'}, ${newItems.length} activities).`,
  };

  return {
    ...state,
    timeline: reIndexed,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

