import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Replaces a product's entire build-step checklist in one go — same
// "delete all, insert fresh" approach already used for BOM parts, not
// a different pattern for what's structurally the same kind of edit.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { steps } = await req.json();
  if (!Array.isArray(steps)) {
    return NextResponse.json({ error: "Expected a list of steps" }, { status: 400 });
  }

  const { error: deleteError } = await supabase.from("product_checklist_items").delete().eq("product_id", params.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  const nonBlankSteps = steps.map((s: string) => s.trim()).filter(Boolean);
  if (nonBlankSteps.length > 0) {
    const rows = nonBlankSteps.map((stepText: string, i: number) => ({ product_id: params.id, step_text: stepText, sort_order: i }));
    const { error: insertError } = await supabase.from("product_checklist_items").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
