import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilitySettings } from "@/lib/pickupScheduling";
import PickupSettingsForm from "@/components/PickupSettingsForm";

export default async function PickupSettingsPage() {
  const settings = await getAvailabilitySettings();
  const admin = createAdminClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: blockedDates } = await admin
    .from("pickup_blocked_dates")
    .select("*")
    .gte("blocked_date", todayStr)
    .order("blocked_date", { ascending: true });

  return <PickupSettingsForm settings={settings} blockedDates={blockedDates || []} />;
}
