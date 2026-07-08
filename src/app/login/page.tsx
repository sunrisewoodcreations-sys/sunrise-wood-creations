"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [showContactModal, setShowContactModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError("That email and password don't match. Try again.");
      return;
    }

    router.push("/post-login");
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`
    });
    setLoading(false);
    setResetSent(true);
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {mode === "login" && (
          <div className="bg-white border border-walnut/10 rounded-xl p-8">
            <h1 className="font-display text-2xl text-walnut mb-1">Log in</h1>
            <p className="text-sm text-walnut/60 mb-6">
              Enter your email and password to see your orders.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-walnut mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-walnut/15 rounded-md text-sm"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-walnut mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-16 border border-walnut/15 rounded-md text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-walnut/60 hover:text-walnut"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-walnut/70">
                  <input type="checkbox" defaultChecked className="w-auto" />
                  Keep me logged in
                </label>
                <button type="button" onClick={() => setMode("forgot")} className="text-ember font-semibold">
                  Forgot password?
                </button>
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-walnut text-cream py-2.5 rounded-md font-semibold text-sm disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>

            <p className="text-sm mt-4 text-walnut/70">
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => setShowContactModal(true)} className="text-ember font-semibold">
                Create one
              </button>
            </p>
          </div>
        )}

        {mode === "forgot" && (
          <div className="bg-white border border-walnut/10 rounded-xl p-8">
            <h1 className="font-display text-2xl text-walnut mb-1">Reset your password</h1>
            <p className="text-sm text-walnut/60 mb-6">
              Enter the email on your account and we&apos;ll send a link to set a new password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-walnut/15 rounded-md text-sm"
                placeholder="you@email.com"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-ember text-white px-5 py-2.5 rounded-md font-semibold text-sm"
                >
                  Send reset link
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setResetSent(false); }}
                  className="border border-walnut text-walnut px-5 py-2.5 rounded-md font-semibold text-sm"
                >
                  Back to login
                </button>
              </div>
              {resetSent && (
                <p className="text-sm bg-amber/20 text-walnut p-3 rounded-md">
                  Check your email — we&apos;ve sent a link to reset your password. It&apos;s good for 24 hours.
                </p>
              )}
            </form>
          </div>
        )}
      </div>

      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h2 className="font-display text-xl text-walnut mb-2">Accounts start with an order</h2>
            <p className="text-sm text-walnut/70 mb-4">
              We set up your account once you&apos;ve placed an order with us. Reach out and we&apos;ll get you started.
            </p>
            <p className="text-sm font-semibold text-walnut mb-1">Phone: (269) 762-1460</p>
            <p className="text-sm font-semibold text-walnut mb-5">Email: sunrisewoodcreations@gmail.com</p>
            <button
              onClick={() => setShowContactModal(false)}
              className="w-full bg-walnut text-cream py-2 rounded-md text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
