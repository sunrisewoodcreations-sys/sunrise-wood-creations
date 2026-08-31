"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountMenu({ role, name }: { role: "admin" | "customer"; name?: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const links = role === "admin"
    ? [
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/orders", label: "Orders" },
        { href: "/admin/customers", label: "Customers" },
        // "Production", "Inventory", and "Settings" aren't single
        // pages — they're category names. These point at the most
        // representative existing page in each: the day-to-day
        // production queue, the picket inventory page, and pickup
        // settings, respectively.
        { href: "/admin/queue", label: "Production" },
        { href: "/admin/calendar", label: "Calendar" },
        { href: "/admin/messages", label: "Messages" },
        { href: "/admin/quotes", label: "Quotes" },
        { href: "/admin/pickets", label: "Inventory" },
        { href: "/admin/pickup-settings", label: "Settings" }
      ]
    : [
        { href: "/account", label: "My Orders" },
        { href: "/account/settings", label: "Email preferences" },
        { href: "/", label: "Back to website" }
      ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        className="flex items-center gap-2 hover:opacity-90"
      >
        <span className="w-10 h-10 rounded-full bg-walnut text-cream flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        {name && (
          <span className="hidden sm:inline text-sm font-medium text-walnut">{name}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-walnut/10 rounded-lg shadow-lg overflow-hidden z-50">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-walnut hover:bg-cream border-b border-walnut/10"
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm text-walnut/70 hover:bg-cream"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
