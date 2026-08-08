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
  initialMichiganPercent,
  initialFederalPercent,
  initialEmail
}: {
  initialFrequency: string;
  initialMichiganPercent: number;
  initialFederalPercent: number;
  initialEmail: string;
}) {
  const router = useRouter();
  const [frequency, setFrequency] = useState(initialFrequency);
  const [michiganPercent, setMichiganPercent] = useState(String(initialMichiganPercent));
  const [federalPercent, setFederalPercent] = useState(String(initialFederalPercent));
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
      body: JSON.stringify({
        frequency,
        michiganIncomeTaxPercent: michiganPercent,
        federalIncomeTaxPercent: federalPercent,
        recipientEmail: email
      })
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
    <form onSubmit={handleSave} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-6 space-y-4 max-w-lg">
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">How often should this email send?</label>
        <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm">
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Michigan state income tax rate</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={michiganPercent}
            onChange={e => setMichiganPercent(e.target.value)}
            className="w-24 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
          />
          <span className="text-sm text-[#1E3A5F]/60">% of profit</span>
        </div>
        <p className="text-xs text-[#1E3A5F]/50 mt-1">
          Defaults to Michigan's actual flat individual income tax rate (4.25% for 2026). This is a real, calculable
          number — but doesn't account for your personal exemption or other adjustments, so treat it as close, not exact.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Federal income tax set-aside</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={federalPercent}
            onChange={e => setFederalPercent(e.target.value)}
            className="w-24 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
          />
          <span className="text-sm text-[#1E3A5F]/60">% of profit</span>
        </div>
        <p className="text-xs text-[#1E3A5F]/50 mt-1">
          Unlike Michigan's flat rate, federal income tax depends on your total household income and filing status —
          there's no single correct number software can calculate for you. The default (15.3%) is just the
          self-employment tax floor (Social Security + Medicare); your actual federal bill is likely higher once
          income tax brackets are added. Ask your tax preparer for a number tailored to you.
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
