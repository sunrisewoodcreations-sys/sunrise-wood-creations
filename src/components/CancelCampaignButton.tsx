"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelCampaignButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("Cancel this scheduled campaign? It will not be sent.")) return;
    setBusy(true);
    await fetch(`/api/coupons/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" })
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button onClick={handleCancel} disabled={busy} className="border border-ember text-ember px-3 py-1.5 rounded-md text-xs font-semibold">
      {busy ? "Cancelling…" : "Cancel Scheduled Send"}
    </button>
  );
}
