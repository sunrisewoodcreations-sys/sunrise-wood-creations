import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AccountHeader() {
  const supabase = createClient();

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-walnut/10 bg-white">
      <Link href="/" className="font-display text-lg text-walnut font-semibold">
        Sunrise Wood Creations
      </Link>
      <form action={signOut}>
        <button className="text-sm text-walnut/60 hover:text-walnut">Log out</button>
      </form>
    </div>
  );
}
