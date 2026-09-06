import { createClient } from "@/lib/supabase/server";
import CampaignBuilder from "@/components/CampaignBuilder";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const supabase = createClient();
  const { data: products } = await supabase.from("products").select("id, name, product_type").order("name");
  return <CampaignBuilder products={products || []} />;
}
