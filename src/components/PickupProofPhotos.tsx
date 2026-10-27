"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Photo = { path: string; url: string; takenAt: string };

// Shrinks a phone photo (often 5-10 MB) to ~1600px JPEG before uploading.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/jpeg", 0.82)
  );
}

function formatTime(iso: string): string {
  if (!iso) return "Time unavailable";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short"
  });
}

export default function PickupProofPhotos({ orderId, photos, isDelivery }: { orderId: string; photos: Photo[]; isDelivery: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const noun = isDelivery ? "delivery" : "pickup";

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const blob = await shrink(file);
      const form = new FormData();
      form.append("photo", new File([blob], "proof.jpg", { type: "image/jpeg" }));
      const res = await fetch(`/api/orders/${orderId}/pickup-proof`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Upload failed.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    }
    setBusy(false);
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg text-[#1E3A5F]">{isDelivery ? "Delivery" : "Pickup"} proof</h2>
          <p className="text-xs text-[#1E3A5F]/60 mt-0.5">Photos of the customer receiving their order, saved with the date and time. Only you can see these — never the customer.</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="bg-[#1E3A5F] text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Saving..." : "Add photo"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">{error}</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-[#1E3A5F]/50 mt-4">No {noun} photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {photos.map(p => (
            <a key={p.path} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`${noun} proof`} className="w-full aspect-square object-cover rounded-lg border border-[#1E3A5F]/10" />
              <div className="text-[11px] text-[#1E3A5F]/70 mt-1 leading-snug">{formatTime(p.takenAt)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
