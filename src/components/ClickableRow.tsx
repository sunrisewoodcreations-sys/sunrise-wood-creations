"use client";

import { useRouter } from "next/navigation";

// Makes a whole table row / card open `href` when clicked anywhere, except
// on real controls inside it (links, buttons, dropdowns, inputs), which keep
// doing their own thing. The row also keeps its normal link inside it, so
// keyboard and screen-reader users are unaffected.
export default function ClickableRow({
  href,
  as = "div",
  className,
  children
}: {
  href: string;
  as?: "tr" | "div";
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const Tag = as as any;

  function onClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el.closest("a, button, select, input, textarea, label, [role='button']")) return;
    // Don't navigate if the person was selecting text.
    if (window.getSelection()?.toString()) return;
    if (e.metaKey || e.ctrlKey) { window.open(href, "_blank"); return; }
    router.push(href);
  }

  return (
    <Tag onClick={onClick} className={`cursor-pointer ${className || ""}`}>
      {children}
    </Tag>
  );
}
