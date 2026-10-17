// Plain, non-client-component home for the priority badge styles/labels
// shared between server and client components. These used to live only
// inside ProductionSchedule.tsx ("use client"), which worked fine for
// other client components importing them, but broke the Manufacturing
// Queue page — a server component can't index into a value imported
// from a client module. Moving them here (a plain module, no directive)
// lets both kinds of components use them safely.
export const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-ember text-white",
  normal: "bg-[#2E2420]/10 text-[#2E2420]/60",
  low: "bg-[#2E2420]/5 text-[#2E2420]/40"
};
export const PRIORITY_LABELS: Record<string, string> = { high: "High", normal: "Normal", low: "Low" };
