import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productLabel, ProductType } from "@/lib/statusSteps";
import CancelCampaignButton from "@/components/CancelCampaignButton";

function discountDisplay(coupon: any): string {
  if (!coupon) return "—";
  return coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `$${(coupon.discount_value / 100).toFixed(2)}`;
}

function appliesToDisplay(coupon: any): string {
  if (!coupon) return "—";
  if (coupon.applies_to_type === "all") return "Entire order";
  if (coupon.applies_to_type === "product_type") return productLabel(coupon.applies_to_value as ProductType);
  return "Specific product";
}

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: campaign } = await supabase.from("campaigns").select("*, coupons(*)").eq("id", params.id).single();
  if (!campaign) notFound();
  const coupon = Array.isArray(campaign.coupons) ? campaign.coupons[0] : campaign.coupons;

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("*, profiles:customer_id(full_name, email)")
    .eq("campaign_id", params.id)
    .order("created_at", { ascending: true });

  const { data: redemptions } = coupon
    ? await supabase
        .from("coupon_redemptions")
        .select("*, profiles:customer_id(full_name, email), orders:order_id(id, title, price_cents)")
        .eq("coupon_id", coupon.id)
        .order("redeemed_at", { ascending: false })
    : { data: [] as any[] };

  const revenueGeneratedCents = (redemptions || []).reduce((sum: number, r: any) => sum + (r.orders?.price_cents || 0), 0);
  const sentCount = (recipients || []).filter((r: any) => r.email_sent_at).length;

  return (
    <div className="bg-cream/40 -m-8 p-8 min-h-full">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/coupons" className="text-sm text-[#1E3A5F]/50 hover:underline">Coupons &amp; Campaigns</Link>
        <span className="text-[#1E3A5F]/30">/</span>
        <span className="text-sm text-[#1E3A5F]/50">{campaign.name}</span>
      </div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">{campaign.name}</h1>
        {campaign.status === "scheduled" && <CancelCampaignButton campaignId={campaign.id} />}
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        <span className="font-mono">{coupon?.code}</span> · {discountDisplay(coupon)} off · Applies to {appliesToDisplay(coupon)}
        {campaign.status === "scheduled" && campaign.scheduled_at && ` · Scheduled for ${new Date(campaign.scheduled_at).toLocaleString()}`}
      </p>

      {/* Analytics — only metrics that are actually real: no opens/clicks,
          since there's no email-tracking webhook wired up to this provider. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-display text-[#1E3A5F]">{(recipients || []).length}</div>
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide">Recipients</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-display text-[#1E3A5F]">{sentCount}</div>
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide">Sent</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-display text-sage">{(redemptions || []).length}</div>
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide">Redeemed</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-display text-sage">${(revenueGeneratedCents / 100).toFixed(2)}</div>
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide">Revenue Generated</div>
        </div>
      </div>

      <h2 className="font-display text-base text-[#1E3A5F] mb-3">Redemptions</h2>
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm mb-8">
        {(redemptions || []).length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">No redemptions yet.</p>
        ) : (
          (redemptions || []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#1E3A5F]">{r.profiles?.full_name}</div>
                <div className="text-xs text-[#1E3A5F]/50">
                  {r.orders ? <Link href={`/admin/orders/${r.orders.id}`} className="hover:underline">{r.orders.title}</Link> : "—"}
                  {" · "}${(r.discount_applied_cents / 100).toFixed(2)} discount
                </div>
              </div>
              <div className="text-xs text-[#1E3A5F]/40 whitespace-nowrap">{new Date(r.redeemed_at).toLocaleDateString()}</div>
            </div>
          ))
        )}
      </div>

      <h2 className="font-display text-base text-[#1E3A5F] mb-3">Recipients</h2>
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
        {(recipients || []).length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">No recipients yet.</p>
        ) : (
          (recipients || []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0">
              <div>
                <div className="text-sm font-semibold text-[#1E3A5F]">{r.profiles?.full_name}</div>
                <div className="text-xs text-[#1E3A5F]/50">{r.profiles?.email}</div>
              </div>
              <span className={`text-xs font-semibold ${r.email_sent_at ? "text-sage" : "text-[#1E3A5F]/40"}`}>
                {r.email_sent_at ? "Sent" : "Pending"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
