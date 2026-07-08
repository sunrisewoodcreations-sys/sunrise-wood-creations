"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        return;
      }

      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const hashError = params.get("error_description");

      if (hashError) {
        setError(decodeURIComponent(hashError.replace(/\+/g, " ")));
        setReady(true);
        return;
      }

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token
        });
        if (sessionError) {
          setError("This link isn't valid anymore. Please request a new one.");
        }
      } else {
        setError("This link isn't valid anymore. Please request a new one.");
      }
      setReady(true);
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password needs to be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/post-login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-walnut/10 rounded-xl p-8">
        <h1 className="font-display text-2xl text-walnut mb-1">Set your password</h1>
        <p className="text-sm text-walnut/60 mb-6">Choose a password for your account.</p>

        {!ready ? (
          <p className="text-sm text-walnut/60">Checking your link...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1">New password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-walnut/15 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1">Confirm password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-walnut/15 rounded-md text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-walnut/70">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={e => setShowPassword(e.target.checked)}
                className="w-auto"
              />
              Show password
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-walnut text-cream py-2.5 rounded-md font-semibold text-sm disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
