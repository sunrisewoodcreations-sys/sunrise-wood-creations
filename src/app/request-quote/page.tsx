import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import QuoteRequestForm from "@/components/QuoteRequestForm";
import GuestChatWidget from "@/components/GuestChatWidget";

export const metadata = {
  title: "Request a custom quote",
  description: "Tell us what you're picturing and we'll send you a custom quote.",
  alternates: { canonical: "/request-quote" }
};

export default function RequestQuotePage() {
  return (
    <div>
      <SiteHeader />
      <section className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl text-walnut mb-2">Request a custom quote</h1>
        <p className="text-walnut/70 mb-8">
          Tell us what you're picturing — size, wood type, timeline, anything that helps — and we'll get back to you with pricing.
        </p>
        <QuoteRequestForm />
      </section>
      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
