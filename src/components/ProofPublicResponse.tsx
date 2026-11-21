"use client";

import { useState } from "react";
import Link from "next/link";
import ProofDesigns from "@/components/ProofDesigns";

export default function ProofPublicResponse({
  token, imageUrl, imageUrl2, design1, design2
}: { token: string; imageUrl: string; imageUrl2?: string | null; design1?: string | null; design2?: string | null }) {
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);

  if (done === "approved") {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-sage/15 text-sage flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h2 className="font-display text-xl text-walnut mb-2">Thanks for approving!</h2>
        <p className="text-sm text-walnut/70 mb-6">
          We'll notify you at every step of the way as your order moves through production.
        </p>
        <Link
          href="/"
          className="inline-block bg-walnut text-cream px-6 py-2.5 rounded-md text-sm font-semibold"
        >
          Close
        </Link>
      </div>
    );
  }

  if (done === "changes_requested") {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-amber/20 text-ember flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h2 className="font-display text-xl text-walnut mb-2">Thanks — we're on it!</h2>
        <p className="text-sm text-walnut/70 mb-6">
          We're working on your revisions and will send another proof as soon as possible.
        </p>
        <Link
          href="/"
          className="inline-block bg-walnut text-cream px-6 py-2.5 rounded-md text-sm font-semibold"
        >
          Close
        </Link>
      </div>
    );
  }

  return (
    <ProofDesigns
      endpoint={`/api/proofs/token/${token}/respond`}
      imageUrl={imageUrl}
      imageUrl2={imageUrl2}
      initial1={design1}
      initial2={design2}
      onComplete={setDone}
    />
  );
}
