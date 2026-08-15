"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Slide = { src: string | null; alt: string };

export default function CarouselSlidesManager({ initialSlides }: { initialSlides: Slide[] }) {
  const router = useRouter();
  const [slides, setSlides] = useState(initialSlides);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function uploadFile(index: number, file: File) {
    setBusySlot(index);
    setError("");
    const formData = new FormData();
    formData.append("slotIndex", String(index));
    formData.append("file", file);
    formData.append("alt", slides[index]?.alt || "");

    const res = await fetch("/api/carousel-images", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    setBusySlot(null);
    if (!res.ok) { setError(body.error || "Upload failed."); return; }
    setSlides(body.slides);
    router.refresh();
  }

  async function saveAltText(index: number, alt: string) {
    setBusySlot(index);
    setError("");
    const formData = new FormData();
    formData.append("slotIndex", String(index));
    formData.append("alt", alt);

    const res = await fetch("/api/carousel-images", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    setBusySlot(null);
    if (!res.ok) { setError(body.error || "Couldn't save."); return; }
    setSlides(body.slides);
  }

  async function removeImage(index: number) {
    if (!confirm("Remove this photo? The slide will show \"Photo coming soon\" until you upload a new one.")) return;
    setBusySlot(index);
    setError("");
    const formData = new FormData();
    formData.append("slotIndex", String(index));
    formData.append("remove", "true");

    const res = await fetch("/api/carousel-images", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    setBusySlot(null);
    if (!res.ok) { setError(body.error || "Couldn't remove."); return; }
    setSlides(body.slides);
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {slides.map((slide, i) => (
          <div key={i} className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
            <div className="relative aspect-[16/9] bg-cream">
              {slide.src ? (
                // Plain <img>, not next/image — this is an admin
                // management thumbnail rendering a dynamic Storage URL,
                // not the actual homepage carousel (which already uses
                // next/image correctly and is untouched by this).
                <img src={slide.src} alt={slide.alt} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#1E3A5F]/30 gap-1">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <path d="M21 15l-4.5-4.5a2 2 0 0 0-2.8 0L5 19" />
                  </svg>
                  <span className="text-xs font-medium">Photo coming soon</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-2">Slide {i + 1}</div>

              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Alt text (for accessibility)</label>
              <input
                defaultValue={slide.alt}
                onBlur={e => { if (e.target.value !== slide.alt) saveAltText(i, e.target.value); }}
                className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm mb-3"
              />

              <label className="block">
                <span className="inline-block bg-[#1E3A5F] text-white rounded-md px-3 py-2 text-xs font-semibold cursor-pointer hover:opacity-90">
                  {busySlot === i ? "Uploading..." : slide.src ? "Replace photo" : "Upload photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={busySlot === i}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(i, f); e.target.value = ""; }}
                />
              </label>

              {slide.src && (
                <button
                  onClick={() => removeImage(i)}
                  disabled={busySlot === i}
                  className="ml-2 text-xs text-ember font-semibold hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
