"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type ProductLink = { slug: string; name: string };

// Same interaction pattern as AccountMenu (click to toggle, click
// outside to close, white card with border/shadow) reused here rather
// than inventing a second dropdown style for the header.
export default function ProductsDropdown({ products }: { products: ProductLink[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1 text-walnut/80 hover:text-walnut"
      >
        Products
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-52 bg-white border border-walnut/10 rounded-lg shadow-lg overflow-hidden z-50">
          {products.map(p => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-walnut hover:bg-cream border-b border-walnut/10 last:border-0"
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
