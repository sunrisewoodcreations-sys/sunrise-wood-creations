import { createAdminClient } from "@/lib/supabase/admin";
import DeliverySettingsForm from "@/components/DeliverySettingsForm";

export const dynamic = "force-dynamic";

export default async function DeliverySettingsPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("delivery_settings").select("*").eq("id", 1).maybeSingle();

  return (
    <DeliverySettingsForm
      initialHomeAddress={data?.home_address || ""}
      initialPerMileCents={data?.per_mile_cents || 0}
      initialMinimumCents={data?.minimum_fee_cents || 0}
      mapsConnected={!!process.env.GOOGLE_MAPS_API_KEY}
    />
  );
}
