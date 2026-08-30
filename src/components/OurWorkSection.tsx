import HeroCarousel from "@/components/HeroCarousel";

type Photo = { id: string; image_url: string; caption: string | null };

// Reuses the exact same HeroCarousel already used for the hero and
// every product page — same aspect ratio, rounded corners, shadow,
// swipe, and arrow/dot navigation — rather than a second, separate
// carousel implementation. When there are no real gallery photos yet,
// this falls back to a single placeholder slide so the same "Photo
// coming soon" treatment already used site-wide appears here too,
// instead of a separate custom empty-state message.
export default function OurWorkSection({ photos }: { photos: Photo[] }) {
  const slides = photos.length > 0
    ? photos.map(photo => ({ src: photo.image_url, alt: photo.caption || "A Sunrise Wood Creations finished project" }))
    : [{ src: null, alt: "A Sunrise Wood Creations finished project" }];

  return (
    <section id="gallery" className="max-w-5xl mx-auto px-6 py-14 md:py-20 scroll-mt-16">
      <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">Our Work</h2>
      <p className="text-center text-walnut/60 mb-10">A look at finished projects, straight from the shop.</p>
      <HeroCarousel slides={slides} />
    </section>
  );
}
