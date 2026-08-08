// The Production Queue's automatic multi-factor sort. A pure,
// standalone comparator so it can be unit-tested directly and reused
// anywhere the queue needs to be ordered — the page itself just calls
// this and doesn't own any of the ranking logic.

export type QueueSortableOrder = {
  id: string;
  priority: string | null; // "high" | "normal" | "low"
  dueDate: string | null;
  hasScheduledPickup: boolean;
  isPriorityCustomer: boolean;
  materialsAvailable: boolean;
  manualQueuePosition: number | null;
};

// Orders with a manual position float to the top, in that exact
// relative order (a straightforward, predictable rule — manually
// pinned work always comes first). Everything else is ranked by the
// automatic factors, in the precedence order requested: rush first,
// then earliest promised date, then whether pickup is already on the
// books, then customer priority, then material readiness.
export function sortProductionQueue<T extends QueueSortableOrder>(orders: T[]): T[] {
  const pinned = orders.filter(o => o.manualQueuePosition != null)
    .sort((a, b) => (a.manualQueuePosition as number) - (b.manualQueuePosition as number));
  const unpinned = orders.filter(o => o.manualQueuePosition == null);

  unpinned.sort((a, b) => {
    const rushA = a.priority === "high" ? 0 : 1;
    const rushB = b.priority === "high" ? 0 : 1;
    if (rushA !== rushB) return rushA - rushB;

    const dateA = a.dueDate || "9999-99-99";
    const dateB = b.dueDate || "9999-99-99";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const pickupA = a.hasScheduledPickup ? 0 : 1;
    const pickupB = b.hasScheduledPickup ? 0 : 1;
    if (pickupA !== pickupB) return pickupA - pickupB;

    const custA = a.isPriorityCustomer ? 0 : 1;
    const custB = b.isPriorityCustomer ? 0 : 1;
    if (custA !== custB) return custA - custB;

    const matA = a.materialsAvailable ? 0 : 1;
    const matB = b.materialsAvailable ? 0 : 1;
    return matA - matB;
  });

  return [...pinned, ...unpinned];
}

// The production_status progression a "Next Stage" action moves
// through — same values already used throughout the app (Production
// Schedule, Manufacturing Queue), just now with an explicit sequence
// so advancing one step at a time is possible instead of only
// "waiting" or fully "completed".
export const PRODUCTION_STAGE_SEQUENCE = ["waiting", "building", "assembly", "finishing", "ready_for_pickup", "completed"] as const;

export function getNextProductionStage(current: string): string | null {
  const idx = PRODUCTION_STAGE_SEQUENCE.indexOf(current as any);
  if (idx === -1 || idx === PRODUCTION_STAGE_SEQUENCE.length - 1) return null;
  return PRODUCTION_STAGE_SEQUENCE[idx + 1];
}
