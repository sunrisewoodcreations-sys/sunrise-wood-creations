"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressInput from "@/components/AddressInput";

export default function EditCustomerContactForm({
  customerId,
  initialFullName,
  initialEmail,
  hasRealEmail,
  initialPhone,
  initialAddress
}: {
  customerId: string;
  initialFullName: string;
  initialEmail: string | null;
  hasRealEmail: boolean;
  initialPhone: string | null;
  initialAddress: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(initialFullName);
  // Placeholder emails are never shown as editable starting content —
  // the field starts blank for those customers instead, so an admin
  // can't accidentally re-save the ugly internal placeholder address
  // back into the database unchanged.
  const [email, setEmail] = useState(hasRealEmail ? (initialEmail || "") : "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [address, setAddress] = useState(initialAddress || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone, address })
    });
    const body = await res.json().catch(() => ({}));

    setLoading(false);
    if (!res.ok) {
      setError(body.error || "Couldn't save those changes.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="text-sm text-[#2E2420]/70 space-y-0.5">
        <div>{initialPhone || <span className="text-[#2E2420]/40 italic">No phone on file</span>}</div>
        <div>{initialAddress || <span className="text-[#2E2420]/40 italic">No address on file</span>}</div>
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-ember hover:underline mt-1">
          Edit customer info
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-2 max-w-sm">
      <div>
        <label className="block text-xs font-semibold text-[#2E2420] mb-1">Full name</label>
        <input
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          className="w-full border border-[#2E2420]/15 rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#2E2420] mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={hasRealEmail ? "" : "No email on file — add one to enable notifications"}
          className="w-full border border-[#2E2420]/15 rounded-md px-3 py-2 text-sm"
        />
        <p className="text-[10px] text-[#2E2420]/40 mt-0.5">Leaving this blank keeps their current email unchanged — it will never be removed this way.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#2E2420] mb-1">Phone (optional)</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="(269) 555-0123"
          className="w-full border border-[#2E2420]/15 rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#2E2420] mb-1">Address (optional)</label>
        <AddressInput value={address} onChange={setAddress} />
      </div>
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-accent text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
            setFullName(initialFullName);
            setEmail(hasRealEmail ? (initialEmail || "") : "");
            setPhone(initialPhone || "");
            setAddress(initialAddress || "");
          }}
          className="text-xs text-[#2E2420]/50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
