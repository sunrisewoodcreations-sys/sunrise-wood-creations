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

  // Production date is derived from pickup date (one day before, your
  // glue's 24-hour cure time) and kept in sync automatically — except
  // once an order is ready for pickup or fully completed, at which
  // point production is effectively done and shouldn't silently shift
  // just because the pickup date changed afterward.
  const { data: existingOrder } = await admin
    .from("orders")
    .select("production_status")
    .eq("id", params.id)
    .maybeSingle();

  const isProductionLocked = existingOrder?.production_status === "ready_for_pickup" || existingOrder?.production_status === "completed";

  function oneDayBefore(dateStr: string): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const updatePayload: Record<string, any> = { due_date: dueDate || null };
  if (!isProductionLocked) {
    updatePayload.production_date = dueDate ? oneDayBefore(dueDate) : null;
  }

  const { error } = await admin
    .from("orders")
    .update(updatePayload)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
