"use client";

import { useState, useEffect, useCallback } from "react";

type Note = { id: string; note: string; created_at: string };

export default function CustomerNotes({ customerId }: { customerId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadNotes = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}/notes`);
    if (res.ok) {
      const body = await res.json();
      setNotes(body.notes || []);
    }
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/customers/${customerId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: draft.trim() })
    });
    setLoading(false);
    if (res.ok) {
      setDraft("");
      loadNotes();
    }
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-[#1E3A5F] mb-1">Private notes</h3>
      <p className="text-xs text-[#1E3A5F]/50 mb-3">Only you can see these — the customer never will.</p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="e.g. Prefers dark stain, referred by Jane..."
          className="flex-1 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          className="bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
        >
          Add note
        </button>
      </form>

      {loaded && notes.length === 0 && (
        <p className="text-xs text-[#1E3A5F]/40">No notes yet.</p>
      )}
      <div className="space-y-2">
        {notes.map(n => (
          <div key={n.id} className="bg-cream/50 rounded-md px-3 py-2">
            <p className="text-sm text-[#1E3A5F]/80">{n.note}</p>
            <p className="text-[10px] text-[#1E3A5F]/40 mt-1">
              {new Date(n.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
