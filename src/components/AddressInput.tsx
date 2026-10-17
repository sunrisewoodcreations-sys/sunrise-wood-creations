"use client";

import { useEffect, useRef, useState } from "react";

// A text box that suggests real addresses as you type. Pick one from the
// list (click, or arrow keys + Enter) to fill it in. It is still an
// ordinary text box: if suggestions aren't available (Google not set up,
// offline), you can type any address and nothing breaks.
export default function AddressInput({
  value,
  onChange,
  onPick,
  placeholder = "123 Main St, Town, MI 49000",
  className = "w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm",
  required,
  id
}: {
  value: string;
  onChange: (value: string) => void;
  // Called only when a suggestion is chosen from the list.
  onPick?: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false); // don't re-suggest right after picking one

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) { setSuggestions([]); return; }
        const body = await res.json();
        setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []);
        setActive(-1);
      } catch {
        /* aborted or offline: just no suggestions */
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: string) {
    skipNext.current = true;
    onChange(s);
    onPick?.(s);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => (a + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => (a <= 0 ? suggestions.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(suggestions[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative" ref={boxRef}>
      <input
        id={id}
        value={value}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul role="listbox" className="absolute z-30 mt-1 w-full bg-white border border-[#1E3A5F]/15 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 text-sm cursor-pointer text-[#1E3A5F] border-b border-[#1E3A5F]/5 last:border-0 ${i === active ? "bg-cream" : ""}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
