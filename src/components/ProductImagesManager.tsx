"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = { name: string; imageUrl: string | null };

export default function ProductImagesManager({
  initialProducts
}: {
  initialProducts: { key: string; name: string; imageUrl: string | null }[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  function applyUpdatedImageUrls(updated: Record<string, Product>) {
    setProducts(prev => prev.map(p => ({ ...p, imageUrl: updated[p.key]?.imageUrl ?? p.imageUrl })));
  }

  async function uploadFile(key: string, file: File) {
    setBusyKey(key);
    setError("");
    const formData = new FormData();
    formData.append("productKey", key);
    formData.append("file", file);

    const res = await fetch("/api/product-images", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    setBusyKey(null);
    if (!res.ok) { setError(body.error || "Upload failed."); return; }
    applyUpdatedImageUrls(body.products);
    router.refresh();
  }

  async function removeImage(key: string) {
    if (!confirm("Remove this photo? The product page will show \"Photo coming soon\" until you upload a new one.")) return;
    setBusyKey(key);
    setError("");
    const formData = new FormData();
    formData.append("productKey", key);
    formData.append("remove", "true");

    const res = await fetch("/api/product-images", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    setBusyKey(null);
    if (!res.ok) { setError(body.error || "Couldn't remove."); return; }
    applyUpdatedImageUrls(body.products);
    router.refresh();
  }

  return (
    <div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map(product => (
          <div key={product.key} className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
            <div className="relative aspect-[16/9] bg-cream">
              {product.imageUrl ? (
                // Plain <img>, not next/image — this is an admin
                // management thumbnail rendering a dynamic Storage URL,
                // not the actual product page carousel (which already
                // uses next/image correctly and is untouched by this).
                <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
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
              <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-2">{product.name}</div>

              <label className="block">
                <span className="inline-block bg-[#1E3A5F] text-white rounded-md px-3 py-2 text-xs font-semibold cursor-pointer hover:opacity-90">
                  {busyKey === product.key ? "Uploading..." : product.imageUrl ? "Replace photo" : "Upload photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={busyKey === product.key}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(product.key, f); e.target.value = ""; }}
                />
              </label>

              {product.imageUrl && (
                <button
                  onClick={() => removeImage(product.key)}
                  disabled={busyKey === product.key}
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
