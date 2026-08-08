"use client";

import { useState } from "react";

// Self-contained: fetches nothing itself (receives existing steps as a
// prop) and saves independently via its own "Save steps" action,
// rather than folding into the main product Save button — keeps this
// addition simple and isolated rather than deeply restructuring the
// shared product editor hook.
export default function ProductChecklistEditor({ productId, initialSteps }: { productId: string; initialSteps: string[] }) {
  const [steps, setSteps] = useState<string[]>(initialSteps.length > 0 ? initialSteps : [""]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateStep(i: number, value: string) {
    setSteps(prev => prev.map((s, idx) => (idx === i ? value : s)));
  }
  function addStep() {
    setSteps(prev => [...prev, ""]);
  }
  function removeStep(i: number) {
    setSteps(prev => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/products/${productId}/checklist-items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps })
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <div className="mt-2 border-t border-[#1E3A5F]/10 pt-2">
      <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Build checklist (shown on Shop Floor Mode)</label>
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={step}
              onChange={e => updateStep(i, e.target.value)}
              placeholder={`Step ${i + 1}, e.g. "Sand corners"`}
              className="flex-1 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs"
            />
            {steps.length > 1 && (
              <button onClick={() => removeStep(i)} className="text-xs text-ember/70 px-2">✕</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <button onClick={addStep} className="text-xs font-semibold text-[#1E3A5F]">+ Add step</button>
        <button onClick={handleSave} disabled={saving} className="text-xs font-semibold text-white bg-[#1E3A5F] rounded-md px-2.5 py-1 disabled:opacity-60">
          {saving ? "Saving..." : "Save steps"}
        </button>
        {saved && <span className="text-xs text-sage font-semibold">Saved</span>}
      </div>
    </div>
  );
}
