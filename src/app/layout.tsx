import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans, IBM_Plex_Mono } from "next/font/google";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${worksans.variable} ${plexmono.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
