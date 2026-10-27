import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots, getAvailabilitySettings } from "@/lib/pickupScheduling";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PickupSchedulingView from "@/components/PickupSchedulingView";
import DeliveryAddressStep from "@/components/DeliveryAddressStep";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function PickupSchedulePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, title, due_date, fulfillment_method, delivery_address, delivery_drive_minutes, pickup_scheduling_token_used_at, profiles:customer_id(full_name, address)")
    .eq("pickup_scheduling_token", params.token)
    .maybeSingle();

  if (!order) notFound();

  const { data: items } = await admin
    .from("order_items")
    .select("quantity, title, products:product_id(name, image_url)")
    .eq("order_id", order.id);

  const alreadyUsed = !!order.pickup_scheduling_token_used_at;
  const isDelivery = order.fulfillment_method === "delivery";

  // Delivery needs the address (and so the drive time) before any times
  // can be shown, because how long the trip takes decides what fits.
  if (isDelivery && !alreadyUsed && !(order.delivery_drive_minutes > 0)) {
    return (
      <div className="min-h-screen flex flex-col bg-cream">
        <SiteHeader />
        <main className="flex-1">
          <DeliveryAddressStep
            apiEndpoint={`/api/pickup/schedule/${params.token}/address`}
            orderTitle={order.title}
            customerName={(order as any).profiles?.full_name || "Customer"}
            initialAddress={order.delivery_address || ""}
          />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const availableDays = alreadyUsed ? [] : await getAvailableSlots(21, isDelivery ? { kind: "delivery", driveMinutes: order.delivery_drive_minutes, notBefore: order.due_date } : { notBefore: order.due_date });
  const settings = await getAvailabilitySettings();

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
          heading={isDelivery ? "Schedule Your Delivery" : "Schedule Your Pickup"}
          kind={isDelivery ? "delivery" : "pickup"}
          earliestDate={order.due_date || undefined}
          deliveryAddress={order.delivery_address || undefined}
          businessAddress={settings.business_address}
          pickupInstructions={settings.pickup_instructions}
          successMessage="A confirmation email with the full details is on its way to you."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
