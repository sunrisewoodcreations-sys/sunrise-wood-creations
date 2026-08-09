"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCustomerForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Holds a detected possible duplicate so the confirmation UI can show
  // it, without having created anything yet.
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string } | null>(null);

  async function submitCustomer(confirmDuplicate: boolean) {
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone, confirmDuplicate })
    });
    const body = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(body.error || "Something went wrong.");
      return;
    }

    if (body.possibleDuplicate) {
      setStatus("idle");
      setDuplicateWarning({ name: body.existingCustomerName });
      return;
    }

    setStatus("done");
    setFullName("");
    setEmail("");
    setPhone("");
    setDuplicateWarning(null);
    router.refresh();
    setTimeout(() => setStatus("idle"), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitCustomer(false);
  }

  const hasEmail = !!email.trim();

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-6 mb-7">
      <h2 className="font-display text-lg text-[#1E3A5F] mb-4">Add a new customer</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Full name</label>
          <input
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Phone (optional)</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(269) 555-0123"
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </div>
      </div>

      {duplicateWarning && (
        <div className="bg-amber/10 border border-amber/30 rounded-md px-3 py-2.5 mb-4">
          <p className="text-sm text-[#1E3A5F]">
            A customer named <strong>{duplicateWarning.name}</strong> with this same phone number already exists.
            This might be the same person.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => submitCustomer(true)}
              disabled={status === "loading"}
              className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
            >
              Create anyway — it's a different person
            </button>
            <button
              type="button"
              onClick={() => setDuplicateWarning(null)}
              className="text-xs text-[#1E3A5F]/60 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="bg-[#1E3A5F] text-white px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60"
      >
        {status === "loading" ? "Creating..." : "Create customer"}
      </button>
      <p className="text-xs text-[#1E3A5F]/50 mt-2">
        {hasEmail
          ? `${fullName.split(" ")[0] || "They"}'ll get an email with a link to set a password and see their orders — they can choose their own notification preferences from their account.`
          : "No account will be created — this is just a record for tracking their orders, with no notifications sent."}
      </p>
      {status === "error" && <p className="text-sm text-red-700 mt-2">{errorMsg}</p>}
      {status === "done" && <p className="text-sm text-sage font-semibold mt-2">Customer created.</p>}
    </form>
  );
}
