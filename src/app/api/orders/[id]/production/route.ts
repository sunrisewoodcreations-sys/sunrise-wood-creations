import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_PRIORITIES = ["high", "normal", "low"];
const VALID_PRODUCTION_STATUSES = ["waiting", "building", "assembly", "finishing", "ready_for_pickup", "completed"];

// One route for every purely-internal production-schedule field
// (production date, priority, production status, production notes)
// instead of four near-identical endpoints. This never touches the
// customer-facing `status` column, never sends an email, and never
// runs any of the existing invoice/stock logic — it's a parallel,
// internal-only layer on top of the existing order.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const updatePayload: Record<string, any> = {};

  if ("productionDate" in body) {
    updatePayload.production_date = body.productionDate || null;
  }
  if ("priority" in body) {
    if (!VALID_PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    updatePayload.priority = body.priority;
  }
  if ("productionStatus" in body) {
    if (!VALID_PRODUCTION_STATUSES.includes(body.productionStatus)) {
      return NextResponse.json({ error: "Invalid production status" }, { status: 400 });
    }
    updatePayload.production_status = body.productionStatus;
  }
  if ("productionNotes" in body) {
    updatePayload.production_notes = body.productionNotes || null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("orders").update(updatePayload).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
