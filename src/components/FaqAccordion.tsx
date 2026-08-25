"use client";

import { useState } from "react";
import { FAQ_CATEGORY_ORDER, FAQ_CATEGORY_LABELS, FaqCategory } from "@/lib/siteContent";

type FaqItem = { id: string; question: string; answer: string; category?: FaqCategory };

function AccordionRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white border border-walnut/10 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
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
}

// Groups by category automatically ONLY when more than one distinct
// category is actually present in the given items — the homepage
// passes FAQs spanning every category (grouped, with headers), while
// a product page already filters to exactly one category before this
// component ever sees the data, so it renders flat there with zero
// extra configuration needed from the caller.
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="text-center text-walnut/40 border border-walnut/10 rounded-xl py-14 bg-sawdust/40">
        <p className="text-sm font-medium">No questions answered yet — check back soon, or ask your own below.</p>
      </div>
    );
  }

  const distinctCategories = new Set(items.map(i => i.category || "general"));

  if (distinctCategories.size <= 1) {
    return (
      <div className="space-y-2 max-w-2xl mx-auto">
        {items.map(item => (
          <AccordionRow key={item.id} item={item} isOpen={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {FAQ_CATEGORY_ORDER.filter(cat => distinctCategories.has(cat)).map(cat => (
        <div key={cat}>
          <h3 className="font-display text-lg text-walnut mb-3">{FAQ_CATEGORY_LABELS[cat]}</h3>
          <div className="space-y-2">
            {items.filter(i => (i.category || "general") === cat).map(item => (
              <AccordionRow key={item.id} item={item} isOpen={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
