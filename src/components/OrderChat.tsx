"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Message = {
  id: string;
  sender_id: string;
  sender_role: "admin" | "customer";
  body: string;
  created_at: string;
};

export default function OrderChat({ orderId, currentUserId }: { orderId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/messages`);
      if (res.ok) {
        const body = await res.json();
        setMessages(body.messages || []);
      }
    } catch {
      // Silent — a failed poll just tries again next interval.
    } finally {
      setLoaded(true);
    }
  }, [orderId]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError("");

    const res = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.trim() })
    });

    setSending(false);
    if (res.ok) {
      setDraft("");
      loadMessages();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't send that message.");
    }
  }

  return (
    <div className="border border-black/10 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-black/10 bg-cream">
        <h3 className="text-sm font-semibold text-black/80">Messages about this order</h3>
      </div>

      <div ref={scrollRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-2 bg-cream/20">
        {!loaded && <p className="text-xs text-black/40">Loading...</p>}
        {loaded && messages.length === 0 && (
          <p className="text-xs text-black/40">No messages yet — say hello!</p>
        )}
        {messages.map(m => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  isMine ? "bg-[#1E3A5F] text-white" : "bg-white border border-black/10 text-black/80"
                }`}
              >
                <div>{m.body}</div>
                <div className={`text-[10px] mt-1 ${isMine ? "text-white/60" : "text-black/40"}`}>
                  {isMine ? "You" : m.sender_role === "admin" ? "Shop" : "Customer"} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString("en-US", {
                    timeZone: "America/New_York",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-black/10">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border border-black/15 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error && <p className="text-xs text-ember px-3 pb-2">{error}</p>}
    </div>
  );
}
