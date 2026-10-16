"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_SOURCES, LEAD_SOURCE_LABELS } from "@/lib/leads";

export default function AddLeadForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("facebook");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, source, notes })
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(body.error || "Something went wrong.");
      return;
    }

    setStatus("done");
    setFullName("");
    setPhone("");
    setNotes("");
    router.refresh();
    setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
      <h2 className="font-display text-lg text-[#1E3A5F] mb-4">Add someone who messaged you</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Name</label>
          <input
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Phone (optional)</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(269) 555-0123"
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Where they messaged</label>
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm bg-white"
          >
            {LEAD_SOURCES.map(s => <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">What they want (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Wants two 48x18x24 planters for the porch"
          className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {status === "loading" ? "Adding..." : "Add to list"}
        </button>
        {status === "done" && <span className="text-sm text-sage font-semibold">Added. They start as "In talks".</span>}
        {status === "error" && <span className="text-sm text-ember">{errorMsg}</span>}
      </div>
    </form>
  );
}
