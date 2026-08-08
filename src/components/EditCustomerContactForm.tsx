"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EditCustomerContactForm({
  customerId,
  initialPhone,
  initialAddress
}: {
  customerId: string;
  initialPhone: string | null;
  initialAddress: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(initialPhone || "");
  const [address, setAddress] = useState(initialAddress || "");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, address })
    });

    setLoading(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  if (!editing) {
    return (
      <div className="text-sm text-[#1E3A5F]/70 space-y-0.5">
        <div>{initialPhone || <span className="text-[#1E3A5F]/40 italic">No phone on file</span>}</div>
        <div>{initialAddress || <span className="text-[#1E3A5F]/40 italic">No address on file</span>}</div>
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-ember hover:underline mt-1">
          Edit contact info
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-2 max-w-sm">
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Phone (optional)</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="(269) 555-0123"
          className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Address (optional)</label>
        <textarea
          value={address}
          onChange={e => setAddress(e.target.value)}
          rows={2}
          placeholder="123 Main St, Lawrence, MI 49064"
          className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setPhone(initialPhone || ""); setAddress(initialAddress || ""); }}
          className="text-xs text-[#1E3A5F]/50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
