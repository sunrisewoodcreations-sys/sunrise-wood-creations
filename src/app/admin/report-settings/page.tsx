import { createClient } from "@/lib/supabase/server";
import ReportSettingsForm from "@/components/ReportSettingsForm";

export default async function ReportSettingsPage() {
  const supabase = createClient();

  const { data: settings } = await supabase.from("report_settings").select("*").eq("id", 1).maybeSingle();

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Financial report settings</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Get an automatic email showing sales, profit, sales tax owed, and a suggested income-tax set-aside — as often as you want.
      </p>

      <ReportSettingsForm
        initialFrequency={settings?.frequency || "off"}
        initialMichiganPercent={Number(settings?.michigan_income_tax_percent) || 4.25}
        initialFederalPercent={Number(settings?.federal_income_tax_percent) || 15.3}
        initialEmail={settings?.recipient_email || "sunrisewoodcreations@gmail.com"}
      />
    </div>
  );
}
