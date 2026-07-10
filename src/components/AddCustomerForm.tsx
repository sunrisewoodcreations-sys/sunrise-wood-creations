"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCustomerForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email })
    });
    const body = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(body.error || "Something went wrong.");
      return;
    }

    setStatus("done");
    setFullName("");
    setEmail("");
    router.refresh();
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-6 mb-7">
      <h2 className="font-display text-lg text-[#1E3A5F] mb-4">Add a new customer</h2>
      <div className="grid grid-cols-2 gap-4 mb-4">
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
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="bg-ember text-white px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60"
      >
        {status === "loading" ? "Sending..." : "Create customer & send setup email"}
      </button>
      <p className="text-xs text-[#1E3A5F]/50 mt-2">
        {fullName.split(" ")[0] || "They"}&apos;ll get an email with a link to set a password and see their orders.
      </p>
      {status === "error" && <p className="text-sm text-red-700 mt-2">{errorMsg}</p>}
      {status === "done" && <p className="text-sm text-sage font-semibold mt-2">Customer created and invite sent.</p>}
    </form>
  );
}
