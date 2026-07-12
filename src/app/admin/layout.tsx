import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen flex bg-white">
      <div className="w-60 bg-[#1E3A5F] text-white/80 p-6 flex-shrink-0">
        <div className="text-white font-display text-base mb-8 break-words leading-snug">Hello, {firstName}</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/admin/customers" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Customers</Link>
          <Link href="/admin/orders" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Orders</Link>
          <Link href="/admin/queue" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Queue</Link>
          <Link href="/admin/messages" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Messages</Link>
          <Link href="/admin/guest-messages" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Website Chats</Link>
          <Link href="/admin/quotes" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Quotes</Link>
          <Link href="/admin/report-settings" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Report Settings</Link>
          <Link href="/admin/products" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Products</Link>
          <Link href="/admin/designs" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Designs</Link>
          <Link href="/admin/reports" className="px-3 py-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white">Reports</Link>
        </nav>
        <form action={signOut} className="mt-10">
          <button className="text-xs text-white/50 hover:text-white">Log out</button>
        </form>
      </div>
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
