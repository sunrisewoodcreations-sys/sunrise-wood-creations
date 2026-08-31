import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminMobileNav from "@/components/AdminMobileNav";
import AdminSidebarNav from "@/components/AdminSidebarNav";
import NavIcon from "@/components/AdminNavIcons";

async function getBadgeCounts(supabase: ReturnType<typeof createClient>) {
  const [{ count: unrespondedQuotes }, { count: unrespondedGuestChats }, { data: orders }, { data: customerMessages }, { count: pendingReviews }, { count: pendingFaq }] =
    await Promise.all([
      supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("responded", false),
      supabase.from("guest_messages").select("id", { count: "exact", head: true }).eq("responded", false),
      supabase.from("orders").select("id, admin_last_read_at"),
      supabase.from("order_messages").select("order_id, created_at").eq("sender_role", "customer"),
      supabase.from("product_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("faq_questions").select("id", { count: "exact", head: true }).eq("status", "pending")
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
    messages: unreadOrderIds.size + (unrespondedGuestChats || 0),
    reviews: pendingReviews || 0,
    faq: pendingFaq || 0
  };
}

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, is_demo_account").eq("id", user!.id).single();
  const badges = await getBadgeCounts(supabase);

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  // Every route below is completely unchanged from before — this is a
  // pure reorganization into collapsible categories, not a rewrite of
  // any page or functionality. Dashboard stays a standalone top-level
  // link (not nested in a category) since it's the default landing
  // page and the most frequently used single destination.
  const dashboardLink = { href: "/admin/dashboard", label: "Dashboard" };

  // The 4 pages used every day, promoted to one-click access above the
  // collapsible categories — same routes as their entries inside
  // Business/Production below, not a separate or different page.
  // "Production" links to the Production Queue, the day-to-day
  // operational view, matching the same choice already made for the
  // account dropdown's own "Production" shortcut.
  const quickLinks = [
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/queue", label: "Production" },
    { href: "/admin/calendar", label: "Calendar" }
  ];

  const categories = [
    {
      label: "Business",
      links: [
        { href: "/admin/orders", label: "Orders" },
        { href: "/admin/customers", label: "Customers" },
        { href: "/admin/quotes", label: "Quotes", badge: badges.quotes },
        { href: "/admin/messages", label: "Messages", badge: badges.messages },
        { href: "/admin/calendar", label: "Calendar" },
        { href: "/admin/pickup-appointments", label: "Pickup Appointments" }
      ]
    },
    {
      label: "Production",
      links: [
        { href: "/admin/queue", label: "Production Queue" },
        { href: "/admin/manufacturing-queue", label: "Manufacturing Queue" },
        { href: "/admin/shop-floor", label: "Shop Floor Mode" },
        { href: "/admin/schedule", label: "Production Schedule" },
        { href: "/admin/production-capacity", label: "Production Capacity" },
        { href: "/admin/cutlist", label: "Cut List Generator" },
        { href: "/admin/material-planning", label: "Material Planning" },
        { href: "/admin/production-analytics", label: "Production Analytics" },
        { href: "/admin/designs", label: "Designs" }
      ]
    },
    {
      label: "Inventory & Products",
      links: [
        { href: "/admin/products", label: "Products" },
        { href: "/admin/pickets", label: "Picket Inventory" }
      ]
    },
    {
      label: "Website Content",
      links: [
        { href: "/admin/homepage-carousel", label: "Homepage Carousel" },
        { href: "/admin/product-images", label: "Product Photos" },
        { href: "/admin/gallery", label: "Our Work Gallery" },
        { href: "/admin/reviews", label: "Customer Reviews", badge: badges.reviews },
        { href: "/admin/faq", label: "FAQ Questions", badge: badges.faq }
      ]
    },
    {
      label: "Reports",
      links: [
        { href: "/admin/reports", label: "Reports" }
      ]
    },
    {
      label: "Settings",
      links: [
        { href: "/admin/pickup-settings", label: "Pickup Settings" },
        { href: "/admin/website-status", label: "Website Status" }
      ]
    },
    {
      label: "Tools",
      links: [
        ...(profile?.is_demo_account ? [] : [{ href: "/admin/demo-mode", label: "Demo / Test Mode" }])
      ]
    }
    // Empty categories (Tools, for a demo account) are filtered out below
    // so a collapsible section never appears with nothing inside it.
  ].filter(category => category.links.length > 0);

  return (
    <div className="min-h-screen md:flex bg-white">
      <AdminMobileNav dashboardLink={dashboardLink} quickLinks={quickLinks} categories={categories} firstName={firstName} onSignOut={signOut} />

      <div className="hidden md:block w-60 bg-[#1E3A5F] text-white/80 p-6 flex-shrink-0">
        <Link href="/" className="block">
          <Image
            src="/logo-header.png"
            alt="Sunrise Wood Creations"
            width={900}
            height={455}
            className="h-10 w-auto mb-4"
          />
        </Link>
        <div className="text-white font-display text-base mb-8 break-words leading-snug">Hello, {firstName}</div>
        <Link href={dashboardLink.href} className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-white/10 text-white hover:text-white font-semibold">
          <NavIcon name={dashboardLink.label} />
          {dashboardLink.label}
        </Link>
        {/* Quick access — reachable in one click, same routes as their
            entries in the categories below (Orders/Business,
            Customers/Business, Production/Production, Calendar/Business) —
            not a separate or duplicate page, just a shortcut to it. */}
        <div className="flex flex-col gap-0.5 mb-3 pb-3 border-b border-white/10">
          {quickLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white text-sm"
            >
              <NavIcon name={link.label} />
              {link.label}
            </Link>
          ))}
        </div>
        <AdminSidebarNav categories={categories} />
        <form action={signOut} className="mt-6">
          <button className="text-xs text-white/50 hover:text-white">Log out</button>
        </form>
      </div>

      <div className="flex-1 p-4 md:p-8">
        {profile?.is_demo_account && (
          <div className="sticky top-0 z-50 -mx-4 -mt-4 mb-4 md:-mx-8 md:-mt-8 md:mb-6 bg-ember text-white px-4 py-2.5 text-center text-sm font-bold shadow-md">
            🧪 DEMO / TEST MODE — You're using a test account. Nothing here is a real customer or order. Emails never leave this system.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
