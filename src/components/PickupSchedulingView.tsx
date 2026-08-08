"use client";

import { useState } from "react";

type DaySlots = { date: string; times: string[] };
type OrderItem = { name: string; quantity: number; photoUrl: string | null };

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function PickupSchedulingView({
  apiEndpoint,
  orderTitle,
  customerName,
  items,
  alreadyUsed,
  availableDays,
  heading,
  successMessage
}: {
  apiEndpoint: string;
  orderTitle: string;
  customerName: string;
  items: OrderItem[];
  alreadyUsed: boolean;
  availableDays: DaySlots[];
  heading: string;
  successMessage: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState(false);

  async function handleConfirm() {
    if (!selectedDate || !selectedTime) return;
    setBusy(true);
    setError("");
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateStr: selectedDate, time: selectedTime })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Couldn't book that time. Please try another.");
      return;
    }
    setBooked(true);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white border border-walnut/10 rounded-xl p-6">
        <h1 className="font-display text-2xl text-walnut mb-1">{heading}</h1>
        <p className="text-sm text-walnut/60 mb-4">Sunrise Wood Creations · {customerName}</p>

        <div className="border-t border-b border-walnut/10 py-4 mb-4 space-y-2">
          <div className="text-xs font-semibold text-walnut/50 uppercase">Order</div>
          <div className="font-semibold text-walnut">{orderTitle}</div>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-3">
              {it.photoUrl ? (
                <img src={it.photoUrl} alt="" className="w-12 h-12 rounded-md object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-cream" />
              )}
              <div className="text-sm text-walnut">{it.name} × {it.quantity}</div>
            </div>
          ))}
        </div>

        {booked ? (
          <div className="bg-sage/10 border border-sage/30 rounded-lg p-4">
            <p className="text-sm font-semibold text-walnut mb-1">You're all set!</p>
            <p className="text-sm text-walnut/70">{successMessage}</p>
          </div>
        ) : alreadyUsed ? (
          <div className="bg-walnut/5 border border-walnut/10 rounded-lg p-4">
            <p className="text-sm text-walnut/70">This scheduling link has already been used. If you need to make a change, please contact us directly.</p>
          </div>
        ) : availableDays.length === 0 ? (
          <div className="bg-amber/10 border border-amber/30 rounded-lg p-4">
            <p className="text-sm text-walnut/70">No pickup times are available right now. Please contact us directly to schedule.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-walnut mb-2">Choose a day</label>
              <div className="grid grid-cols-3 gap-2">
                {availableDays.map(day => (
                  <button
                    key={day.date}
                    onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                    className={`px-2 py-2 rounded-md text-xs font-semibold border ${
                      selectedDate === day.date ? "bg-walnut text-cream border-walnut" : "bg-white text-walnut border-walnut/20"
                    }`}
                  >
                    {new Date(day.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </button>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-walnut mb-2">Choose a time</label>
                <div className="grid grid-cols-3 gap-2">
                  {availableDays.find(d => d.date === selectedDate)?.times.map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`px-2 py-2 rounded-md text-xs font-semibold border ${
                        selectedTime === time ? "bg-sage text-white border-sage" : "bg-white text-walnut border-walnut/20"
                      }`}
                    >
                      {formatTimeDisplay(time)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</p>}

            <button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedTime || busy}
              className="w-full bg-ember text-white rounded-md py-3 text-sm font-bold disabled:opacity-50"
            >
              {busy ? "Booking..." : "Confirm Appointment"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
