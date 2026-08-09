import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DemoModeControlPanel from "@/components/DemoModeControlPanel";

// Forces this page to always fetch fresh data on every visit, never a
// cached version.
export const dynamic = "force-dynamic";

export default async function DemoModePage() {
  // The identity check stays on the regular client — it needs to read
  // THIS session's own logged-in user correctly, which is exactly
  // what that client is for.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase.from("profiles").select("is_demo_account").eq("id", user!.id).single();
  if (currentProfile?.is_demo_account) {
    redirect("/admin");
  }

  // Everything actually displayed on the page uses the admin client
  // instead — same elevated-access pattern already used on other
  // admin-only pages throughout this app, and it sidesteps any RLS
  // policy silently filtering out rows it shouldn't (which returns
  // quietly empty rather than a visible error, which is exactly what
  // was happening here — this page already independently verified the
  // viewer is a real admin above, so this is safe).
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
