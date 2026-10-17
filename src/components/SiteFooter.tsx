import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";
import Image from "next/image";
import Link from "next/link";
import TrackedLink from "@/components/TrackedLink";

// Same footer as the homepage, shared so it stays in sync everywhere.
export default async function SiteFooter() {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  const content: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  return (
    // pb-24 on mobile leaves room for the fixed chat button (bottom-5,
    // 56px tall) so it never sits on top of the copyright line.
    <footer id="contact" className="bg-bark text-cream pt-12 pb-24 sm:pb-12 px-6 text-sm scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <div className="grid gap-10 sm:grid-cols-3 text-center sm:text-left">
          <div>
            <Image
              src="/logo-header.png"
              alt="Sunrise Wood Creations"
              width={900}
              height={455}
              className="h-16 w-auto mx-auto sm:mx-0 mb-3"
            />
            <p className="text-cream/70 leading-relaxed">Handmade in Michigan.<br />Built to order.</p>
            <nav aria-label="Footer" className="mt-3 flex flex-wrap justify-center sm:justify-start gap-x-5 text-cream/80">
              <Link href="/#products" className="py-2.5 hover:text-cream">Products</Link>
              <Link href="/#about" className="py-2.5 hover:text-cream">About</Link>
              <Link href="/#faq" className="py-2.5 hover:text-cream">FAQ</Link>
              <Link href="/request-quote" className="py-2.5 hover:text-cream">Custom Order</Link>
            </nav>
          </div>

          <div>
            <h2 className="font-display text-base text-amber mb-3">Contact</h2>
            <TrackedLink
              href={`tel:${content.contact.phone.replace(/\D/g, "")}`}
              className="inline-block bg-accent text-white font-semibold rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity"
              eventName="phone_click"
              eventParams={{ location: "footer" }}
            >
              Call {content.contact.phone}
            </TrackedLink>
            <div className="mt-3">
              <TrackedLink
                href={`mailto:${content.contact.email}`}
                className="inline-block py-1.5 text-cream/90 hover:text-cream break-all"
                eventName="email_click"
                eventParams={{ location: "footer" }}
              >
                {content.contact.email}
              </TrackedLink>
            </div>
            <div className="mt-3">
              <a
                href="https://www.facebook.com/share/19RchHQbjc/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Sunrise Wood Creations on Facebook"
                className="inline-flex items-center gap-2 py-2 text-cream/80 hover:text-cream"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
                </svg>
                Facebook
              </a>
            </div>
          </div>

          {/* Hours match the OpeningHoursSpecification in layout.tsx's JSON-LD.
              Update both places if hours ever change. */}
          <div>
            <h2 className="font-display text-base text-amber mb-3">Hours</h2>
            <div className="text-cream/90">Mon–Fri: 10:00 AM – 7:00 PM</div>
            <div className="text-cream/70 mt-1">Sat &amp; Sun: by appointment</div>
            <div className="text-cream/70 mt-3">Pickup in Lawrence, Michigan</div>
          </div>
        </div>

        <div className="mt-10 pt-5 border-t border-cream/15 text-center text-xs text-cream/60">
          &copy; {new Date().getFullYear()} Sunrise Wood Creations
        </div>
      </div>
    </footer>
  );
}
