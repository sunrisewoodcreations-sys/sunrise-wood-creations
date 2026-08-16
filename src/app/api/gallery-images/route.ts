import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return adminProfile?.role === "admin";
}

// Upload a new photo — reuses the same storage bucket already proven
// for the carousel (site-images), just a separate "gallery/" prefix
// within it so the two collections don't mix.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string | null) || null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("site-images")
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = admin.storage.from("site-images").getPublicUrl(path);

  // New photo goes to the end of the current order — one more than
  // whatever the current highest sort_order is, so it doesn't require
  // renumbering anything else.
  const { data: existing } = await admin.from("gallery_photos").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data: inserted, error: insertError } = await admin
    .from("gallery_photos")
    .insert({ image_url: publicUrlData.publicUrl, caption, sort_order: nextSortOrder })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  return NextResponse.json({ ok: true, photo: inserted });
}

// Delete a photo. Removing the database row is what actually controls
// whether it appears anywhere — best-effort storage cleanup happens
// too, but a failure there doesn't block the deletion the admin asked
// for (an orphaned file with nothing pointing to it is a minor, later
// cleanup concern, not a reason to leave a deleted-looking photo
// still showing up).
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: photo } = await admin.from("gallery_photos").select("image_url").eq("id", id).maybeSingle();

  const { error } = await admin.from("gallery_photos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (photo?.image_url) {
    const path = photo.image_url.split("/site-images/")[1];
    if (path) {
      await admin.storage.from("site-images").remove([path]).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

// Reorder by swapping sort_order between two specific photos — moving
// one photo up swaps it with whatever is currently directly above it,
// and vice versa for down. Swapping two values instead of renumbering
// the whole list is simpler and can't accidentally corrupt ordering
// for photos not involved in this particular move.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { idA, idB } = await req.json();
  if (!idA || !idB) return NextResponse.json({ error: "Missing idA/idB" }, { status: 400 });

  const admin = createAdminClient();
  const { data: photos } = await admin.from("gallery_photos").select("id, sort_order").in("id", [idA, idB]);
  if (!photos || photos.length !== 2) return NextResponse.json({ error: "Both photos must exist" }, { status: 404 });

  const photoA = photos.find(p => p.id === idA)!;
  const photoB = photos.find(p => p.id === idB)!;

  await admin.from("gallery_photos").update({ sort_order: photoB.sort_order }).eq("id", idA);
  await admin.from("gallery_photos").update({ sort_order: photoA.sort_order }).eq("id", idB);

  return NextResponse.json({ ok: true });
}
