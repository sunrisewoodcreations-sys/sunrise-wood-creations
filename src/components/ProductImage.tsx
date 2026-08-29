import Image from "next/image";

// The single definition of "show a real photo if imageUrl exists,
// otherwise show a clearly-labeled 'Photo coming soon' placeholder" —
// extracted from ProductCard so the product detail page can reuse the
// exact same fallback behavior instead of a second, separately
// maintained copy of this logic. areaClassName carries all sizing
// (aspect ratio, height, rounding, etc.) so each caller controls its
// own layout without this component needing to know about cards vs.
// detail pages.
export default function ProductImage({
  imageUrl,
  name,
  areaClassName,
  iconSize = 28
}: {
  imageUrl: string | null;
  name: string;
  areaClassName: string;
  iconSize?: number;
}) {
  return (
    <div className={`relative bg-sawdust ${areaClassName}`}>
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-walnut/30 gap-2">
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 15l-4.5-4.5a2 2 0 0 0-2.8 0L5 19" />
          </svg>
          <span className="text-xs font-medium">Photo coming soon</span>
        </div>
      )}
    </div>
  );
}
