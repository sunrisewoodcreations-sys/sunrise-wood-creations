"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WebsiteStatusToggle({ initialStatus }: { initialStatus: "coming_soon" | "live" }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(newStatus: "coming_soon" | "live") {
    if (newStatus === status) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/website-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't update status."); return; }
    setStatus(newStatus);
    router.refresh();
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-6 max-w-md">
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="website-status"
            checked={status === "coming_soon"}
            onChange={() => handleChange("coming_soon")}
            disabled={busy}
            className="mt-1"
          />
          <div>
            <div className="font-semibold text-[#1E3A5F]">Coming Soon</div>
            <div className="text-xs text-[#1E3A5F]/50">Visitors see a Coming Soon page. You can still browse and test the real site while logged in as admin.</div>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="website-status"
            checked={status === "live"}
            onChange={() => handleChange("live")}
            disabled={busy}
            className="mt-1"
          />
          <div>
            <div className="font-semibold text-[#1E3A5F]">Live</div>
            <div className="text-xs text-[#1E3A5F]/50">Everyone sees the real website.</div>
          </div>
        </label>
      </div>
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 mt-3">{error}</p>}
      {busy && <p className="text-xs text-[#1E3A5F]/40 mt-3">Saving...</p>}
      <div className="mt-4 pt-4 border-t border-[#1E3A5F]/10">
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${status === "live" ? "bg-sage/20 text-sage" : "bg-amber/20 text-amber"}`}>
          Currently: {status === "live" ? "Live" : "Coming Soon"}
        </span>
      </div>
    </div>
  );
}
