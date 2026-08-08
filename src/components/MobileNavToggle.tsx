"use client";

import { useState } from "react";
import Link from "next/link";

type NavLink = { slug: string; name: string };

export default function MobileNavToggle({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="p-2 -mr-2 text-walnut"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full bg-cream border-b border-walnut/10 shadow-md z-40">
          <nav className="flex flex-col px-6 py-2">
            {links.map(link => (
              <Link
                key={link.slug}
                href={`/products/${link.slug}`}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-walnut/80 hover:text-walnut border-b border-walnut/5 last:border-0"
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
