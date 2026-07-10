import { createClient } from "@/lib/supabase/server";
import AddProductForm from "@/components/AddProductForm";
import ProductRow from "@/components/ProductRow";

export default async function ProductsPage() {
  const supabase = createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-black mb-1">Products</h1>
      <p className="text-sm text-black/60 mb-6">
        Save products you make often so you can pick them instantly when creating an order.
      </p>

      <AddProductForm />

      <table className="w-full bg-white border border-black/10 rounded-xl overflow-hidden text-sm">
        <thead>
          <tr className="bg-black text-white text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Type</th>
            <th className="text-left px-4 py-3">Size / details</th>
            <th className="text-right px-4 py-3">Price</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products?.map((p: any) => (
            <ProductRow key={p.id} product={p} />
          ))}
          {products?.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-black/50">No products saved yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
