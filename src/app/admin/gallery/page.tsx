import { createClient } from "@/lib/supabase/server";
import GalleryManager from "@/components/GalleryManager";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const supabase = createClient();
  const { data: photos } = await supabase.from("gallery_photos").select("*").order("sort_order", { ascending: true });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Our Work Gallery</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Upload real finished-project photos for the homepage gallery. Use the arrows to reorder — changes appear on the live site immediately.
      </p>
      <GalleryManager initialPhotos={photos || []} />
    </div>
  );
}
