import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestAddresses, MapsError } from "@/lib/googleMaps";

// Address suggestions for the customer's delivery-address box. Only works
// with a real, unused delivery scheduling link, so strangers can't run up
// the Google bill. Never fails loudly: no suggestions just means the box
// works as a normal text box.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("fulfillment_method, pickup_scheduling_token_used_at")
    .eq("pickup_scheduling_token", params.token)
    .maybeSingle();
  if (!order || order.fulfillment_method !== "delivery" || order.pickup_scheduling_token_used_at) {
    return NextResponse.json({ suggestions: [] });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || q.length < 3) return NextResponse.json({ suggestions: [] });
  try {
    return NextResponse.json({ suggestions: await suggestAddresses(q, apiKey) });
  } catch (err) {
    return NextResponse.json({ suggestions: [], problem: err instanceof MapsError ? err.message : undefined });
  }
}
