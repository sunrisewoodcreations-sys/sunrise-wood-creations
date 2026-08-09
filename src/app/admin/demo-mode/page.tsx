import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DemoModeControlPanel from "@/components/DemoModeControlPanel";

export const dynamic = "force-dynamic";

export default async function DemoModePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase.from("profiles").select("is_demo_account").eq("id", user!.id).single();
  if (currentProfile?.is_demo_account) {
    redirect("/admin");
  }

  const admin = createAdminClient();
  const { data: demoProfile } = await admin.from("profiles").select("id, email, is_demo_account").eq("is_demo_account", true).maybeSingle();
  const { data: emailLog } = await admin.from("demo_email_log").select("*").order("attempted_at", { ascending: false }).limit(50);
  const { count: demoOrdersCount } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("is_demo", true);
  const { count: demoCustomersCount } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_demo", true);
  const { count: demoQuotesCount } = await admin.from("quotes").select("id", { count: "exact", head: true }).eq("is_demo", true);

  return (
    <DemoModeControlPanel
      demoAccountExists={!!demoProfile}
      emailLog={emailLog || []}
      demoOrdersCount={demoOrdersCount || 0}
      demoCustomersCount={demoCustomersCount || 0}
      demoQuotesCount={demoQuotesCount || 0}
    />
  );
}
