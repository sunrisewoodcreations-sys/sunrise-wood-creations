import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, ProductType } from "@/lib/statusSteps";

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

// "Expired" is derived here, not stored — a campaign's own status only
// ever says draft/scheduled/sending/sent/cancelled; if its coupon's
// expiration has passed, the badge reflects that on top of the real status.
function displayStatus(campaign: any, coupon: any): { label: string; color: string } {
  if (coupon?.expires_at && new Date(coupon.expires_at) < new Date() && campaign.status === "sent") {
    return { label: "Expired", color: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60" };
  }
  switch (campaign.status) {
    case "draft": return { label: "Draft", color: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60" };
    case "scheduled": return { label: "Scheduled", color: "bg-amber/20 text-amber" };
    case "sending": return { label: "Sending", color: "bg-amber/20 text-amber" };
    case "sent": return { label: "Sent", color: "bg-sage/15 text-sage" };
    case "cancelled": return { label: "Cancelled", color: "bg-ember/15 text-ember" };
    default: return { label: campaign.status, color: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60" };
  }
}

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const supabase = createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, coupons(*)")
    .order("created_at", { ascending: false });

  const campaignIds = (campaigns || []).map((c: any) => c.id);
  const [{ data: allRecipients }, { data: allRedemptions }] = await Promise.all([
    campaignIds.length > 0
      ? supabase.from("campaign_recipients").select("campaign_id, email_sent_at").in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as any[] }),
    campaignIds.length > 0
      ? supabase.from("coupon_redemptions").select("coupon_id")
      : Promise.resolve({ data: [] as any[] })
  ]);

  const rows = (campaigns || []).map((c: any) => {
    const coupon = Array.isArray(c.coupons) ? c.coupons[0] : c.coupons;
    const recipients = (allRecipients || []).filter((r: any) => r.campaign_id === c.id);
    const redemptions = coupon ? (allRedemptions || []).filter((r: any) => r.coupon_id === coupon.id) : [];
    return {
      campaign: c,
      coupon,
      recipientCount: recipients.length,
      sentCount: recipients.filter((r: any) => r.email_sent_at).length,
      redeemedCount: redemptions.length
    };
  });

  return (
    <div className="bg-cream/40 -m-8 p-8 min-h-full">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Coupons &amp; Campaigns</h1>
        <Link
          href="/admin/coupons/new"
          className="bg-ember text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          + Create Campaign
        </Link>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Targeted promotional coupons, sent to customers based on what they've bought before.</p>

      {rows.length === 0 ? (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#1E3A5F] mb-1">No campaigns yet</p>
          <p className="text-xs text-[#1E3A5F]/50 mb-4">Create your first campaign to start sending targeted coupons.</p>
          <Link href="/admin/coupons/new" className="inline-block bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold">
            + Create Campaign
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1E3A5F]/5 text-left text-xs text-[#1E3A5F]/50 uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Discount</th>
                  <th className="px-4 py-3 font-semibold">Applies To</th>
                  <th className="px-4 py-3 font-semibold text-right">Recipients</th>
                  <th className="px-4 py-3 font-semibold text-right">Sent</th>
                  <th className="px-4 py-3 font-semibold text-right">Redeemed</th>
                  <th className="px-4 py-3 font-semibold">Expires</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ campaign, coupon, recipientCount, sentCount, redeemedCount }) => {
                  const status = displayStatus(campaign, coupon);
                  return (
                    <tr key={campaign.id} className="border-t border-[#1E3A5F]/10 hover:bg-cream/40">
                      <td className="px-4 py-3">
                        <Link href={`/admin/coupons/${campaign.id}`} className="font-semibold text-[#1E3A5F] hover:underline">
                          {campaign.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#1E3A5F]/70">{coupon?.code || "—"}</td>
                      <td className="px-4 py-3 text-[#1E3A5F]">{discountDisplay(coupon)}</td>
                      <td className="px-4 py-3 text-[#1E3A5F]/70">{appliesToDisplay(coupon)}</td>
                      <td className="px-4 py-3 text-right text-[#1E3A5F]">{recipientCount}</td>
                      <td className="px-4 py-3 text-right text-[#1E3A5F]">{sentCount}</td>
                      <td className="px-4 py-3 text-right text-[#1E3A5F]">{redeemedCount}</td>
                      <td className="px-4 py-3 text-[#1E3A5F]/70">{coupon?.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-[#1E3A5F]/50 text-xs">{new Date(campaign.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — same data, stacked instead of a horizontally
              overflowing table. */}
          <div className="md:hidden flex flex-col gap-3">
            {rows.map(({ campaign, coupon, recipientCount, sentCount, redeemedCount }) => {
              const status = displayStatus(campaign, coupon);
              return (
                <Link
                  key={campaign.id}
                  href={`/admin/coupons/${campaign.id}`}
                  className="block bg-white border border-[#1E3A5F]/10 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-semibold text-[#1E3A5F]">{campaign.name}</div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${status.color}`}>{status.label}</span>
                  </div>
                  <div className="text-xs text-[#1E3A5F]/60 font-mono mb-2">{coupon?.code || "—"} · {discountDisplay(coupon)} · {appliesToDisplay(coupon)}</div>
                  <div className="flex gap-4 text-xs text-[#1E3A5F]/70">
                    <span>{recipientCount} recipients</span>
                    <span>{sentCount} sent</span>
                    <span>{redeemedCount} redeemed</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
