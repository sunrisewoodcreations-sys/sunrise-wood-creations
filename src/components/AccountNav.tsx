import Link from "next/link";

const LINKS = [
  { href: "/account", label: "Dashboard" },
  { href: "/account/quotes", label: "Quotes" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/purchases", label: "Previous Purchases" },
  { href: "/account/reviews", label: "My Reviews" },
  { href: "/account/settings", label: "Profile" }
];

// Shared across every account page so the portal feels like one
// connected system instead of separate pages bolted together.
export default function AccountNav({ current }: { current: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
      {LINKS.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
            current === link.href ? "bg-walnut text-cream" : "bg-white border border-walnut/15 text-walnut"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
