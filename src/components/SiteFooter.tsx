import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";
import TrackedLink from "@/components/TrackedLink";

// Same footer as the homepage, shared so it stays in sync everywhere.
export default async function SiteFooter() {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  const content: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  return (
    // pb-20 (vs. the original py-9 on all sides) specifically gives the
    // fixed chat button — bottom-5, 56px tall, so it occupies roughly the
    // bottom 76px of the viewport — genuine empty space to float in when
    // a short page's footer is the last thing on screen, instead of
    // sitting on top of the contact info. break-all on the email only
    // (not the phone, which doesn't need it) guarantees that even a
    // longer address can't force the row wider than the viewport itself.
    <footer className="bg-walnut text-cream text-center pt-9 pb-20 px-6 text-sm">
      <div>Sunrise Wood Creations</div>
      <div className="opacity-80 mt-1.5 flex items-center justify-center gap-2 flex-wrap px-2">
        <TrackedLink
          href={`tel:${content.contact.phone.replace(/\D/g, "")}`}
          className="hover:text-cream hover:opacity-100 transition-opacity"
          eventName="phone_click"
          eventParams={{ location: "footer" }}
        >
          {content.contact.phone}
        </TrackedLink>
        <span aria-hidden="true">·</span>
        <TrackedLink
          href={`mailto:${content.contact.email}`}
          className="hover:text-cream hover:opacity-100 transition-opacity break-all"
          eventName="email_click"
          eventParams={{ location: "footer" }}
        >
          {content.contact.email}
        </TrackedLink>
      </div>
      {/* Hours match the OpeningHoursSpecification in layout.tsx's JSON-LD.
          Update both places if hours ever change. */}
      <div className="opacity-80 mt-1.5">Mon–Fri: 10:00 AM – 7:00 PM</div>
    </footer>
  );
}
