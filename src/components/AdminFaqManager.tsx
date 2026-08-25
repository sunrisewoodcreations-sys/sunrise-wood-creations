"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  name: string;
  email: string;
  question: string;
  answer: string | null;
  status: string;
  is_public: boolean;
  created_at: string;
};

export default function AdminFaqManager({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "answered">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [addingFaq, setAddingFaq] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [addError, setAddError] = useState("");

  const filtered = questions.filter(q => q.status === filter);
  const pendingCount = questions.filter(q => q.status === "pending").length;

  async function handleAddFaq() {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      setAddError("Both a question and an answer are required.");
      return;
    }
    setBusy(true);
    setAddError("");
    const res = await fetch("/api/admin/faq-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion, answer: newAnswer })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setAddError(body.error || "Couldn't add this FAQ."); return; }
    setNewQuestion("");
    setNewAnswer("");
    setAddingFaq(false);
    setFilter("answered");
    router.refresh();
  }

  function openAnswerForm(q: Question) {
    setOpenId(q.id);
    setAnswerText(q.answer || "");
    setMakePublic(q.is_public);
    setError("");
  }

  async function submitAnswer(id: string) {
    if (!answerText.trim()) { setError("Please write an answer."); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/faq-questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, answer: answerText, isPublic: makePublic })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't save."); return; }
    setOpenId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question permanently?")) return;
    await fetch("/api/admin/faq-questions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5">
        {!addingFaq ? (
          <button
            onClick={() => setAddingFaq(true)}
            className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold"
          >
            + Add FAQ manually
          </button>
        ) : (
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
            <p className="text-xs text-[#1E3A5F]/50 mb-3">
              No customer needed — this goes straight to public on the FAQ page, with no email sent (there's no one to send it to).
            </p>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Question</label>
            <input
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-3"
            />
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Answer</label>
            <textarea
              value={newAnswer}
              onChange={e => setNewAnswer(e.target.value)}
              rows={3}
              className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-2"
            />
            {addError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 mb-2">{addError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAddFaq}
                disabled={busy}
                className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
              >
                {busy ? "Adding..." : "Add to public FAQ"}
              </button>
              <button
                onClick={() => { setAddingFaq(false); setAddError(""); setNewQuestion(""); setNewAnswer(""); }}
                className="text-xs text-[#1E3A5F]/50 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${filter === "pending" ? "bg-[#1E3A5F] text-white" : "bg-white border border-[#1E3A5F]/15 text-[#1E3A5F]"}`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter("answered")}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${filter === "answered" ? "bg-[#1E3A5F] text-white" : "bg-white border border-[#1E3A5F]/15 text-[#1E3A5F]"}`}
        >
          Answered ({questions.filter(q => q.status === "answered").length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#1E3A5F]/50">No {filter} questions.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <div key={q.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                <div>
                  <div className="font-semibold text-[#1E3A5F]">{q.name}</div>
                  <div className="text-xs text-[#1E3A5F]/50">{q.email} · {new Date(q.created_at).toLocaleDateString()}</div>
                </div>
                {q.status === "answered" && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${q.is_public ? "bg-sage/20 text-sage" : "bg-[#1E3A5F]/10 text-[#1E3A5F]/60"}`}>
                    {q.is_public ? "Public" : "Private"}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#1E3A5F]/70 mb-2">{q.question}</p>

              {q.answer && openId !== q.id && (
                <div className="bg-cream rounded-md px-3 py-2 text-sm text-[#1E3A5F]/80 mb-2">{q.answer}</div>
              )}

              {openId === q.id ? (
                <div className="mt-2 pt-3 border-t border-[#1E3A5F]/10">
                  <textarea
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                    rows={4}
                    placeholder="Write your answer..."
                    className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-2"
                  />
                  <label className="flex items-center gap-2 text-sm text-[#1E3A5F] mb-2">
                    <input type="checkbox" checked={makePublic} onChange={e => setMakePublic(e.target.checked)} />
                    Show this question and answer publicly on the FAQ page
                  </label>
                  {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 mb-2">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitAnswer(q.id)}
                      disabled={busy}
                      className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
                    >
                      {busy ? "Saving..." : q.status === "answered" ? "Save (no email sent)" : "Save & Send Email"}
                    </button>
                    <button onClick={() => setOpenId(null)} className="text-xs text-[#1E3A5F]/50 font-semibold">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => openAnswerForm(q)} className="text-xs font-semibold text-ember hover:underline">
                    {q.answer ? "Edit answer" : "Write answer"}
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="text-xs font-semibold text-[#1E3A5F]/40 hover:text-ember ml-auto">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
