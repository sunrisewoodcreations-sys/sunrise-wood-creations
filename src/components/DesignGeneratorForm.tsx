"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function DesignGeneratorForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultUrl("");

    const form = new FormData();
    form.append("prompt", prompt);
    if (file) form.append("referenceImage", file);

    const res = await fetch("/api/designs/generate", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error || "Something went wrong generating this design.");
      return;
    }

    setResultUrl(body.imageUrl);
    router.refresh();
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
      <p className="text-xs text-[#1E3A5F]/50 mb-4">
        Gives you a design concept with crisp linework to start from — not a print-ready 300-DPI file.
        You'll still want to scale/vectorize it before sending it to a full-size 24x48 print.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Describe the design</label>
          <textarea
            required
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="A rustic Michigan flag design with a deer silhouette, dark green and orange colors..."
            rows={3}
            className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Reference image (optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Generating... (this can take up to a minute)" : "Generate design"}
        </button>
      </form>

      {resultUrl && (
        <div className="mt-5 border-t border-[#1E3A5F]/10 pt-5">
          <p className="text-sm font-semibold text-[#1E3A5F] mb-2">Result:</p>
          <img src={resultUrl} alt="Generated design" className="max-w-full rounded-md border border-[#1E3A5F]/10 mb-3" />
          <a
            href={resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border border-[#1E3A5F] text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold"
          >
            Download full size
          </a>
        </div>
      )}
    </div>
  );
}
