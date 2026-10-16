import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Always redirects immediately and never renders any real content, but
// gets this anyway for consistency with every other private page.
export const metadata = {
  robots: { index: false, follow: false }
};

// There's only one login form on the whole site. This page is the traffic
// cop: it looks up whether the person who just logged in is you (admin)
// or a customer, and sends them to the right dashboard.
export default async function PostLoginPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(profile?.role === "admin" ? "/admin" : "/account");
}
