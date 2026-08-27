import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Next.js's file-convention approach: a file named exactly
// opengraph-image.tsx, sitting directly in src/app/, is automatically
// detected and wired into the site's <head> as the og:image (and
// twitter:image) meta tags for every page that doesn't define its own
// override — no changes needed to layout.tsx's metadata object at all,
// confirmed against the actual current file before writing this.
//
// Generated entirely from existing brand assets — the real logo file
// already in /public, and the exact colors already defined in
// tailwind.config.js — not an invented product photo, matching the
// same "no fake photography" rule followed everywhere else in this
// project. A plain system-safe font is used for the tagline text
// rather than the site's actual custom fonts (Fraunces/Work Sans),
// since loading custom web fonts into this specific image-generation
// context is meaningfully more complex for limited visual benefit
// here — flagged as a deliberate simplification, not an oversight.

export const runtime = "nodejs";
export const alt = "Sunrise Wood Creations — Handcrafted cornhole boards, signs, planters & cutting boards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logoData = await readFile(join(process.cwd(), "public", "logo-full.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // amber/10 -> cream, same gradient direction already used
          // for the real hero section, for visual consistency between
          // the shared image and the actual page someone lands on.
          background: "linear-gradient(to bottom, #FBF0E0, #F7F1E6)"
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoBase64} width={340} height={172} alt="" style={{ objectFit: "contain", marginBottom: 28 }} />
        <div
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: "#3D2B1F", // walnut
            marginBottom: 12
          }}
        >
          Built by hand. Made to last.
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#3D2B1F",
            opacity: 0.7
          }}
        >
          Custom cornhole boards · signs · planters · cutting boards
        </div>
      </div>
    ),
    { ...size }
  );
}
