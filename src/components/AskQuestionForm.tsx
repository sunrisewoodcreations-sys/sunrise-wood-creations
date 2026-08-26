"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export default function AskQuestionForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const res = await fetch("/api/faq-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, question })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setStatus("error"); setError(body.error || "Couldn't submit your question."); return; }
    trackEvent("ask_question_submit");
    setStatus("done");
    setName(""); setEmail(""); setQuestion("");
  }

  return (
    <>
      <div className="text-center mt-8">
        <button
          onClick={() => { trackEvent("ask_question_click"); setOpen(true); }}
          className="inline-block border border-walnut text-walnut px-6 py-3 rounded-md font-semibold hover:bg-walnut/5 transition-colors"
        >
          Ask a Question
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            {status === "done" ? (
              <div className="text-center py-4">
                <p className="text-walnut font-semibold mb-1">Question sent!</p>
                <p className="text-sm text-walnut/60 mb-4">We'll get back to you at the email you provided.</p>
                <button onClick={() => setOpen(false)} className="text-sm font-semibold text-ember">Close</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg text-walnut">Ask a Question</h3>
                  <button type="button" onClick={() => setOpen(false)} className="text-walnut/50 hover:text-walnut text-xl leading-none">✕</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-walnut mb-1">Name</label>
                    <input required value={name} onChange={e => setName(e.target.value)} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-walnut mb-1">Email</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-walnut mb-1">Question</label>
                    <textarea required value={question} onChange={e => setQuestion(e.target.value)} rows={4} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
                  </div>
                </div>
                {status === "error" && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">{error}</p>}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full mt-4 bg-ember text-white px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60"
                >
                  {status === "loading" ? "Sending..." : "Submit Question"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
