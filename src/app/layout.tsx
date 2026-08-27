import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT } from "@/lib/siteContent";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const worksans = Work_Sans({ subsets: ["latin"], variable: "--font-worksans" });
const plexmono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plexmono" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com"),
  title: {
    default: "Sunrise Wood Creations | Custom cornhole boards, signs, planters & cutting boards",
    template: "%s | Sunrise Wood Creations"
  },
  description:
    "Handcrafted custom cornhole boards, wooden signs, planter boxes, and cutting boards, built to order in Michigan.",
  openGraph: {
    type: "website",
    siteName: "Sunrise Wood Creations"
  },
  robots: { index: true, follow: true }
};

// Static, site-wide LocalBusiness data — deliberately excludes a
// street address per an explicit privacy decision (pickup happens at
// the shop; publishing the exact address risked people showing up
// unannounced). City/state alone still gives Google meaningful local
// search context without that risk. Weekend hours are "by appointment
// only," which has no clean structured equivalent in schema.org's
// opening-hours format, so that's noted in plain text in the
// description instead of forced into a format that doesn't fit.
const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Sunrise Wood Creations",
  description:
    "Handcrafted custom cornhole boards, wooden signs, planter boxes, and cutting boards, built to order in Michigan. Weekend appointments available by request.",
  telephone: `+1${DEFAULT_SITE_CONTENT.contact.phone.replace(/\D/g, "")}`,
  email: DEFAULT_SITE_CONTENT.contact.email,
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Lawrence",
    addressRegion: "MI",
    addressCountry: "US"
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "10:00",
      closes: "19:00"
    }
  ],
  sameAs: ["https://www.facebook.com/share/19RchHQbjc/?mibextid=wwXIfr"]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Excludes the site owner's own admin activity from analytics — a
  // logged-in admin browsing and testing the real site (including
  // while Coming Soon is active, per the existing bypass) never
  // triggers the GA4 script at all, so none of that activity is ever
  // reported as if it were a real visitor. Degrades safely to "not
  // admin" (i.e. analytics loads normally) if this check fails for
  // any reason, rather than risking breaking the page for a real
  // visitor over an analytics-exclusion detail.
  let isAdminViewer = false;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      isAdminViewer = profile?.role === "admin";
    }
  } catch {
    isAdminViewer = false;
  }

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${worksans.variable} ${plexmono.variable} font-body`}>
        {/* JSON-LD is valid anywhere in the document, same as the GA4
            script below — Google's own guidance confirms this doesn't
            need to be in <head> specifically. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        {children}
        {/* Only renders once a real measurement ID is actually
            configured (site works completely normally without one —
            this is "prepared for GA4," not "requires GA4"), and never
            for an authenticated admin. */}
        {gaId && !isAdminViewer && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
