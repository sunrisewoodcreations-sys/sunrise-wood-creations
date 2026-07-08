import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  redirect(profile?.role === "admin" ? "/admin/customers" : "/account");
}
