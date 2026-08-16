"use client";

import { useState } from "react";

type FaqItem = { id: string; question: string; answer: string };

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="text-center text-walnut/40 border border-walnut/10 rounded-xl py-14 bg-sawdust/40">
        <p className="text-sm font-medium">No questions answered yet — check back soon, or ask your own below.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl mx-auto">
      {items.map(item => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="bg-white border border-walnut/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="font-semibold text-walnut text-sm">{item.question}</span>
              <span className={`text-walnut/40 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-sm text-walnut/70">
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
