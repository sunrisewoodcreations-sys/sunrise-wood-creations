import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { createClient } from "@/lib/supabase/server";
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
