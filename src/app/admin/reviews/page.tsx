import { createClient } from "@/lib/supabase/server";
import AdminReviewsManager from "@/components/AdminReviewsManager";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const supabase = createClient();

  const { data: reviews } = await supabase.from("product_reviews").select("*").order("created_at", { ascending: false });
  const reviewList = reviews || [];

  const orderItemIds = [...new Set(reviewList.map((r: any) => r.order_item_id))];
  const customerIds = [...new Set(reviewList.map((r: any) => r.customer_id))];

  const { data: orderItems } = orderItemIds.length > 0
    ? await supabase.from("order_items").select("id, title, order_id").in("id", orderItemIds)
    : { data: [] as any[] };
  const { data: customers } = customerIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", customerIds)
    : { data: [] as any[] };

  const itemById: Record<string, any> = {};
  (orderItems || []).forEach((i: any) => { itemById[i.id] = i; });
  const customerById: Record<string, any> = {};
  (customers || []).forEach((c: any) => { customerById[c.id] = c; });

  const enrichedReviews = reviewList.map((r: any) => ({
    id: r.id,
    rating: r.rating,
    review_text: r.review_text,
    status: r.status,
    created_at: r.created_at,
    productTitle: itemById[r.order_item_id]?.title || "Unknown product",
    orderId: itemById[r.order_item_id]?.order_id || "",
    customerName: customerById[r.customer_id]?.full_name || "Unknown customer"
  }));

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Customer Reviews</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Approve, reject, or remove customer-submitted reviews.</p>
      <AdminReviewsManager reviews={enrichedReviews} />
    </div>
  );
}
