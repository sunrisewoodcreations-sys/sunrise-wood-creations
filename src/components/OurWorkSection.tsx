type Photo = { id: string; image_url: string; caption: string | null };

export default function OurWorkSection({ photos }: { photos: Photo[] }) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-14 md:py-20">
      <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">Our Work</h2>
      <p className="text-center text-walnut/60 mb-10">A look at finished projects, straight from the shop.</p>

      {photos.length === 0 ? (
        <div className="text-center text-walnut/40 border border-walnut/10 rounded-xl py-14 bg-sawdust/40">
          <p className="text-sm font-medium">Photos coming soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {photos.map(photo => (
            <div key={photo.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-sawdust">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.image_url}
                alt={photo.caption || "A Sunrise Wood Creations finished project"}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-walnut/80 text-cream text-xs px-3 py-2">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
