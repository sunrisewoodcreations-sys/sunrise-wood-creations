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

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Shrinks the picture on the phone first (max 1600px), so even a
  // multi-megabyte photo uploads in a second or two.
  async function shrink(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("shrink failed"))), "image/jpeg", 0.85)
    );
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      let blob: Blob = file;
      try { blob = await shrink(file); } catch { /* upload the original; the server shrinks it too */ }
      const fd = new FormData();
      fd.append("image", blob, "design.jpg");
      const res = await fetch(`/api/orders/${orderId}/proof-upload`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) setImageUrl(body.url);
      else setUploadError(body.error || "Couldn't upload that image.");
    } catch {
      setUploadError("Couldn't upload that image.");
    }
    setUploading(false);
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
        Choose the design image (it's shrunk automatically so it uploads fast), or paste a link. The customer gets an email to approve or request changes.
      </p>
      <label className="inline-block mb-2 cursor-pointer bg-white border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-4 py-2 text-sm font-semibold">
        {uploading ? "Uploading..." : imageUrl ? "Choose a different image" : "Choose image"}
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => handleFile(e.target.files?.[0])} />
      </label>
      {imageUrl && !uploading && <img src={imageUrl} alt="Design preview" className="block max-h-40 rounded-md border border-[#1E3A5F]/10 mb-2" />}
      {uploadError && <p className="text-xs text-ember mb-2">{uploadError}</p>}
      <div className="flex gap-2">
        <input
          required
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
        <AdminButton type="submit" disabled={loading || uploading}>
          {loading ? "Sending..." : "Send proof"}
        </AdminButton>
      </div>
      <label className="flex items-center gap-3 mt-3 text-sm text-[#1E3A5F] cursor-pointer">
        <input type="checkbox" className="w-5 h-5" checked={watermark} onChange={e => changeWatermark(e.target.checked)} />
        <span>
          Add the "Sunrise Wood Creations" watermark
          <span className="block text-xs text-[#1E3A5F]/60">
            {watermark ? "On — the proof is stamped before the customer sees it." : "Off — no watermark is added (use this if your designer already watermarked it). The image is still resized so it loads fast."}
          </span>
        </span>
      </label>
      {sent && <p className="text-xs text-sage font-semibold mt-2">Proof sent — customer notified by email.</p>}
    </form>
  );
}
