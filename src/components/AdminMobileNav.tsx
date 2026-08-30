"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type NavLink = { href: string; label: string; badge?: number };

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-2 bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
      {count}
    </span>
  );
}

export default function AdminMobileNav({
  links,
  firstName,
  onSignOut
}: {
  links: NavLink[];
  firstName: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Top bar — always visible on mobile, sits above the page content.
          Kept deliberately compact (reduced padding/icon/text size vs the
          original) for one-handed use, since this bar is visible on every
          single screen and eats into usable space otherwise. */}
      <div className="flex items-center justify-between bg-[#1E3A5F] text-white px-4 py-2 sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/logo-header.png"
              alt="Sunrise Wood Creations"
              width={900}
              height={455}
              className="h-6 w-auto"
            />
          </Link>
          <span className="font-display text-sm truncate">Hello, {firstName}</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="p-2 -mr-2"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Slide-down panel — large, touch-friendly rows, closes on tap */}
      {open && (
        <div className="fixed inset-0 top-[44px] bg-[#1E3A5F] z-30 overflow-y-auto">
          <nav className="flex flex-col px-2 py-2">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-4 rounded-lg text-white/85 active:bg-white/10 text-base border-b border-white/5"
              >
                {link.label}
                <Badge count={link.badge || 0} />
              </Link>
            ))}
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex items-center px-3 py-4 mt-2 text-white/50 text-sm"
            >
              Log out
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
