import Link from "next/link";
import Image from "next/image";

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
  return (
    <Link
      href={`/products/${slug}`}
      className={`group flex flex-col bg-white border border-walnut/10 rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all ${
        featured ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""
      }`}
    >
      <div className={`relative bg-sawdust ${featured ? "aspect-[16/10] lg:aspect-auto lg:flex-1 lg:min-h-[260px]" : "aspect-[4/3]"}`}>
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-walnut/30 gap-2">
            <svg width={featured ? "40" : "28"} height={featured ? "40" : "28"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 15l-4.5-4.5a2 2 0 0 0-2.8 0L5 19" />
            </svg>
            <span className="text-xs font-medium">Photo coming soon</span>
          </div>
        )}
      </div>
      <div className={`p-5 flex flex-col flex-1 ${featured ? "sm:p-6" : ""}`}>
        <h3 className={`font-display text-walnut mb-1.5 ${featured ? "text-2xl" : "text-lg"}`}>{name}</h3>
        <p className={`text-walnut/60 mb-4 flex-1 ${featured ? "text-base" : "text-sm"}`}>{shortDesc}</p>
        <span className={`inline-flex items-center gap-1.5 font-semibold text-ember group-hover:gap-2.5 transition-all ${featured ? "text-base" : "text-sm"}`}>
          See options
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
