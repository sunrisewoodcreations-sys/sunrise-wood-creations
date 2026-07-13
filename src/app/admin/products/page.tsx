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
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Products</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Save products you make often so you can pick them instantly when creating an order.
      </p>

      <AddProductForm />

      <table className="w-full bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden text-sm">
        <thead>
          <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Type</th>
            <th className="text-left px-4 py-3">Size / details</th>
            <th className="text-right px-4 py-3">Price</th>
            <th className="text-right px-4 py-3">Cost</th>
            <th className="text-right px-4 py-3">Margin</th>
            <th className="text-right px-4 py-3">Stock</th>
            <th className="text-right px-4 py-3">Alert at</th>
            <th className="text-right px-4 py-3">Pickets/item</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products?.map((p: any) => (
            <ProductRow key={p.id} product={p} />
          ))}
          {products?.length === 0 && (
            <tr><td colSpan={10} className="px-4 py-6 text-center text-[#1E3A5F]/50">No products saved yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
