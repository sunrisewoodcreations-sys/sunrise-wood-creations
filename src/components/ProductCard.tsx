import ProductImage from "@/components/ProductImage";
import TrackedLink from "@/components/TrackedLink";

// Shared by every category card on the homepage, including the
// featured Planter Boxes treatment — one card design, sized
// differently by the `featured` flag, rather than a second,
// duplicate card layout for the featured case.
//
// No real product photography exists in the project yet. Rather than
// inventing or guessing at an image, this shows a clearly-labeled
// "photo coming soon" placeholder whenever imageUrl is null. The
// moment a real photo is added to siteContent.ts, this same component
// automatically shows it — nothing else about the section needs to
// change or be redesigned.
export default function ProductCard({
  slug,
  name,
  shortDesc,
  imageUrl,
  featured = false
}: {
  slug: string;
  name: string;
  shortDesc: string;
  imageUrl: string | null;
  featured?: boolean;
}) {
  // Real photos always get the taller, proportional treatment (unchanged
  // from before) — the placeholder-only case gets a short, fixed height
  // on mobile specifically, growing back to the original proportional
  // size from `sm:` up. Featured now uses a wide, cinematic ratio at
  // sm:/lg: (matching its full-width band shape) instead of the old
  // tall min-height stretch, which was tuned for a 2x2 corner block
  // that no longer exists. Mobile behavior (h-32/h-28) is completely
  // unchanged from the already-approved mobile fix.
  const imageAreaClass = imageUrl
    ? featured
      ? "aspect-[21/9]"
      : "aspect-[4/3]"
    : featured
      ? "h-32 sm:aspect-[21/9]"
      : "h-28 sm:aspect-[4/3]";

  return (
    <TrackedLink
      href={`/products/${slug}`}
      eventName="product_category_click"
      eventParams={{ category: slug }}
      className={`group flex flex-col bg-white border border-walnut/10 rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all ${
        // lg:order-first moves this card to the front ONLY at the
        // desktop breakpoint — Cornhole and Wooden Signs come before
        // Planter Boxes in the underlying product list (which mobile
        // relies on for its top-to-bottom stacking, unchanged here),
        // so without this, a full-width item can't fit in row 1 once
        // those two have already claimed 2 of 3 columns — it gets
        // pushed to row 2 instead, which is exactly the bug reported.
        // order affects grid auto-placement itself, not just paint
        // order, so this also fixes which row the OTHER three land in.
        featured ? "sm:col-span-2 lg:col-span-3 lg:order-first" : ""
      }`}
    >
      <ProductImage imageUrl={imageUrl} name={name} areaClassName={imageAreaClass} iconSize={featured ? 40 : 28} />
      <div className={`p-5 flex flex-col flex-1 ${featured ? "sm:p-6" : ""}`}>
        <h3 className={`font-display text-walnut mb-1.5 break-words ${featured ? "text-2xl" : "text-lg"}`}>{name}</h3>
        <p className={`text-walnut/60 mb-4 flex-1 break-words ${featured ? "text-base" : "text-sm"}`}>{shortDesc}</p>
        <span className={`inline-flex items-center gap-1.5 font-semibold text-ember group-hover:gap-2.5 transition-all ${featured ? "text-base" : "text-sm"}`}>
          See options
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </TrackedLink>
  );
}
