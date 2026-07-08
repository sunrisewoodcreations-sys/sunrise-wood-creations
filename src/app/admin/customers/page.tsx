import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AddCustomerForm from "@/components/AddCustomerForm";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() || "";

  let customersQuery = supabase
    .from("profiles")
    .select("id, full_name, email, orders:orders(count)")
    .eq("role", "customer")
    .order("full_name");

  if (query) {
    customersQuery = customersQuery.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  }

  const { data: customers } = await customersQuery;

  return (
    <div>
      <h1 className="font-display text-2xl text-walnut mb-1">Customers</h1>
      <p className="text-sm text-walnut/60 mb-6">Search, view, and add customers.</p>

      <form method="GET" className="mb-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search customers by name or email..."
          className="w-full max-w-md px-3 py-2.5 border border-walnut/15 rounded-md text-sm"
        />
      </form>

      <AddCustomerForm />

      <table className="w-full bg-white border border-walnut/10 rounded-xl overflow-hidden text-sm">
        <thead>
          <tr className="bg-sawdust text-walnut text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Orders</th>
          </tr>
        </thead>
        <tbody>
          {customers?.map((c: any) => (
            <tr key={c.id} className="border-t border-walnut/10 hover:bg-cream/60">
              <td className="px-4 py-3">
                <Link href={`/admin/customers/${c.id}`} className="font-semibold text-walnut">
                  {c.full_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-walnut/70">{c.email}</td>
              <td className="px-4 py-3 text-walnut/70">{c.orders?.[0]?.count ?? 0}</td>
            </tr>
          ))}
          {customers?.length === 0 && (
            <tr><td colSpan={3} className="px-4 py-6 text-center text-walnut/50">No customers found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
