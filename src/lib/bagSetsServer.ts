import { createAdminClient } from "@/lib/supabase/admin";
import { BagSet, normalizeBagSets } from "@/lib/bagSets";

// Server-side loader for the bag sets saved in Admin > Cornhole Bag Sets.
export async function getBagSets(): Promise<BagSet[]> {
  try {
    const { data } = await createAdminClient().from("site_settings").select("data").eq("id", 1).maybeSingle();
    return normalizeBagSets((data?.data as any)?.bagSets);
  } catch {
    return [];
  }
}
