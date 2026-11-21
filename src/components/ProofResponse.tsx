"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProofDesigns from "@/components/ProofDesigns";

export default function ProofResponse({
  imageUrl, imageUrl2, design1, design2, endpoint
}: { proofId: string; imageUrl: string; imageUrl2?: string | null; design1?: string | null; design2?: string | null; endpoint: string }) {
  const router = useRouter();
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);

  if (done) {
    return (
      <div className="text-sm bg-sage/10 text-sage font-semibold p-3 rounded-md mt-3">
        {done === "approved"
          ? "Thanks! Your design is approved and moving into production."
          : "Thanks for the feedback — we'll send an updated proof soon."}
      </div>
    );
  }

  return (
    <div className="border border-dashed border-ember bg-ember/5 rounded-lg p-4 mt-4">
      <h3 className="font-semibold text-walnut text-sm mb-2">{imageUrl2 ? "Design proofs — awaiting your review" : "Design proof — awaiting your review"}</h3>
      <ProofDesigns
        endpoint={endpoint}
        imageUrl={imageUrl}
        imageUrl2={imageUrl2}
        initial1={design1}
        initial2={design2}
        approveLabel="Approve proof"
        changesLabel="Request changes"
        onComplete={final => { setDone(final); router.refresh(); }}
      />
    </div>
  );
}
