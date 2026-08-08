import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoAccountRequest } from "@/lib/demoMode";
import AddCustomerForm from "@/components/AddCustomerForm";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() || "";

  const isDemoAccount = await isDemoAccountRequest();

  let customersQuery = supabase
    .from("profiles")
    .select("id, full_name, email, phone, has_real_email, orders:orders(price_cents, amount_paid_cents)")
    .eq("role", "customer")
    .eq("is_demo", isDemoAccount)
    .order("full_name");

  if (query) {
    customersQuery = customersQuery.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
  }

  const { data: customers } = await customersQuery;

  const rows = (customers || []).map((c: any) => {
    const orders = c.orders || [];
    const totalSalesCents = orders.reduce((sum: number, o: any) => sum + (o.price_cents || 0), 0);
    const totalPaidCents = orders.reduce((sum: number, o: any) => sum + (o.amount_paid_cents || 0), 0);
    const owedCents = totalSalesCents - totalPaidCents;
    return {
      ...c,
      orderCount: orders.length,
      totalSales: totalSalesCents / 100,
      totalPaid: totalPaidCents / 100,
      owed: owedCents / 100
    };
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Customers</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Search, view, and add customers.</p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form method="GET" className="flex-1 min-w-[240px]">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search customers by name, email, or phone..."
            className="w-full px-3 py-2.5 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </form>
        <a
          href="/api/export/customers"
          className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-2 rounded-md text-xs font-semibold hover:bg-cream whitespace-nowrap"
        >
          Export CSV
        </a>
      </div>

      <AddCustomerForm />

      <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Orders</th>
            <th className="text-right px-4 py-3">Sales</th>
            <th className="text-right px-4 py-3">Paid</th>
            <th className="text-right px-4 py-3">Owed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c: any) => (
            <tr key={c.id} className="border-t border-[#1E3A5F]/10 hover:bg-cream/60">
              <td className="px-4 py-3">
                <Link href={`/admin/customers/${c.id}`} className="font-semibold text-[#1E3A5F]">
                  {c.full_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#1E3A5F]/70">{c.has_real_email === false ? <span className="text-[#1E3A5F]/40 italic">No email on file</span> : c.email}</td>
              <td className="px-4 py-3 text-[#1E3A5F]/70">{c.orderCount}</td>
              <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${c.totalSales.toFixed(2)}</td>
              <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${c.totalPaid.toFixed(2)}</td>
              <td className={`px-4 py-3 text-right font-semibold ${c.owed > 0 ? "text-ember" : "text-sage"}`}>
                ${c.owed.toFixed(2)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-[#1E3A5F]/50">No customers found.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
