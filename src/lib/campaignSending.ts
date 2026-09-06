import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignEmail } from "@/lib/email";
import { getMatchingCustomers, excludeAlreadySent, MatchedCustomer } from "@/lib/campaignTargeting";
import { productLabel, ProductType } from "@/lib/statusSteps";

function discountDisplay(coupon: any): string {
  return coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `$${(coupon.discount_value / 100).toFixed(2)} off`;
}

function appliesToDisplay(coupon: any): string {
  if (coupon.applies_to_type === "all") return "your entire order";
  if (coupon.applies_to_type === "product_type") return productLabel(coupon.applies_to_value as ProductType);
  return "select items";
}

// Resolves the campaign's targeting spec into its final recipient list —
// same logic whether this is a live preview or the actual send, so the
// count shown before sending is always exactly what gets sent to.
export async function resolveCampaignRecipients(campaign: any): Promise<MatchedCustomer[]> {
  const spec = { type: campaign.targeting_type, ...(campaign.targeting_value || {}) };
  let customers = await getMatchingCustomers(spec);
  if (campaign.exclude_previously_sent) {
    customers = await excludeAlreadySent(campaign.id, customers);
  }
  return customers;
}

export async function sendCampaignNow(campaignId: string, opts?: { testEmailOverride?: string }) {
  const admin = createAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("*, coupons(*)").eq("id", campaignId).single();
  if (!campaign) return { error: "Campaign not found" };
  const coupon = Array.isArray(campaign.coupons) ? campaign.coupons[0] : campaign.coupons;
  if (!coupon) return { error: "Campaign has no coupon" };

  const isTest = !!opts?.testEmailOverride;
  const recipients = isTest
    ? [{ id: "preview", full_name: "Test Recipient", email: opts!.testEmailOverride!, phone: null }]
    : await resolveCampaignRecipients(campaign);

  if (recipients.length === 0) {
    return { error: "No customers match this campaign's targeting — nothing to send." };
  }

  if (!isTest) {
    await admin.from("campaigns").update({ status: "sending" }).eq("id", campaignId);
  }

  let sentCount = 0;
  const contact = await getContactInfoForCampaign(admin);

  for (const recipient of recipients) {
    const firstName = (recipient.full_name || "there").split(" ")[0];
    try {
      await sendCampaignEmail({
        toEmail: recipient.email,
        customerFirstName: firstName,
        emailSubject: campaign.email_subject,
        emailHeading: campaign.email_heading,
        emailBody: campaign.email_body,
        couponCode: coupon.code,
        discountDisplay: discountDisplay(coupon),
        expirationDisplay: coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : undefined,
        appliesToDisplay: appliesToDisplay(coupon),
        isPreview: isTest,
        contactPhone: contact.phone,
        contactEmail: contact.email
      });
      sentCount++;
      if (!isTest) {
        await admin.from("campaign_recipients").upsert(
          { campaign_id: campaignId, customer_id: recipient.id, email_sent_at: new Date().toISOString() },
          { onConflict: "campaign_id,customer_id" }
        );
      }
    } catch (err) {
      // One recipient's send failing shouldn't stop the rest of the
      // campaign — continue through the list, same principle as the
      // rest of this app's best-effort notification sends.
      console.error(`Campaign email failed for ${recipient.email}:`, err);
    }
  }

  if (!isTest) {
    await admin.from("campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaignId);
  }

  return { sentCount, totalRecipients: recipients.length };
}

async function getContactInfoForCampaign(admin: ReturnType<typeof createAdminClient>): Promise<{ phone?: string; email?: string }> {
  try {
    const { data } = await admin.from("site_settings").select("data").eq("id", 1).single();
    const contact = (data?.data as any)?.contact;
    if (contact?.phone && contact?.email) return { phone: contact.phone, email: contact.email };
  } catch {
    // Falls through to shell()'s own defaults.
  }
  return {};
}
