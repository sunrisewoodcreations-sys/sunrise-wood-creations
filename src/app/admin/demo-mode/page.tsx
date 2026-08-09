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

  // Capturing the error this time, not just the data — if this query
  // is failing for any reason, it's been failing completely silently
  // until now, which is exactly why nothing showed up with no visible
  // indication of a problem anywhere.
  const { data: emailLog, error: emailLogError } = await admin.from("demo_email_log").select("*").order("attempted_at", { ascending: false }).limit(50);

  const { count: demoOrdersCount } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("is_demo", true);
  const { count: demoCustomersCount } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_demo", true);
  const { count: demoQuotesCount } = await admin.from("quotes").select("id", { count: "exact", head: true }).eq("is_demo", true);

  return (
    <div>
      {emailLogError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontFamily: "monospace", fontSize: "13px" }}>
          <strong>DEBUG — the email log query is actually failing:</strong>
          <br />
          {JSON.stringify(emailLogError, null, 2)}
        </div>
      )}
      <DemoModeControlPanel
        demoAccountExists={!!demoProfile}
        emailLog={emailLog || []}
        demoOrdersCount={demoOrdersCount || 0}
        demoCustomersCount={demoCustomersCount || 0}
        demoQuotesCount={demoQuotesCount || 0}
      />
    </div>
  );
}
