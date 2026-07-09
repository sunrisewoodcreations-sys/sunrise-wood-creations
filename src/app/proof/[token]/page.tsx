import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ProofPublicResponse from "@/components/ProofPublicResponse";

export default async function PublicProofPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: proof } = await supabase
    .from("proofs")
    .select("*, orders(title)")
    .eq("respond_token", params.token)
    .single();

  if (!proof) notFound();

  const order = (proof as any).orders;

  return (
    <div>
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-walnut/10 bg-cream">
        <Link href="/" className="font-display text-lg md:text-xl text-walnut font-semibold">
          Sunrise Wood Creations
        </Link>
      </header>

      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-cream">
        <div className="w-full max-w-lg bg-white border border-walnut/10 rounded-xl p-8">
          <h1 className="font-display text-2xl text-walnut mb-1">Design proof</h1>
          <p className="text-sm text-walnut/60 mb-6">{order?.title}</p>

          {proof.status !== "pending" ? (
            <p className="text-sm bg-sage/10 text-sage font-semibold p-4 rounded-md">
              {proof.status === "approved"
                ? "You've already approved this proof. Thanks!"
                : "You've already submitted feedback on this proof — we'll follow up soon."}
            </p>
          ) : (
            <ProofPublicResponse token={params.token} imageUrl={proof.image_url} />
          )}
        </div>
      </div>

      <footer className="bg-walnut text-cream text-center py-9 px-6 text-sm">
        <div>Sunrise Wood Creations</div>
        <div className="opacity-80 mt-1">(269) 762-1460 · sunrisewoodcreations@gmail.com</div>
      </footer>
    </div>
  );
}
