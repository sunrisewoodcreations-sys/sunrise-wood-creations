import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import NotificationPrefsForm from "@/components/NotificationPrefsForm";

export default async function AccountSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("notify_order_updates, notify_invoices, notify_proofs, notify_messages")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <Link href="/account" className="text-sm text-walnut/60 mb-4 inline-block">← Back to your orders</Link>
        <NotificationPrefsForm
          initialOrderUpdates={profile?.notify_order_updates ?? true}
          initialInvoices={profile?.notify_invoices ?? true}
          initialProofs={profile?.notify_proofs ?? true}
          initialMessages={profile?.notify_messages ?? true}
        />
      </div>
      <SiteFooter />
    </div>
  );
}
