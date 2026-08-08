import { createClient } from "@/lib/supabase/server";
import QuoteEditor from "@/components/QuoteEditor";

export default async function NewQuotePage() {
  const supabase = createClient();

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("role", "customer").order("full_name", { ascending: true }),
    supabase.from("products").select("id, product_type, name, size_details, price_cents").order("name", { ascending: true })
  ]);

  return <QuoteEditor customers={customers || []} products={products || []} />;
}
