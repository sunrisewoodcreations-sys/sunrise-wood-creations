"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";

type DayUtilization = {
  date: string;
  workloadMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number;
  isOverbooked: boolean;
  isBlocked: boolean;
};

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function barColor(day: DayUtilization): string {
  if (day.isBlocked) return "bg-[#1E3A5F]/20";
  if (day.isOverbooked) return "bg-ember";
  if (day.utilizationPercent >= 80) return "bg-amber";
  return "bg-sage";
}

export default function ProductionCapacityForm({
  settings,
  usableMinutesPerDay,
  utilization
}: {
  settings: { max_hours_per_day: number; buffer_minutes_per_day: number };
  usableMinutesPerDay: number;
  utilization: DayUtilization[];
}) {
  const router = useRouter();
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(String(settings.max_hours_per_day));
  const [bufferMinutesPerDay, setBufferMinutesPerDay] = useState(String(settings.buffer_minutes_per_day));
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  async function handleSave() {
    setLoading(true);
    setSaveMessage("");
    const res = await fetch("/api/production-capacity-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxHoursPerDay, bufferMinutesPerDay })
    });
    setLoading(false);
    if (res.ok) {
      setSaveMessage("Saved.");
      router.refresh();
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Production Capacity</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        How much work can realistically get done each day — used to warn about overloaded schedules and suggest realistic completion dates.
      </p>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Max production hours per day</label>
            <input value={maxHoursPerDay} onChange={e => setMaxHoursPerDay(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Buffer minutes per day</label>
            <input value={bufferMinutesPerDay} onChange={e => setBufferMinutesPerDay(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#1E3A5F] mb-1">Usable capacity per day</div>
            <div className="text-2xl font-display text-[#1E3A5F] pt-1.5">{formatHours(usableMinutesPerDay)}</div>
          </div>
        </div>
        <p className="text-[11px] text-[#1E3A5F]/50 mb-3">
          Estimated build time per product is set on each product's own page. Days off (holidays, vacation) are managed on the Pickup Settings page — the same closed days apply to production too.
        </p>
        <div className="flex items-center gap-3">
          <AdminButton onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save settings"}</AdminButton>
          {saveMessage && <span className="text-sm font-semibold text-sage">{saveMessage}</span>}
        </div>
      </div>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
        <h2 className="font-display text-base text-[#1E3A5F] mb-3">Next 14 days</h2>
        <div className="space-y-2">
          {utilization.map(day => (
            <div key={day.date} className="flex items-center gap-3">
              <div className="w-20 text-xs text-[#1E3A5F]/60 flex-shrink-0">
                {new Date(day.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="flex-1 bg-[#1E3A5F]/5 rounded-full h-5 overflow-hidden">
                <div className={`h-full rounded-full ${barColor(day)}`} style={{ width: `${Math.max(day.isBlocked ? 100 : day.utilizationPercent, 4)}%` }} />
              </div>
              <div className="w-24 text-right text-xs font-semibold text-[#1E3A5F] flex-shrink-0">
                {day.isBlocked ? "Closed" : day.isOverbooked ? "Overbooked" : `${day.utilizationPercent}% full`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
