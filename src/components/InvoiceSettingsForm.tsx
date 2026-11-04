"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceSettings, PAYMENT_METHOD_OPTIONS, TERMS_OPTIONS, MAX_INSTRUCTIONS_LENGTH } from "@/lib/invoiceSettings";

export default function InvoiceSettingsForm({ initial }: { initial: InvoiceSettings }) {
  const router = useRouter();
  const [methods, setMethods] = useState<string[]>(initial.paymentMethods);
  const [instructions, setInstructions] = useState(initial.paymentInstructions);
  const [terms, setTerms] = useState<string>(initial.termsDays === null ? "none" : String(initial.termsDays));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggle(key: string) {
    setSaved(false);
    setMethods(m => (m.includes(key) ? m.filter(k => k !== key) : [...m, key]));
  }

  async function save() {
    setBusy(true); setError(""); setSaved(false);
    const res = await fetch("/api/admin/invoice-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethods: methods,
        paymentInstructions: instructions,
        termsDays: terms === "none" ? null : Number(terms)
      })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't save."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Invoice Settings</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        These show on every invoice PDF, including the one emailed to the customer. Anything you leave blank is simply left off the invoice.
      </p>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 max-w-xl space-y-6">
        <div>
          <div className="text-sm font-semibold text-[#1E3A5F] mb-1">Accepted payment methods</div>
          <p className="text-xs text-[#1E3A5F]/60 mb-2">Only the ones you turn on are listed on the invoice.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PAYMENT_METHOD_OPTIONS.map(m => (
              <label key={m.key} className="flex items-center gap-3 border border-[#1E3A5F]/15 rounded-md px-3 py-3 text-sm cursor-pointer">
                <input type="checkbox" className="w-5 h-5" checked={methods.includes(m.key)} onChange={() => toggle(m.key)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1E3A5F] mb-1">Payment instructions (optional)</label>
          <p className="text-xs text-[#1E3A5F]/60 mb-2">For example where to send a check, or your Venmo / Zelle name.</p>
          <textarea
            value={instructions}
            onChange={e => { setInstructions(e.target.value.slice(0, MAX_INSTRUCTIONS_LENGTH)); setSaved(false); }}
            rows={5}
            placeholder={"Venmo: @your-name\nZelle: your-phone-or-email\nMake checks payable to Sunrise Wood Creations LLC"}
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
          <div className="text-xs text-[#1E3A5F]/50 text-right">{instructions.length}/{MAX_INSTRUCTIONS_LENGTH}</div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1E3A5F] mb-1">Default payment terms</label>
          <p className="text-xs text-[#1E3A5F]/60 mb-2">
            Used to work out a due date only when an order doesn't already have its own due date. An order's own due date always wins.
          </p>
          <select
            value={terms}
            onChange={e => { setTerms(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm bg-white"
          >
            {TERMS_OPTIONS.map(o => (
              <option key={String(o.value)} value={o.value === null ? "none" : String(o.value)}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="bg-ember text-white px-4 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60">
            {busy ? "Saving..." : "Save settings"}
          </button>
          {saved && <span className="text-sm text-sage font-semibold">Saved.</span>}
          {error && <span className="text-sm text-ember">{error}</span>}
        </div>
      </div>
    </div>
  );
}
