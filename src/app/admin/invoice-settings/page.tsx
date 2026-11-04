import { createAdminClient } from "@/lib/supabase/admin";
import InvoiceSettingsForm from "@/components/InvoiceSettingsForm";
import { normalizeInvoiceSettings } from "@/lib/invoiceSettings";

export const dynamic = "force-dynamic";

export default async function InvoiceSettingsPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  return <InvoiceSettingsForm initial={normalizeInvoiceSettings((data?.data as any)?.invoice)} />;
}
