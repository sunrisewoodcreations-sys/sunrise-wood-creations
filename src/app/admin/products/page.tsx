import { createClient } from "@/lib/supabase/server";
import { productLabel, ProductType } from "@/lib/statusSteps";
import AddProductForm from "@/components/AddProductForm";
import DeleteProductButton from "@/components/DeleteProductButton";

export default async function ProductsPage() {
  const supabase = createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-walnut mb-1">Products</h1>
      <p className="text-sm text-walnut/60 mb-6">
        Save products you make often so you can pick them instantly when creating an order.
      </p>

      <AddProductForm />

      <table className="w-full bg-white border border-walnut/10 rounded-xl overflow-hidden text-sm">
        <thead>
          <tr className="bg-sawdust text-walnut text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Type</th>
            <th className="text-left px-4 py-3">Size / details</th>
            <th className="text-right px-4 py-3">Price</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products?.map((p: any) => (
            <tr key={p.id} className="border-t border-walnut/10">
              <td className="px-4 py-3 font-semibold text-walnut">{p.name}</td>
              <td className="px-4 py-3 text-walnut/70">{productLabel(p.product_type as ProductType)}</td>
              <td className="px-4 py-3 text-walnut/70">{p.size_details || "—"}</td>
              <td className="px-4 py-3 text-right text-walnut/70">${(p.price_cents / 100).toFixed(2)}</td>
              <td className="px-4 py-3 text-right">
                <DeleteProductButton productId={p.id} />
              </td>
            </tr>
          ))}
          {products?.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-walnut/50">No products saved yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
