"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Photo = { id: string; image_url: string; caption: string | null; sort_order: number };

export default function GalleryManager({ initialPhotos }: { initialPhotos: Photo[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/gallery-images", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setError(body.error || "Upload failed."); return; }
    setPhotos(prev => [...prev, body.photo].sort((a, b) => a.sort_order - b.sort_order));
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    setError("");
    const res = await fetch("/api/gallery-images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || "Couldn't delete."); return; }
    setPhotos(prev => prev.filter(p => p.id !== id));
    router.refresh();
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    setError("");
    const res = await fetch("/api/gallery-images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idA: photos[index].id, idB: photos[targetIndex].id })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || "Couldn't reorder."); return; }

    const next = [...photos];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setPhotos(next);
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

      <label className="inline-block mb-6">
        <span className="inline-block bg-[#1E3A5F] text-white rounded-md px-4 py-2.5 text-sm font-semibold cursor-pointer hover:opacity-90">
          {uploading ? "Uploading..." : "Upload a new photo"}
        </span>
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />
      </label>

      {photos.length === 0 ? (
        <p className="text-sm text-[#1E3A5F]/50">No photos yet — upload your first one above.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {photos.map((photo, i) => (
            <div key={photo.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
              <div className="relative aspect-[4/3] bg-cream">
                <img src={photo.image_url} alt={photo.caption || "Gallery photo"} className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={() => handleMove(i, "up")}
                    disabled={i === 0}
                    aria-label="Move up in order"
                    className="w-7 h-7 rounded border border-[#1E3A5F]/20 text-[#1E3A5F] disabled:opacity-30 flex items-center justify-center"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(i, "down")}
                    disabled={i === photos.length - 1}
                    aria-label="Move down in order"
                    className="w-7 h-7 rounded border border-[#1E3A5F]/20 text-[#1E3A5F] disabled:opacity-30 flex items-center justify-center"
                  >
                    ↓
                  </button>
                </div>
                <button onClick={() => handleDelete(photo.id)} className="text-xs text-ember font-semibold hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
