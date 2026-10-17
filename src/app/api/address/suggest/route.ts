import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestAddresses, MapsError } from "@/lib/googleMaps";

// Address suggestions for the admin's address boxes. Admin only, so
// strangers can't run up the Google bill. It never fails loudly: if
// Google isn't set up (or errors), it returns no suggestions and the
// box simply works as a normal text box.
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }
  try {
    return NextResponse.json({ suggestions: await suggestAddresses(q, apiKey) });
  } catch (err) {
    return NextResponse.json({ suggestions: [], problem: err instanceof MapsError ? err.message : undefined });
  }
}
