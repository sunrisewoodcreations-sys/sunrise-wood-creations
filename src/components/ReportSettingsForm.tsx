"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FREQUENCIES = [
  { value: "off", label: "Off — don't send anything" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly (sends Monday mornings, covering the past 7 days)" },
  { value: "monthly", label: "Monthly (sends the 1st, covering the previous month)" },
  { value: "quarterly", label: "Quarterly (sends Jan/Apr/Jul/Oct 1st, covering the previous quarter)" },
  { value: "yearly", label: "Yearly (sends Jan 1st, covering the previous year)" }
];

export default function ReportSettingsForm({
  initialFrequency,
  initialTaxPercent,
  initialEmail
}: {
  initialFrequency: string;
  initialTaxPercent: number;
  initialEmail: string;
}) {
  const router = useRouter();
  const [frequency, setFrequency] = useState(initialFrequency);
  const [taxPercent, setTaxPercent] = useState(String(initialTaxPercent));
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/report-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency, estimatedTaxSetAsidePercent: taxPercent, recipientEmail: email })
    });

    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save settings.");
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-6 space-y-4 max-w-lg">
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">How often should this email send?</label>
        <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm">
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">
          Income tax set-aside percentage
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={taxPercent}
            onChange={e => setTaxPercent(e.target.value)}
            className="w-24 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
          />
          <span className="text-sm text-[#1E3A5F]/60">% of profit</span>
        </div>
        <p className="text-xs text-[#1E3A5F]/50 mt-1">
          This is a planning estimate you control — not a real tax calculation. Ask your tax preparer what percentage makes sense for you.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Send the report to</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-[#1E3A5F] text-white px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save settings"}
      </button>
      {saved && <span className="ml-3 text-sage text-sm font-semibold">Saved</span>}
    </form>
  );
}
