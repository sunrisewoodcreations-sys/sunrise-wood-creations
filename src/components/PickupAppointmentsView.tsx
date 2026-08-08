"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type DaySlots = { date: string; times: string[] };
type Appointment = {
  id: string;
  order_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  source: string;
  internal_notes: string | null;
  orders: { id: string; title: string; product_type: string; profiles: { full_name: string; phone: string | null } } | null;
};

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function PickupAppointmentsView({ appointments, availableDays, todayStr }: { appointments: Appointment[]; availableDays: DaySlots[]; todayStr: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function handleSaveNotes(id: string) {
    await handleAction(id, "update_notes", undefined, notesDraft[id] ?? "");
  }

  async function handleAction(id: string, action: string, extra?: { dateStr: string; time: string }, notes?: string) {
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/pickup-appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra, ...(notes !== undefined ? { notes } : {}) })
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error || "That action failed.");
      return;
    }
    if (body.emailWarning) setError(`Saved, but the confirmation email failed: ${body.emailWarning}`);
    setReschedulingId(null);
    router.refresh();
  }

  const todayAppointments = appointments.filter(a => a.appointment_date === todayStr);
  const upcomingAppointments = appointments.filter(a => a.appointment_date !== todayStr);

  function renderAppointment(a: Appointment) {
    const isBusy = busyId === a.id;
    const isRescheduling = reschedulingId === a.id;
    return (
      <div key={a.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <Link href={`/admin/orders/${a.order_id}`} className="font-semibold text-[#1E3A5F] hover:underline">
              {a.orders?.profiles?.full_name || "Unknown"}
            </Link>
            <div className="text-xs text-[#1E3A5F]/50">
              {a.orders?.title} · {new Date(a.appointment_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {formatTimeDisplay(a.appointment_time)}
              {a.orders?.profiles?.phone && <> · {a.orders.profiles.phone}</>}
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap capitalize ${a.status === "arrived" ? "bg-[#1E3A5F] text-white" : "bg-sage/20 text-sage"}`}>
            {a.status}
          </span>
        </div>

        {a.source === "customer_token_link" || a.source === "customer_account" ? (
          <span className="text-[10px] text-[#1E3A5F]/40 italic">Scheduled by customer</span>
        ) : (
          <span className="text-[10px] text-[#1E3A5F]/40 italic">Scheduled by admin</span>
        )}

        {isRescheduling && (
          <div className="mt-3 bg-cream rounded-lg p-3">
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1.5">New day</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {availableDays.slice(0, 10).map(d => (
                <button
                  key={d.date}
                  onClick={() => { setRescheduleDate(d.date); setRescheduleTime(""); }}
                  className={`px-2 py-1 rounded text-xs font-semibold border ${rescheduleDate === d.date ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20"}`}
                >
                  {new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </button>
              ))}
            </div>
            {rescheduleDate && (
              <>
                <label className="block text-xs font-semibold text-[#1E3A5F] mb-1.5">New time</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {availableDays.find(d => d.date === rescheduleDate)?.times.map(t => (
                    <button
                      key={t}
                      onClick={() => setRescheduleTime(t)}
                      className={`px-2 py-1 rounded text-xs font-semibold border ${rescheduleTime === t ? "bg-sage text-white border-sage" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20"}`}
                    >
                      {formatTimeDisplay(t)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(a.id, "reschedule", { dateStr: rescheduleDate, time: rescheduleTime })}
                disabled={!rescheduleDate || !rescheduleTime || isBusy}
                className="bg-[#1E3A5F] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                Confirm new time
              </button>
              <button onClick={() => setReschedulingId(null)} className="text-xs font-semibold text-[#1E3A5F]/60">Cancel</button>
            </div>
          </div>
        )}

        {!isRescheduling && (
          <div className="mt-3">
            <label className="block text-[10px] font-semibold text-[#1E3A5F]/50 uppercase mb-1">Internal notes (not visible to customer)</label>
            <div className="flex gap-2">
              <input
                value={notesDraft[a.id] ?? a.internal_notes ?? ""}
                onChange={e => setNotesDraft(prev => ({ ...prev, [a.id]: e.target.value }))}
                placeholder="e.g. Help load, call when arriving..."
                className="flex-1 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs"
              />
              <button onClick={() => handleSaveNotes(a.id)} disabled={isBusy} className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5">
                Save
              </button>
            </div>
          </div>
        )}

        {!isRescheduling && (
          <div className="flex flex-wrap gap-2 mt-3">
            {a.status === "scheduled" && (
              <button onClick={() => handleAction(a.id, "mark_arrived")} disabled={isBusy} className="bg-[#1E3A5F] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                Mark Arrived
              </button>
            )}
            <button onClick={() => handleAction(a.id, "mark_completed")} disabled={isBusy} className="bg-sage text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
              Mark Picked Up
            </button>
            <button onClick={() => { setReschedulingId(a.id); setRescheduleDate(""); setRescheduleTime(""); }} disabled={isBusy} className="border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-3 py-1.5 text-xs font-semibold">
              Reschedule
            </button>
            <button onClick={() => handleAction(a.id, "mark_missed")} disabled={isBusy} className="border border-ember/40 text-ember rounded-md px-3 py-1.5 text-xs font-semibold">
              No Show
            </button>
            <button onClick={() => handleAction(a.id, "cancel")} disabled={isBusy} className="text-xs font-semibold text-[#1E3A5F]/50 underline">
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Pickup Appointments</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Every scheduled pickup, reschedule or close out right from here.</p>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="mb-6">
        <h2 className="font-display text-lg text-[#1E3A5F] mb-2">Today ({todayAppointments.length})</h2>
        {todayAppointments.length === 0 ? (
          <p className="text-sm text-[#1E3A5F]/50">No pickups scheduled for today.</p>
        ) : (
          <div className="space-y-3">{todayAppointments.map(renderAppointment)}</div>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg text-[#1E3A5F] mb-2">Upcoming ({upcomingAppointments.length})</h2>
        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-[#1E3A5F]/50">Nothing else scheduled yet.</p>
        ) : (
          <div className="space-y-3">{upcomingAppointments.map(renderAppointment)}</div>
        )}
      </div>
    </div>
  );
}
