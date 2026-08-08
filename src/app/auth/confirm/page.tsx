"use client";

// Supabase sends the login token back as a URL *fragment*
// (#access_token=...), not a query parameter — fragments are
// browser-only and never reach a server, which is why the previous
// server-side version of this page could never actually see the
// token. This version runs in the browser instead, reads the
// fragment directly, and establishes the session from it.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const next = searchParams.get("next") || "/admin";
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) {
          setError(error.message);
          setTimeout(() => router.replace("/login?error=invalid_link"), 1500);
        } else {
          router.replace(next);
        }
      });
    } else {
      setError("No login token found in the link.");
      setTimeout(() => router.replace("/login?error=invalid_link"), 1500);
    }
  }, [router, searchParams]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <p style={{ color: error ? "#b91c1c" : "#1E3A5F" }}>
        {error ? `${error} — redirecting to login...` : "Signing you in..."}
      </p>
    </div>
  );
}
