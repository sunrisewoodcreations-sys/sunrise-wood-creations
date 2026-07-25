import { NextRequest, NextResponse } from "next/server";
import { checkMaterialAvailabilityForOrder } from "@/lib/materialPlanning";

// Thin wrapper so client components (like the Start Production button)
// can call the existing material-availability check — no new checking
// logic, just exposing what materialPlanning.ts already does.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await checkMaterialAvailabilityForOrder(params.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Couldn't check material availability" }, { status: 500 });
  }
}
