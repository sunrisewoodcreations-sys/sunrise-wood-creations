"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGE_LABELS: Record<string, string> = {
  waiting: "Start Building",
  building: "Move to Assembly",
  assembly: "Move to Finishing",
  finishing: "Mark Ready for Pickup"
};

// Advances production_status exactly one stage — reuses the same
// existing route every other production-status change in this app
// already goes through, just always moving forward one step instead
// of jumping straight to a specific value.
export default function QueueStageAdvanceButton({ orderId, currentStage, nextStage }: { orderId: string; currentStage: string; nextStage: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAdvance() {
    setLoading(true);
    await fetch(`/api/orders/${orderId}/production`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionStatus: nextStage })
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleAdvance}
      disabled={loading}
      className="bg-[#1E3A5F] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
    >
      {loading ? "Saving..." : (STAGE_LABELS[currentStage] || "Advance Stage")}
    </button>
  );
}
