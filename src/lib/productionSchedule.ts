// Shared display logic for the Production Schedule hub — labels and
// colors for the internal production_status and priority fields, kept
// in one place so the calendar, day view, and cards all agree.

export const PRODUCTION_STATUSES = [
  { key: "waiting", label: "Waiting" },
  { key: "building", label: "Building" },
  { key: "assembly", label: "Assembly" },
  { key: "finishing", label: "Finishing" },
  { key: "ready_for_pickup", label: "Ready for Pickup" },
  { key: "completed", label: "Completed" }
];

export function productionStatusLabel(status: string): string {
  return PRODUCTION_STATUSES.find(s => s.key === status)?.label || status;
}

export function productionStatusColor(status: string): string {
  switch (status) {
    case "waiting": return "bg-[#1E3A5F]/10 text-[#1E3A5F]";
    case "building": return "bg-amber text-white";
    case "assembly": return "bg-amber/80 text-white";
    case "finishing": return "bg-ember/80 text-white";
    case "ready_for_pickup": return "bg-sage text-white";
    case "completed": return "bg-[#1E3A5F]/5 text-[#1E3A5F]/50";
    default: return "bg-[#1E3A5F]/10 text-[#1E3A5F]";
  }
}

export const PRIORITIES = [
  { key: "high", label: "High" },
  { key: "normal", label: "Normal" },
  { key: "low", label: "Low" }
];

export function priorityColor(priority: string): string {
  switch (priority) {
    case "high": return "bg-ember text-white";
    case "low": return "bg-[#1E3A5F]/10 text-[#1E3A5F]/60";
    default: return "bg-[#1E3A5F]/10 text-[#1E3A5F]";
  }
}

// Same Eastern-time-safe date-string helpers already duplicated across
// every other date-sensitive admin page in this app.
export function easternDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value),
    day: Number(parts.find(p => p.type === "day")?.value)
  };
}

export function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
