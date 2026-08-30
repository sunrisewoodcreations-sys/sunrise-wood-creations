"use client";

import { useState } from "react";
import Link from "next/link";

type NavLink = { href: string; label: string };
type ProductLink = { slug: string; name: string };

// Same information architecture as the desktop nav (Home, Products
// group, then the secondary links), just adapted to a single
// scrollable mobile panel instead of a hover dropdown — not a
// separate mobile-only navigation design.
export default function MobileNavToggle({
  primaryLinks,
  products,
  secondaryLinks,
  ctaHref
}: {
  primaryLinks: NavLink[];
  products: ProductLink[];
  secondaryLinks: NavLink[];
  ctaHref: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
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
        <div className="absolute left-0 right-0 top-full bg-cream border-b border-walnut/10 shadow-md z-40 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="flex flex-col px-6 py-2">
            <Link
              href={ctaHref}
              onClick={() => setOpen(false)}
              className="my-2 text-center bg-ember text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Request a Quote
            </Link>

            {primaryLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-walnut/80 hover:text-walnut border-b border-walnut/5"
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-3 pb-1 text-xs font-semibold text-walnut/40 uppercase tracking-wide">
              Products
            </div>
            {products.map((p, i) => (
              <Link
                key={p.slug}
                href={`/products/${p.slug}`}
                onClick={() => setOpen(false)}
                className={`py-3 pl-3 text-sm font-medium text-walnut/80 hover:text-walnut ${i === products.length - 1 ? "border-b border-walnut/5" : ""}`}
              >
                {p.name}
              </Link>
            ))}

            {secondaryLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`py-3 text-sm font-medium text-walnut/80 hover:text-walnut ${i < secondaryLinks.length - 1 ? "border-b border-walnut/5" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
