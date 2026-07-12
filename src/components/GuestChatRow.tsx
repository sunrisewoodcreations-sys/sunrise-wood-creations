"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GuestChatRow({ guest }: { guest: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleResponded() {
    setLoading(true);
    await fetch(`/api/guest-messages/${guest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responded: !guest.responded })
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-[#1E3A5F]">
          {guest.name} <span className="font-normal text-[#1E3A5F]/50">({guest.email})</span>
        </div>
        <div className="text-xs font-mono text-[#1E3A5F]/40">
          {new Date(guest.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
        </div>
      </div>
      <p className="text-sm text-[#1E3A5F]/80 mb-2">{guest.body}</p>
      <div className="flex items-center gap-4">
        <a
          href={`mailto:${guest.email}?subject=${encodeURIComponent("Re: your message to Sunrise Wood Creations")}`}
          className="text-xs font-semibold text-ember hover:underline"
        >
          Reply by email
        </a>
        <button
          onClick={toggleResponded}
          disabled={loading}
          className="text-xs font-semibold text-[#1E3A5F] hover:underline disabled:opacity-50"
        >
          {guest.responded ? "Mark as unresponded" : "Mark as responded"}
        </button>
        {guest.responded && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sage/20 text-sage">Responded</span>
        )}
      </div>
    </div>
  );
}
