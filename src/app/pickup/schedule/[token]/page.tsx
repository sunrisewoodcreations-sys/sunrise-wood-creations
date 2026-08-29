import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots } from "@/lib/pickupScheduling";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PickupSchedulingView from "@/components/PickupSchedulingView";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function PickupSchedulePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, title, pickup_scheduling_token_used_at, profiles:customer_id(full_name)")
    .eq("pickup_scheduling_token", params.token)
    .maybeSingle();

  if (!order) notFound();

  const { data: items } = await admin
    .from("order_items")
    .select("quantity, title, products:product_id(name, image_url)")
    .eq("order_id", order.id);

  const alreadyUsed = !!order.pickup_scheduling_token_used_at;
  const availableDays = alreadyUsed ? [] : await getAvailableSlots(21);

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1">
        <PickupSchedulingView
          apiEndpoint={`/api/pickup/schedule/${params.token}`}
          orderTitle={order.title}
          customerName={(order as any).profiles?.full_name || "Customer"}
          items={(items || []).map((it: any) => ({
            name: it.products?.name || it.title,
            quantity: it.quantity,
            photoUrl: it.products?.image_url || null
          }))}
          alreadyUsed={alreadyUsed}
          availableDays={availableDays}
          heading="Schedule Your Pickup"
          successMessage="A confirmation email with the full details is on its way to you."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
