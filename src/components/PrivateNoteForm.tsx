"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PrivateNoteForm({ orderId, initialNote }: { orderId: string; initialNote: string }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [saved, setSaved] = useState(initialNote);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const dirty = note.trim() !== saved.trim();

  async function save() {
    setLoading(true); setError(""); setJustSaved(false);
    const res = await fetch(`/api/orders/${orderId}/private-note`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note })
    });
    setLoading(false);
    if (res.ok) {
      setSaved(note.trim()); setNote(note.trim()); setJustSaved(true);
      router.refresh();
      setTimeout(() => setJustSaved(false), 2500);
    } else {
      setError((await res.json().catch(() => ({}))).error || "Couldn't save the note.");
    }
  }

  return (
    <div className="bg-amber/10 border border-amber/30 rounded-lg p-4 mt-4">
      <label htmlFor="private-note" className="block text-xs font-semibold text-[#1E3A5F]/60 uppercase tracking-wide mb-1">
        Private note <span className="normal-case font-normal">— only you can see this</span>
      </label>
      <textarea
        id="private-note"
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="e.g. Bags on top of the order · Shipped Friday"
        className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm bg-white"
      />
      {error && <p className="text-ember text-xs mt-1">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={save} disabled={loading || !dirty} className="bg-[#1E3A5F] text-white px-4 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50">
          {loading ? "Saving..." : "Save note"}
        </button>
        {justSaved && <span className="text-sage text-xs font-semibold">Saved</span>}
      </div>
    </div>
  );
}
