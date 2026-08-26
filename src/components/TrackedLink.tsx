"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

// One small client component reused everywhere a link needs to fire
// an analytics event on click — rather than converting every server
// component that has a CTA into a client component itself, this is
// the one "client island" each of them drops in. Internal site links
// use Next.js's own <Link> (preserves client-side navigation);
// external-style hrefs (tel:, mailto:, #anchors) use a plain <a>,
// since <Link> isn't meant for those.
export default function TrackedLink({
  href,
  className,
  children,
  eventName,
  eventParams
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  eventName: string;
  eventParams?: Record<string, string | number | boolean>;
}) {
  function handleClick() {
    trackEvent(eventName, eventParams);
  }

  const isSpecialLink = href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("#");

  if (isSpecialLink) {
    return (
      <a href={href} className={className} onClick={handleClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
