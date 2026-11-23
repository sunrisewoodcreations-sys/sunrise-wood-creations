import type { Metadata } from "next";
import { proofTitleFromItems } from "@/lib/bagSets";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { recordProofView } from "@/lib/proofViews";
import ProofPublicResponse from "@/components/ProofPublicResponse";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import GuestChatWidget from "@/components/GuestChatWidget";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function PublicProofPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: proof } = await supabase
    .from("proofs")
    .select("*, orders(title)")
    .eq("respond_token", params.token)
    .single();

  if (!proof) notFound();

  // Note that the customer opened it, even for a second. Obvious bots (email
  // scanners, link previewers) are skipped inside recordProofView, and so are
  // you previewing while signed in as admin.
  try {
    const { data: { user } } = await createClient().auth.getUser();
    let viewerIsAdmin = false;
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      viewerIsAdmin = prof?.role === "admin";
    }
    if (!viewerIsAdmin) await recordProofView(supabase, proof as any, headers().get("user-agent"));
  } catch (err) {
    console.error("Couldn't record proof view:", err);
  }

  const order = (proof as any).orders;
  // Show only the boards in the proof's name — bags don't get a proof.
  const { data: proofItems } = await supabase.from("order_items").select("title").eq("order_id", proof.order_id).order("created_at", { ascending: true });
  const proofTitle = proofTitleFromItems((proofItems || []).map((i: any) => i.title), order?.title || "");

  return (
    <div>
      <SiteHeader />
      <main>
      <section className="min-h-[60vh] flex items-start justify-center px-4 py-10 sm:py-14 bg-gradient-to-b from-sawdust to-cream">
        <div className={`w-full ${(proof as any).image_url_2 ? "max-w-3xl" : "max-w-lg"} bg-white border border-walnut/10 rounded-xl p-8`}>
          <h1 className="font-display text-2xl text-walnut mb-1">Design proof</h1>
          <p className="text-sm text-walnut/60 mb-6">{proofTitle}</p>

          {proof.status !== "pending" ? (
            <p className="text-sm bg-sage/10 text-sage font-semibold p-4 rounded-md">
              {proof.status === "approved"
                ? "You've already approved this proof. Thanks!"
                : "You've already submitted feedback on this proof — we'll follow up soon."}
            </p>
          ) : (
            <>
              {proof.message && <p className="text-sm bg-cream border border-walnut/10 rounded-md p-3 mb-4 whitespace-pre-line text-walnut/80">{proof.message}</p>}
              <ProofPublicResponse token={params.token} imageUrl={proof.image_url} imageUrl2={(proof as any).image_url_2} design1={(proof as any).design1_decision} design2={(proof as any).design2_decision} />
            </>
          )}
        </div>
      </section>

      </main>
      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
