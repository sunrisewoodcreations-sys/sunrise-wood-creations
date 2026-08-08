import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkCapacityForDate, findEarliestAvailableDate } from "@/lib/productionCapacity";

// Called from the order-creation form while an admin is picking a due
// date, so they can see immediately whether it's realistic — reuses
// the same capacity functions already built and tested for the
// Production Capacity settings page, not a second calculation.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { productionDateStr, neededMinutes } = await req.json();
  if (!productionDateStr || !neededMinutes) {
    return NextResponse.json({ error: "Missing productionDateStr or neededMinutes" }, { status: 400 });
  }

  const check = await checkCapacityForDate(productionDateStr, Number(neededMinutes));
  const suggestedDate = check.fits ? null : await findEarliestAvailableDate(Number(neededMinutes), productionDateStr);

  return NextResponse.json({ ...check, suggestedDate });
}
