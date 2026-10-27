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
  appointment_type: "pickup" | "delivery";
  on_my_way_at: string | null;
  orders: { id: string; title: string; product_type: string; delivery_address: string | null; profiles: { full_name: string; phone: string | null } } | null;
};
type StopCandidate = { id: string; title: string; customerName: string; address: string };
type BlockedTime = { id: string; blocked_date: string; start_time: string; end_time: string; reason: string | null };

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function PickupAppointmentsView({ appointments, slotsByAppointment, stopCandidates, blockedTimes, todayStr }: {
  appointments: Appointment[];
  slotsByAppointment: Record<string, DaySlots[]>;
  stopCandidates: StopCandidate[];
  blockedTimes: BlockedTime[];
  todayStr: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [stopForId, setStopForId] = useState<string | null>(null);
  const [stopOrderId, setStopOrderId] = useState("");
  const [stopAddress, setStopAddress] = useState("");
  const [stopSuggestion, setStopSuggestion] = useState<{ address: string; reason: string } | null>(null);
  const [blockDate, setBlockDate] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(false);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("14:00");
  const [blockReason, setBlockReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);

  async function handleAddBlock() {
    setBlockBusy(true);
    setError("");
    const res = await fetch("/api/schedule-blocked-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: blockDate, allDay: blockAllDay, startTime: blockStart, endTime: blockEnd, reason: blockReason })
    });
    const body = await res.json().catch(() => ({}));
    setBlockBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't block that time."); return; }
    if (body.existingAppointmentsInRange > 0) {
      setError(`Blocked. Heads up: ${body.existingAppointmentsInRange} appointment(s) are already booked in that range — reschedule them below.`);
    }
    setBlockReason("");
    router.refresh();
  }

  async function handleRemoveBlock(id: string) {
    setBlockBusy(true);
    await fetch(`/api/schedule-blocked-times/${id}`, { method: "DELETE" });
    setBlockBusy(false);
    router.refresh();
  }

  async function handleAddStop(id: string, confirm = false, addr = stopAddress) {
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/pickup-appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_stop_home", secondOrderId: stopOrderId, secondAddress: addr, confirmAddress: confirm })
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (body.needsConfirmation) { setStopSuggestion({ address: body.suggestedAddress, reason: body.reason }); return; }
    if (!res.ok) { setError(body.error || "Couldn't add that stop."); return; }
    if (body.emailWarning) setError(`Stop added, but the confirmation email failed: ${body.emailWarning}`);
    setStopForId(null); setStopOrderId(""); setStopAddress(""); setStopSuggestion(null);
    router.refresh();
  }

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
              <span className={`font-bold ${a.appointment_type === "delivery" ? "text-ember" : "text-sage"}`}>{a.appointment_type === "delivery" ? "DELIVERY" : "PICKUP"}</span> · {a.orders?.title} · {new Date(a.appointment_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {formatTimeDisplay(a.appointment_time)}
              {a.orders?.profiles?.phone && <> · {a.orders.profiles.phone}</>}
            </div>
            {a.appointment_type === "delivery" && a.orders?.delivery_address && (
              <div className="text-xs text-[#1E3A5F]/70 mt-0.5">📍 {a.orders.delivery_address}</div>
            )}
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${a.on_my_way_at ? "bg-ember text-white" : a.status === "arrived" ? "bg-[#1E3A5F] text-white" : "bg-sage/20 text-sage"}`}>
            {a.on_my_way_at ? "On my way" : a.status === "arrived" ? "Arrived" : "Scheduled"}
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
              {(slotsByAppointment[a.id] || []).slice(0, 10).map(d => (
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
                  {(slotsByAppointment[a.id] || []).find(d => d.date === rescheduleDate)?.times.map(t => (
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

        {stopForId === a.id && (
          <div className="mt-3 bg-cream rounded-lg p-3 space-y-2">
            <p className="text-xs text-[#1E3A5F]/70">Drops another delivery right after this one, skipping the drive home in between. The second stop's time is worked out from the drive between the two addresses.</p>
            <select value={stopOrderId} onChange={e => setStopOrderId(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs bg-white">
              <option value="">Choose the second order…</option>
              {stopCandidates.map(c => <option key={c.id} value={c.id}>{c.customerName} — {c.title}</option>)}
            </select>
            {stopOrderId && !stopCandidates.find(c => c.id === stopOrderId)?.address && (
              <input value={stopAddress} onChange={e => { setStopAddress(e.target.value); setStopSuggestion(null); }} placeholder="Second delivery address" className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs" />
            )}
            {stopSuggestion && (
              <div className="bg-amber/10 border border-amber/30 rounded-md p-2 text-xs">
                <p className="mb-1">{stopSuggestion.reason} Use <strong>{stopSuggestion.address}</strong>?</p>
                <button onClick={() => { setStopAddress(stopSuggestion.address); handleAddStop(a.id, true, stopSuggestion.address); }} className="bg-sage text-white rounded px-2 py-1 font-bold">Yes, use it</button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => handleAddStop(a.id)} disabled={!stopOrderId || isBusy} className="bg-[#1E3A5F] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">Add stop</button>
              <button onClick={() => setStopForId(null)} className="text-xs font-semibold text-[#1E3A5F]/60">Cancel</button>
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
            {a.appointment_type === "delivery" && a.status === "scheduled" && (
              a.on_my_way_at ? (
                <button onClick={() => handleAction(a.id, "clear_on_my_way")} disabled={isBusy} className="border border-ember/40 text-ember rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                  Undo "On my way"
                </button>
              ) : (
                <button onClick={() => handleAction(a.id, "on_my_way")} disabled={isBusy} className="bg-ember text-white rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-60">
                  🚚 On my way
                </button>
              )
            )}
            {a.status === "scheduled" && (
              <button onClick={() => handleAction(a.id, "mark_arrived")} disabled={isBusy} className="bg-[#1E3A5F] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                Mark Arrived
              </button>
            )}
            <button onClick={() => handleAction(a.id, "mark_completed")} disabled={isBusy} className="bg-sage text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
              {a.appointment_type === "delivery" ? "Mark Delivered" : "Mark Picked Up"}
            </button>
            {a.appointment_type === "delivery" && stopCandidates.length > 0 && (
              <button onClick={() => { setStopForId(stopForId === a.id ? null : a.id); setStopOrderId(""); setStopAddress(""); setStopSuggestion(null); }} disabled={isBusy} className="border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-3 py-1.5 text-xs font-semibold">
                + Stop on my way home
              </button>
            )}
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
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Pickups &amp; Deliveries</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Every scheduled pickup and delivery. Reschedule, close out, or tap "On my way" right from here.</p>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="mb-8 bg-white border border-[#1E3A5F]/10 rounded-xl p-4">
        <h2 className="font-display text-lg text-[#1E3A5F] mb-1">Block off time</h2>
        <p className="text-xs text-[#1E3A5F]/60 mb-3">Appointment, day off, or just too busy? No pickups or deliveries can be booked in a blocked range.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-[#1E3A5F]/50 uppercase mb-1">Day</label>
            <input type="date" value={blockDate} min={todayStr} onChange={e => setBlockDate(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs" />
          </div>
          {!blockAllDay && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-[#1E3A5F]/50 uppercase mb-1">From</label>
                <input type="time" step={900} value={blockStart} onChange={e => setBlockStart(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#1E3A5F]/50 uppercase mb-1">To</label>
                <input type="time" step={900} value={blockEnd} onChange={e => setBlockEnd(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs" />
              </div>
            </>
          )}
          <label className="flex items-center gap-1.5 text-xs text-[#1E3A5F] pb-1.5">
            <input type="checkbox" checked={blockAllDay} onChange={e => setBlockAllDay(e.target.checked)} /> All day
          </label>
          <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Reason (private)" className="flex-1 min-w-[140px] border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs" />
          <button onClick={handleAddBlock} disabled={!blockDate || blockBusy} className="bg-[#1E3A5F] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">Block</button>
        </div>
        {blockedTimes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {blockedTimes.map(b => (
              <li key={b.id} className="flex items-center justify-between text-xs bg-cream rounded-md px-3 py-1.5">
                <span className="text-[#1E3A5F]">
                  {new Date(b.blocked_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                  {b.start_time === "00:00" && b.end_time === "23:59" ? "All day" : `${formatTimeDisplay(b.start_time)} – ${formatTimeDisplay(b.end_time)}`}
                  {b.reason && <span className="text-[#1E3A5F]/50"> · {b.reason}</span>}
                </span>
                <button onClick={() => handleRemoveBlock(b.id)} disabled={blockBusy} className="text-ember font-semibold">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-6">
        <h2 className="font-display text-lg text-[#1E3A5F] mb-2">Today ({todayAppointments.length})</h2>
        {todayAppointments.length === 0 ? (
          <p className="text-sm text-[#1E3A5F]/50">Nothing scheduled for today.</p>
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
