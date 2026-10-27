import Link from "next/link";

// "Home > Account > Orders" trail shown above a page title. The last item
// is the current page (not a link).
export default function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-sm mb-3 sm:mb-4">
      <Link href="/" className="text-accent hover:underline">Home</Link>
      {items.map((item, i) => (
        <span key={item.label + i} className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-walnut/40" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          {item.href ? (
            <Link href={item.href} className="text-accent hover:underline">{item.label}</Link>
          ) : (
            <span className="text-walnut/60" aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
