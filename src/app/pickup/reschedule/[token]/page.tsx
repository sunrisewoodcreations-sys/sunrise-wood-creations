import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots } from "@/lib/pickupScheduling";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PickupSchedulingView from "@/components/PickupSchedulingView";

export default async function PickupReschedulePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: appointment } = await admin
    .from("pickup_appointments")
    .select("id, status, order_id, orders:order_id(title, customer_id, profiles:customer_id(full_name))")
    .eq("reschedule_token", params.token)
    .maybeSingle();

  if (!appointment) notFound();

  const order = (appointment as any).orders;
  const { data: items } = await admin
    .from("order_items")
    .select("quantity, title, products:product_id(name, image_url)")
    .eq("order_id", appointment.order_id);

  const alreadyUsed = appointment.status !== "scheduled";
  const availableDays = alreadyUsed ? [] : await getAvailableSlots(21);

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1">
        <PickupSchedulingView
          apiEndpoint={`/api/pickup/reschedule/${params.token}`}
          orderTitle={order?.title || "Your order"}
          customerName={order?.profiles?.full_name || "Customer"}
          items={(items || []).map((it: any) => ({
            name: it.products?.name || it.title,
            quantity: it.quantity,
            photoUrl: it.products?.image_url || null
          }))}
          alreadyUsed={alreadyUsed}
          availableDays={availableDays}
          heading="Reschedule Your Pickup"
          successMessage="Your pickup has been rescheduled — an updated confirmation email is on its way to you."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
