import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { dueDate } = await req.json();
  // Empty string means "clear the due date" — allowed.
  if (dueDate && isNaN(Date.parse(dueDate))) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ due_date: dueDate || null })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
