import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import MyReviewsList from "@/components/MyReviewsList";
import { getAllEligibleOrderItems } from "@/lib/reviewEligibility";

export default async function AccountReviewsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const items = await getAllEligibleOrderItems(user.id);
  const itemIds = items.map(i => i.id);

  const { data: existingReviews } = itemIds.length > 0
    ? await supabase.from("product_reviews").select("id, order_item_id, rating, review_text, status").in("order_item_id", itemIds)
    : { data: [] as any[] };

  const reviewsByItemId: Record<string, any> = {};
  (existingReviews || []).forEach((r: any) => { reviewsByItemId[r.order_item_id] = r; });

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <AccountNav current="/account/reviews" />
        <h1 className="font-display text-2xl text-walnut mb-1">My Reviews</h1>
        <p className="text-sm text-walnut/60 mb-6">Products from your completed orders — share what you thought.</p>
        <MyReviewsList items={items} reviewsByItemId={reviewsByItemId} />
      </div>
      <SiteFooter />
    </div>
  );
}
