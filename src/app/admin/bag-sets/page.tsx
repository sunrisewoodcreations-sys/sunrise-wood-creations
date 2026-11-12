import { createAdminClient } from "@/lib/supabase/admin";
import BagSetsForm from "@/components/BagSetsForm";
import { normalizeBagSets } from "@/lib/bagSets";

export const dynamic = "force-dynamic";

export default async function BagSetsPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  return <BagSetsForm initial={normalizeBagSets((data?.data as any)?.bagSets)} />;
}
