"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import NavIcon from "@/components/AdminNavIcons";

type NavLink = { href: string; label: string; badge?: number };
type NavCategory = { label: string; links: NavLink[] };

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-2 bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
      {count}
    </span>
  );
}

// One category open at a time, auto-expanded to whichever one contains
// the page you're currently on — so navigating here never lands you on
// a page with its own section hidden away. Same collapse/expand
// interaction on both desktop (here) and mobile (AdminMobileNav),
// rather than two different navigation designs.
export default function AdminSidebarNav({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname();
  const [openCategory, setOpenCategory] = useState<string | null>(() => {
    const active = categories.find(cat => cat.links.some(l => pathname?.startsWith(l.href)));
    return active?.label ?? null;
  });

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {categories.map(category => {
        const isOpen = openCategory === category.label;
        const hasActive = category.links.some(l => pathname?.startsWith(l.href));
        return (
          <div key={category.label}>
            <button
              onClick={() => setOpenCategory(isOpen ? null : category.label)}
              aria-expanded={isOpen}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left font-semibold transition-colors ${
                hasActive ? "text-white" : "text-white/70"
              } hover:bg-white/10 hover:text-white`}
            >
              <span className="flex items-center gap-2.5">
                <NavIcon name={category.label} className={hasActive ? "text-white" : "text-white/50"} />
                {category.label}
              </span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-0.5 pl-3 mt-0.5 mb-1 ml-3 border-l border-white/10">
                {category.links.map(link => {
                  const active = pathname?.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-1.5 rounded-md flex items-center transition-colors ${
                        active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {link.label}
                      <Badge count={link.badge || 0} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
