"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";

export default function SendProofForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Watermark on/off. Remembered on this device, since a designer usually
  // either always or never watermarks their own work.
  const [watermark, setWatermark] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem("swc:proof-watermark") === "off") setWatermark(false); } catch {}
  }, []);
  function changeWatermark(on: boolean) {
    setWatermark(on);
    try { localStorage.setItem("swc:proof-watermark", on ? "on" : "off"); } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, watermark })
    });
    setLoading(false);
    if (res.ok) {
      setSent(true);
      setImageUrl("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-ember bg-ember/5 rounded-lg p-4">
      <h3 className="font-semibold text-[#1E3A5F] text-sm mb-2">Send a design proof</h3>
      <p className="text-xs text-[#1E3A5F]/60 mb-2">
        Paste the link to the design image (uploaded to your Supabase storage). The customer gets an email to approve or request changes.
      </p>
      <div className="flex gap-2">
        <input
          required
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
        <AdminButton type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send proof"}
        </AdminButton>
      </div>
      <label className="flex items-center gap-3 mt-3 text-sm text-[#1E3A5F] cursor-pointer">
        <input type="checkbox" className="w-5 h-5" checked={watermark} onChange={e => changeWatermark(e.target.checked)} />
        <span>
          Add the "Sunrise Wood Creations" watermark
          <span className="block text-xs text-[#1E3A5F]/60">
            {watermark ? "On — the proof is stamped before the customer sees it." : "Off — the image is sent exactly as it is (use this if your designer already watermarked it)."}
          </span>
        </span>
      </label>
      {sent && <p className="text-xs text-sage font-semibold mt-2">Proof sent — customer notified by email.</p>}
    </form>
  );
}
