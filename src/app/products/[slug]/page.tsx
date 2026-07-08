import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

const PRODUCTS: Record<string, { name: string; tagline: string; description: string; points: string[] }> = {
  "cornhole-boards": {
    name: "Custom Cornhole Boards",
    tagline: "Regulation-size sets, built and painted to order.",
    description:
      "Every set is built from scratch and finished with your custom design — team colors, logos, family names, or whatever you have in mind. We'll send you a design proof to approve before we print, so you know exactly what you're getting.",
    points: [
      "Regulation 4' x 2' boards",
      "Custom painted or printed tops",
      "Bean bags included",
      "Design proof sent for your approval before production"
    ]
  },
  "wooden-signs": {
    name: "Custom Wooden Signs",
    tagline: "Personalized signs for your home or business.",
    description:
      "From farmhouse-style family name signs to business signage, each piece is cut, sanded, and finished by hand. Tell us your size, wording, and style, and we'll bring it to life.",
    points: ["Indoor or outdoor finishes", "Custom sizing", "Routed or painted lettering", "Ready to hang"]
  },
  "planter-boxes": {
    name: "Custom Planter Boxes",
    tagline: "Cedar and pine planters built to last outdoors.",
    description:
      "Built with weather-resistant wood and finished to hold up season after season. Perfect for porches, patios, and gardens, in the size that fits your space.",
    points: ["Cedar or pine construction", "Custom dimensions", "Natural or stained finish", "Built for outdoor use"]
  },
  "cutting-boards": {
    name: "Custom Cutting Boards",
    tagline: "End-grain and edge-grain boards, personalized.",
    description:
      "A functional piece and a keepsake — great for everyday use or as a gift. We can engrave names, dates, or a short message.",
    points: ["End-grain or edge-grain styles", "Food-safe finish", "Custom engraving available", "Great for gifts"]
  }
};

export function generateStaticParams() {
  return Object.keys(PRODUCTS).map(slug => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = PRODUCTS[params.slug];
  if (!product) return {};
  return {
    title: product.name,
    description: product.description
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = PRODUCTS[params.slug];
  if (!product) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let accountHref = "/login";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    accountHref = profile?.role === "admin" ? "/admin/customers" : "/account";
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-walnut/10 bg-cream">
        <Link href="/" className="font-display text-lg text-walnut font-semibold">Sunrise Wood Creations</Link>
        {user ? (
          <Link
            href={accountHref}
            aria-label="Your account"
            className="w-10 h-10 rounded-full bg-walnut text-cream flex items-center justify-center hover:opacity-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        ) : (
          <Link href="/login" className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold">Login</Link>
        )}
      </header>

      <section className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-walnut/60 mb-4 inline-block">← All products</Link>
        <h1 className="font-display text-3xl md:text-4xl text-walnut mb-2">{product.name}</h1>
        <p className="text-lg text-ember font-medium mb-6">{product.tagline}</p>
        <p className="text-walnut/70 mb-8 leading-relaxed">{product.description}</p>

        <ul className="space-y-2 mb-10">
          {product.points.map(point => (
            <li key={point} className="flex items-start gap-2 text-sm text-walnut/80">
              <span className="text-sage font-bold mt-0.5">✓</span> {point}
            </li>
          ))}
        </ul>

        <a href="tel:2697621460" className="inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold">
          Call to get a quote: (269) 762-1460
        </a>
      </section>

      <footer className="bg-walnut text-cream text-center py-9 px-6 text-sm">
        <div>Sunrise Wood Creations</div>
        <div className="opacity-80 mt-1">(269) 762-1460 · sunrisewoodcreations@gmail.com</div>
      </footer>
    </div>
  );
}
