import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminMobileNav from "@/components/AdminMobileNav";

async function getBadgeCounts(supabase: ReturnType<typeof createClient>) {
  const [{ count: unrespondedQuotes }, { count: unrespondedGuestChats }, { data: orders }, { data: customerMessages }] =
    await Promise.all([
      supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("responded", false),
      supabase.from("guest_messages").select("id", { count: "exact", head: true }).eq("responded", false),
      supabase.from("orders").select("id, admin_last_read_at"),
      supabase.from("order_messages").select("order_id, created_at").eq("sender_role", "customer")
    ]);

  const lastReadByOrder: Record<string, string | null> = {};
  (orders || []).forEach((o: any) => { lastReadByOrder[o.id] = o.admin_last_read_at; });

  const unreadOrderIds = new Set<string>();
  (customerMessages || []).forEach((m: any) => {
    const lastRead = lastReadByOrder[m.order_id];
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      unreadOrderIds.add(m.order_id);
    }
  });

  return {
    quotes: unrespondedQuotes || 0,
    messages: unreadOrderIds.size + (unrespondedGuestChats || 0)
  };
}

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-2 bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
      {count}
    </span>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
  const badges = await getBadgeCounts(supabase);

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const navLinks = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/queue", label: "Queue" },
    { href: "/admin/calendar", label: "Calendar" },
    { href: "/admin/messages", label: "Messages", badge: badges.messages },
    { href: "/admin/quotes", label: "Quotes", badge: badges.quotes },
    { href: "/admin/pickets", label: "Picket Inventory" },
    { href: "/admin/products", label: "Products" },
    { href: "/admin/designs", label: "Designs" },
    { href: "/admin/reports", label: "Reports" }
  ];

  return (
    <div className="min-h-screen md:flex bg-white">
      <AdminMobileNav links={navLinks} firstName={firstName} onSignOut={signOut} />

      {/* Desktop sidebar — completely unchanged, just now hidden below md
          and shown as a flex item at md and up, instead of always-on. */}
      <div className="hidden md:block w-60 bg-[#1E3A5F] text-white/80 p-6 flex-shrink-0">
        <div className="text-white font-display text-base mb-8 break-words leading-snug">Hello, {firstName}</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/admin/dashboard" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Dashboard</Link>
          <Link href="/admin/customers" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Customers</Link>
          <Link href="/admin/orders" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Orders</Link>
          <Link href="/admin/queue" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Queue</Link>
          <Link href="/admin/calendar" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Calendar</Link>
          <Link href="/admin/messages" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">
            Messages<Badge count={badges.messages} />
          </Link>
          <Link href="/admin/quotes" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">
            Quotes<Badge count={badges.quotes} />
          </Link>
          <Link href="/admin/pickets" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Picket Inventory</Link>
          <Link href="/admin/products" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Products</Link>
          <Link href="/admin/designs" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Designs</Link>
          <Link href="/admin/reports" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white flex items-center">Reports</Link>
        </nav>
        <form action={signOut} className="mt-10">
          <button className="text-xs text-white/50 hover:text-white">Log out</button>
        </form>
      </div>

      <div className="flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}
