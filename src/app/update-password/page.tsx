"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Supabase sends people here from two different emails:
// 1. The "set up your account" invite email (new customers)
// 2. The "reset your password" email (forgot password)
// Both links log the person in with a temporary token and land here so
// they can choose their real password.
export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-walnut mb-1">New password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-walnut/15 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-walnut mb-1">Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-walnut/15 rounded-md text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-walnut text-cream py-2.5 rounded-md font-semibold text-sm disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
