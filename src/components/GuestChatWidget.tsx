"use client";

import { useState } from "react";

type SentMessage = { body: string };

export default function GuestChatWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [identified, setIdentified] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (!name.trim() || !email.trim()) {
      setError("Let us know your name and email first so we can get back to you.");
      return;
    }

    setSending(true);
    setError("");

    const res = await fetch("/api/guest-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, body: draft.trim() })
    });

    setSending(false);
    if (res.ok) {
      setSentMessages(prev => [...prev, { body: draft.trim() }]);
      setDraft("");
      setIdentified(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't send that. Try again in a moment.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-ember text-white shadow-lg flex items-center justify-center hover:opacity-90"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[320px] max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-2xl border border-walnut/10 overflow-hidden flex flex-col">
      <div className="bg-walnut text-cream px-4 py-3 flex items-center justify-between">
        <span className="font-display text-sm font-semibold">Chat with us</span>
        <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-cream/70 hover:text-cream">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-2 bg-cream/20">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-white border border-walnut/10 text-walnut/80">
            Hi! Send us a message and we'll reply by email — usually within a day.
          </div>
        </div>
        {sentMessages.map((m, i) => (
          <div key={i} className="flex justify-end">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-ember text-white">
              {m.body}
            </div>
          </div>
        ))}
        {identified && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-white border border-walnut/10 text-walnut/80">
              Thanks, {name.split(" ")[0]}! We'll email you at {email}.
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-walnut/10 space-y-2">
        {!identified && (
          <>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="Your email"
              className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm"
            />
          </>
        )}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-walnut/15 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="bg-walnut text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {error && <p className="text-xs text-ember">{error}</p>}
      </form>
    </div>
  );
}
