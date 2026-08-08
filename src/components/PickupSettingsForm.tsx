"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";

const WEEKDAYS = [
  { value: 0, label: "Sun" }, { value: 1, label: "Mon" }, { value: 2, label: "Tue" },
  { value: 3, label: "Wed" }, { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" }
];

type Settings = {
  id: string;
  business_address: string;
  contact_phone: string;
  pickup_instructions: string;
  available_days: number[];
  start_time: string;
  end_time: string;
  slot_length_minutes: number;
  max_pickups_per_slot: number;
  send_2hour_reminder: boolean;
  vacation_mode_enabled: boolean;
  vacation_return_date: string | null;
};
type BlockedDate = { id: string; blocked_date: string; reason: string | null };

export default function PickupSettingsForm({ settings, blockedDates }: { settings: Settings; blockedDates: BlockedDate[] }) {
  const router = useRouter();

  const [businessAddress, setBusinessAddress] = useState(settings.business_address);
  const [contactPhone, setContactPhone] = useState(settings.contact_phone);
  const [pickupInstructions, setPickupInstructions] = useState(settings.pickup_instructions);
  const [availableDays, setAvailableDays] = useState<number[]>(settings.available_days);
  const [startTime, setStartTime] = useState(settings.start_time);
  const [endTime, setEndTime] = useState(settings.end_time);
  const [slotLengthMinutes, setSlotLengthMinutes] = useState(String(settings.slot_length_minutes));
  const [maxPickupsPerSlot, setMaxPickupsPerSlot] = useState(String(settings.max_pickups_per_slot));
  const [send2hourReminder, setSend2hourReminder] = useState(settings.send_2hour_reminder);
  const [vacationModeEnabled, setVacationModeEnabled] = useState(settings.vacation_mode_enabled);
  const [vacationReturnDate, setVacationReturnDate] = useState(settings.vacation_return_date || "");

  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");

  function toggleDay(day: number) {
    setAvailableDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()));
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    setSaveMessage("");
    const res = await fetch("/api/pickup-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessAddress, contactPhone, pickupInstructions, availableDays,
        startTime, endTime, slotLengthMinutes, maxPickupsPerSlot, send2hourReminder,
        vacationModeEnabled, vacationReturnDate
      })
    });
    setLoading(false);
    if (res.ok) {
      setSaveMessage("Saved.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save settings.");
    }
  }

  async function handleAddBlockedDate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBlockedDate) return;
    const res = await fetch("/api/pickup-blocked-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newBlockedDate, reason: newBlockedReason })
    });
    if (res.ok) {
      setNewBlockedDate("");
      setNewBlockedReason("");
      router.refresh();
    }
  }

  async function handleRemoveBlockedDate(id: string) {
    await fetch(`/api/pickup-blocked-dates/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Pickup Scheduling Settings</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Controls what customers see and can book on the pickup scheduling page.</p>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 space-y-5 mb-6">
        <div>
          <h2 className="font-display text-base text-[#1E3A5F] mb-3">Business info shown to customers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Business address</label>
              <input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Contact phone</label>
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Pickup instructions</label>
            <textarea value={pickupInstructions} onChange={e => setPickupInstructions(e.target.value)} rows={2} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="pt-4 border-t border-[#1E3A5F]/10">
          <h2 className="font-display text-base text-[#1E3A5F] mb-3">Availability</h2>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1.5">Available pickup days</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {WEEKDAYS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  availableDays.includes(d.value) ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Start time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">End time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Appointment length (min)</label>
              <input value={slotLengthMinutes} onChange={e => setSlotLengthMinutes(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Max per time slot</label>
              <input value={maxPickupsPerSlot} onChange={e => setMaxPickupsPerSlot(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#1E3A5F]/10">
          <h2 className="font-display text-base text-[#1E3A5F] mb-2">Customer reminders</h2>
          <p className="text-xs text-[#1E3A5F]/50 mb-2">A reminder email always goes out 24 hours before a scheduled pickup.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={send2hourReminder} onChange={e => setSend2hourReminder(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm font-semibold text-[#1E3A5F]">Also send a reminder 2 hours before pickup</span>
          </label>
        </div>

        <div className="pt-4 border-t border-[#1E3A5F]/10">
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={vacationModeEnabled} onChange={e => setVacationModeEnabled(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm font-semibold text-[#1E3A5F]">Vacation mode — disable all scheduling</span>
          </label>
          {vacationModeEnabled && (
            <div className="ml-6">
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Resume scheduling on (optional)</label>
              <input type="date" value={vacationReturnDate} onChange={e => setVacationReturnDate(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
              <p className="text-[11px] text-[#1E3A5F]/50 mt-1">Leave blank to stay closed until you turn this off manually.</p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        <div className="flex items-center gap-3 pt-2">
          <AdminButton onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save settings"}</AdminButton>
          {saveMessage && <span className="text-sm font-semibold text-sage">{saveMessage}</span>}
        </div>
      </div>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
        <h2 className="font-display text-base text-[#1E3A5F] mb-3">Holidays &amp; blocked dates</h2>
        <form onSubmit={handleAddBlockedDate} className="flex flex-wrap items-end gap-2 mb-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Date</label>
            <input type="date" required value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Reason (optional)</label>
            <input value={newBlockedReason} onChange={e => setNewBlockedReason(e.target.value)} placeholder="e.g. Thanksgiving" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <AdminButton type="submit">Block date</AdminButton>
        </form>
        {blockedDates.length === 0 ? (
          <p className="text-sm text-[#1E3A5F]/50">No upcoming blocked dates.</p>
        ) : (
          <div className="space-y-1.5">
            {blockedDates.map(bd => (
              <div key={bd.id} className="flex items-center justify-between bg-cream/40 rounded-md px-3 py-2 text-sm">
                <span className="text-[#1E3A5F]">
                  {new Date(bd.blocked_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {bd.reason && <span className="text-[#1E3A5F]/50"> — {bd.reason}</span>}
                </span>
                <button onClick={() => handleRemoveBlockedDate(bd.id)} className="text-xs font-semibold text-ember hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
