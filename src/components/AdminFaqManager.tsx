"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FAQ_CATEGORY_ORDER, FAQ_CATEGORY_LABELS, FaqCategory } from "@/lib/siteContent";

type Question = {
  id: string;
  name: string;
  email: string;
  question: string;
  answer: string | null;
  status: string;
  is_public: boolean;
  show_on_homepage: boolean;
  category: FaqCategory;
  sort_order: number;
  created_at: string;
};

function CategorySelect({ value, onChange }: { value: FaqCategory; onChange: (v: FaqCategory) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as FaqCategory)}
      className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
    >
      {FAQ_CATEGORY_ORDER.map(cat => (
        <option key={cat} value={cat}>{FAQ_CATEGORY_LABELS[cat]}</option>
      ))}
    </select>
  );
}

export default function AdminFaqManager({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "answered">("pending");
  const [categoryFilter, setCategoryFilter] = useState<"all" | FaqCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [showOnHomepage, setShowOnHomepage] = useState(false);
  const [answerCategory, setAnswerCategory] = useState<FaqCategory>("general");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [addingFaq, setAddingFaq] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState<FaqCategory>("general");
  const [addError, setAddError] = useState("");

  const pendingCount = questions.filter(q => q.status === "pending").length;

  const searchLower = searchQuery.trim().toLowerCase();
  const filtered = questions
    .filter(q => q.status === filter)
    .filter(q => categoryFilter === "all" || q.category === categoryFilter)
    .filter(q => !searchLower || q.question.toLowerCase().includes(searchLower) || (q.answer || "").toLowerCase().includes(searchLower))
    .sort((a, b) => a.sort_order - b.sort_order);

  // Reordering only makes sense within one specific category (that's
  // the actual display grouping on the public pages) — showing arrows
  // while viewing "All categories" would let you swap positions
  // between items that aren't even displayed near each other publicly.
  const canReorder = filter === "answered" && categoryFilter !== "all";

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
      body: JSON.stringify({ question: newQuestion, answer: newAnswer, category: newCategory })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setAddError(body.error || "Couldn't add this FAQ."); return; }
    setNewQuestion("");
    setNewAnswer("");
    setNewCategory("general");
    setAddingFaq(false);
    setFilter("answered");
    router.refresh();
  }

  function openAnswerForm(q: Question) {
    setOpenId(q.id);
    setAnswerText(q.answer || "");
    setMakePublic(q.is_public);
    setShowOnHomepage(q.show_on_homepage);
    setAnswerCategory(q.category || "general");
    setError("");
  }

  async function submitAnswer(id: string) {
    if (!answerText.trim()) { setError("Please write an answer."); return; }
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/faq-questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, answer: answerText, isPublic: makePublic, showOnHomepage, category: answerCategory })
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

  async function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filtered.length) return;
    await fetch("/api/admin/faq-questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", idA: filtered[index].id, idB: filtered[targetIndex].id })
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
              className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-3"
            />
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Category</label>
            <div className="mb-2">
              <CategorySelect value={newCategory} onChange={setNewCategory} />
            </div>
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
                onClick={() => { setAddingFaq(false); setAddError(""); setNewQuestion(""); setNewAnswer(""); setNewCategory("general"); }}
                className="text-xs text-[#1E3A5F]/50 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3">
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

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as "all" | FaqCategory)}
          className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {FAQ_CATEGORY_ORDER.map(cat => (
            <option key={cat} value={cat}>{FAQ_CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search questions and answers..."
          className="flex-1 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#1E3A5F]/50">No matching {filter} questions.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((q, index) => (
            <div key={q.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                <div>
                  <div className="font-semibold text-[#1E3A5F]">
                    {q.name === "Added by admin" ? "Added by you" : q.name}
                  </div>
                  <div className="text-xs text-[#1E3A5F]/50">
                    {q.name === "Added by admin" ? "Not a customer submission" : q.email} · {new Date(q.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]/70">
                    {FAQ_CATEGORY_LABELS[q.category] || "General"}
                  </span>
                  {q.status === "answered" && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${q.is_public ? "bg-sage/20 text-sage" : "bg-[#1E3A5F]/10 text-[#1E3A5F]/60"}`}>
                      {q.is_public ? "Public" : "Private"}
                    </span>
                  )}
                  {q.status === "answered" && q.show_on_homepage && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-ember/15 text-ember">
                      Homepage
                    </span>
                  )}
                </div>
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
                  <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Category</label>
                  <div className="mb-2">
                    <CategorySelect value={answerCategory} onChange={setAnswerCategory} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#1E3A5F] mb-2">
                    <input type="checkbox" checked={makePublic} onChange={e => setMakePublic(e.target.checked)} />
                    Show this question and answer publicly on the FAQ page
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#1E3A5F] mb-2">
                    <input type="checkbox" checked={showOnHomepage} onChange={e => setShowOnHomepage(e.target.checked)} />
                    Show on Homepage
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
                <div className="flex items-center gap-2">
                  {canReorder && (
                    <>
                      <button
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        aria-label="Move up"
                        className="w-6 h-6 rounded border border-[#1E3A5F]/20 text-[#1E3A5F] disabled:opacity-30 flex items-center justify-center text-xs"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMove(index, "down")}
                        disabled={index === filtered.length - 1}
                        aria-label="Move down"
                        className="w-6 h-6 rounded border border-[#1E3A5F]/20 text-[#1E3A5F] disabled:opacity-30 flex items-center justify-center text-xs"
                      >
                        ↓
                      </button>
                    </>
                  )}
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
