"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-xs text-ember/70 hover:text-ember underline">
        Delete
      </button>
    );
  }

  return (
    <span className="text-xs">
      <button onClick={handleDelete} disabled={loading} className="text-ember font-semibold mr-2">
        {loading ? "Deleting..." : "Confirm"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-black/50">
        Cancel
      </button>
    </span>
  );
}
