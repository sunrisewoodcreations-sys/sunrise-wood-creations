import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrder, IncomingOrderItem } from "@/lib/orders";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const { customerId, dueDate } = body;

  if (!customerId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let items: IncomingOrderItem[];

  if (Array.isArray(body.items) && body.items.length > 0) {
    items = body.items;
  } else {
    const { productType, title, sizeDetails, priceCents, quantity, productId } = body;
    if (!productType || !title?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    items = [{ productType, productId, title, sizeDetails, quantity, priceCents }];
  }

  if (items.some(it => !it.productType || !it.title?.trim())) {
    return NextResponse.json({ error: "Every item needs a product type and title" }, { status: 400 });
  }

  const result = await createOrder({ customerId, dueDate, items });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, order: result.order });
}
