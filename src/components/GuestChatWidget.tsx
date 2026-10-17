"use client";

import { useState, useEffect, useRef } from "react";

type SentMessage = { body: string };

// Candidate distances from the bottom of the screen for the closed chat
// button, in px. The button rests at the first one (the original spot) and
// only moves up when that spot would sit on top of a link, button or form
// field, so it never covers something a visitor needs to tap.
const REST_OFFSET = 16;
const STEP = 6;
const MAX_OFFSET = 300;
const BUTTON_SIZE_MOBILE = 48;

export default function GuestChatWidget() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [bottomOffset, setBottomOffset] = useState<number | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [identified, setIdentified] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Keeps the closed button clear of interactive content. Runs after the
  // page settles (load, resize, end of scroll) and hides the button while the
  // visitor is actively scrolling on a phone, so it isn't dragged across text.
  useEffect(() => {
    if (open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const isSmall = () => window.matchMedia("(max-width: 639px)").matches;

    function reposition() {
      const btn = buttonRef.current;
      if (!btn) return;
      const size = btn.offsetWidth || BUTTON_SIZE_MOBILE;
      const right = window.innerWidth - (parseFloat(getComputedStyle(btn).right) || 16);
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>("a[href], button, input, textarea, select, summary, [role='button']")
      ).filter(el => el !== btn && !el.closest("header"));
      const rects = targets
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight);
      // Large block links (a whole product card) can't be avoided without
      // pushing the button off-screen, and stay tappable everywhere else, so
      // only links, buttons and fields smaller than a card count as blockers.
      const smallRects = rects.filter(r => r.height < 200);
      // Lines of visible text, so the resting spot also avoids covering words
      // when there is any gap between lines to rest in.
      const textRects: DOMRect[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!node.textContent?.trim() || !parent || parent.closest("header, script, style") || parent === btn || btn.contains(parent)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of Array.from(range.getClientRects())) {
          if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) textRects.push(r);
        }
      }
      const overlaps = (list: DOMRect[], offset: number) => {
        const top = window.innerHeight - offset - size;
        const bottom = window.innerHeight - offset;
        return list.some(r => r.left < right + 6 && r.right > right - size - 6 && r.top < bottom + 6 && r.bottom > top - 6);
      };
      // Choose the resting spot: never on top of a small control; among those,
      // the one that covers the least text (zero whenever the page leaves a
      // gap), preferring the original spot on ties. If every spot is blocked
      // by a control, stay at the original resting spot.
      const textOverlapArea = (offset: number) => {
        const top = window.innerHeight - offset - size;
        const bottom = window.innerHeight - offset;
        const left = right - size;
        let area = 0;
        for (const r of textRects) {
          const w = Math.min(r.right, right) - Math.max(r.left, left);
          const h = Math.min(r.bottom, bottom) - Math.max(r.top, top);
          if (w > 0 && h > 0) area += w * h;
        }
        return area;
      };
      let best: number | null = null;
      let bestArea = Infinity;
      for (let offset = REST_OFFSET; offset <= MAX_OFFSET; offset += STEP) {
        if (overlaps(smallRects, offset)) continue;
        const area = overlaps(textRects, offset) ? textOverlapArea(offset) : 0;
        if (area < bestArea) { best = offset; bestArea = area; }
        if (area === 0) break;
      }
      setBottomOffset(best === null || best === REST_OFFSET ? null : best);
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(reposition, 120);
    }
    function onScroll() {
      if (isSmall()) setScrolling(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { setScrolling(false); reposition(); }, 180);
    }

    schedule();
    const late = setTimeout(reposition, 800); // after images and fonts settle
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      clearTimeout(timer); clearTimeout(scrollTimer); clearTimeout(late);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
    };
  }, [open]);

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
        ref={buttonRef}
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        style={bottomOffset !== null ? { bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` } : undefined}
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:bottom-5 sm:right-5 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-accent text-white shadow-lg flex items-center justify-center hover:opacity-90 transition-[bottom,opacity,transform] duration-200 ${scrolling ? "opacity-0 translate-x-3 pointer-events-none" : ""}`}
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
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-accent text-white">
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
        {error && <p className="text-xs text-red-700">{error}</p>}
      </form>
    </div>
  );
}
