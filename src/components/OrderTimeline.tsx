import Link from "next/link";
import type { TimelineEvent } from "@/lib/orderTimeline";

// Small hand-written inline icons, matching the same zero-dependency
// approach already used on the Dashboard — no icon library added.
function Icon({ name, className }: { name: string; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
  switch (name) {
    case "box":
      return <svg {...common}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>;
    case "hammer":
      return <svg {...common}><path d="M14.5 3.5l6 6L18 12l-6-6 2.5-2.5z" /><path d="M13 8L4 17l3 3 9-9" /></svg>;
    case "check-circle":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></svg>;
    case "message":
      return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.3 8.3 0 0 1-3.8-.9L3 21l1.9-5.7a8.3 8.3 0 0 1-.9-3.8A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" /></svg>;
    case "dollar":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 1.4 1.3 1.9 3 2.2 1.7.3 3 .9 3 2.3 0 1.3-1.3 2.2-3 2.2s-3-1-3-2.4" /></svg>;
    case "layers":
      return <svg {...common}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>;
    default:
      return null;
  }
}

export default function OrderTimeline({
  events,
  title = "Order activity timeline",
  subtitle = "The complete history of this order, newest first.",
  showOrderLabel = false
}: {
  events: TimelineEvent[];
  title?: string;
  subtitle?: string;
  showOrderLabel?: boolean;
}) {
  return (
    <div>
      <h2 className="font-display text-lg text-[#1E3A5F] mb-2">{title}</h2>
      <p className="text-xs text-[#1E3A5F]/50 mb-3">{subtitle}</p>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm overflow-hidden">
        {events.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">No activity recorded yet.</p>
        )}
        {events.map((ev, i) => (
          <div key={i} className="flex gap-3 px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0">
            <div className={`w-7 h-7 rounded-full bg-[#1E3A5F]/5 flex items-center justify-center flex-shrink-0 ${ev.color}`}>
              <Icon name={ev.icon} className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-semibold text-[#1E3A5F]">{ev.label}</div>
                <div className="text-[11px] text-[#1E3A5F]/40 font-mono whitespace-nowrap">
                  {new Date(ev.timestamp).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {new Date(ev.timestamp).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET
                </div>
              </div>
              {showOrderLabel && ev.orderId && (
                <Link href={`/admin/orders/${ev.orderId}`} className="text-xs text-ember hover:underline">
                  {ev.orderLabel}
                </Link>
              )}
              {ev.detail && <div className="text-xs text-[#1E3A5F]/60 mt-0.5 truncate">{ev.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
