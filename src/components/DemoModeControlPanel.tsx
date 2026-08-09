"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EmailLogEntry = {
  id: string;
  attempted_at: string;
  email_type: string;
  intended_recipient: string;
  redirected_to: string;
  subject: string | null;
  html_body: string | null;
  success: boolean;
  error_message: string | null;
};

export default function DemoModeControlPanel({
  demoAccountExists,
  emailLog,
  demoOrdersCount,
  demoCustomersCount,
  demoQuotesCount
}: {
  demoAccountExists: boolean;
  emailLog: EmailLogEntry[];
  demoOrdersCount: number;
  demoCustomersCount: number;
  demoQuotesCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [viewingEmail, setViewingEmail] = useState<EmailLogEntry | null>(null);
  // Holds the freshly-issued demo password so it can be shown once —
  // never stored anywhere, never re-displayed after a page refresh.
  const [demoPassword, setDemoPassword] = useState<{ email: string; password: string } | null>(null);

  async function handleSetupAccount() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/demo-mode/setup-account", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't set up the demo account."); return; }
    router.refresh();
  }

  async function handleGenerateLink() {
    setBusy(true);
    setError("");
    setGeneratedLink("");
    const res = await fetch("/api/demo-mode/generate-link", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't generate a login link."); return; }
    setGeneratedLink(body.link);
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleSetPassword() {
    setBusy(true);
    setError("");
    setDemoPassword(null);
    const res = await fetch("/api/demo-mode/set-password", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't set a password."); return; }
    setDemoPassword({ email: body.email, password: body.password });
  }

  async function handleResetData() {
    if (!confirm(`This will permanently delete ${demoOrdersCount} demo order(s), ${demoQuotesCount} demo quote(s), and ${demoCustomersCount} demo customer(s). Continue?`)) return;
    setBusy(true);
    setError("");
    setResetMessage("");
    const res = await fetch("/api/demo-mode/reset-data", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't reset demo data."); return; }
    setResetMessage(`Deleted ${body.ordersDeleted} order(s), ${body.quotesDeleted} quote(s), ${body.customersDeleted} customer(s).`);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Demo / Test Mode</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Give an outside tester full access to a real, working admin panel — completely isolated from your real customers, orders, and emails.
      </p>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
        <h2 className="font-display text-base text-[#1E3A5F] mb-3">1. Demo account</h2>
        {!demoAccountExists ? (
          <>
            <p className="text-sm text-[#1E3A5F]/60 mb-3">No demo account exists yet — set one up once, then generate login links or a password from it any time.</p>
            <button onClick={handleSetupAccount} disabled={busy} className="bg-[#1E3A5F] text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {busy ? "Setting up..." : "Set up demo account"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-sage font-semibold mb-3">✓ Demo account exists and is ready.</p>

            <button onClick={handleGenerateLink} disabled={busy} className="bg-[#1E3A5F] text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {busy ? "Generating..." : "Generate a new login link"}
            </button>
            {generatedLink && (
              <div className="mt-3 bg-cream rounded-lg p-3">
                <p className="text-xs text-[#1E3A5F]/60 mb-2">Send this link to your tester however you like. It logs them straight into the demo account — no password needed.</p>
                <div className="flex gap-2">
                  <input readOnly value={generatedLink} className="flex-1 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs font-mono" onClick={e => (e.target as HTMLInputElement).select()} />
                  <button onClick={handleCopyLink} className="bg-sage text-white rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap">
                    {linkCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-[10px] text-[#1E3A5F]/40 mt-2">A fresh link is generated each time — use it right away, since it expires after a while and can only be used once.</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[#1E3A5F]/10">
              <p className="text-xs text-[#1E3A5F]/60 mb-2">
                Prefer a normal email/password login instead of a link? Set one here — works through the regular login page, no magic link needed.
              </p>
              <button onClick={handleSetPassword} disabled={busy} className="border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {busy ? "Setting..." : "Set / reset demo password"}
              </button>
              {demoPassword && (
                <div className="mt-3 bg-cream rounded-lg p-3">
                  <p className="text-xs font-bold text-ember mb-2">DEMO TEST credentials — shown once, save them now:</p>
                  <div className="text-sm font-mono text-[#1E3A5F] mb-1">Email: {demoPassword.email}</div>
                  <div className="text-sm font-mono text-[#1E3A5F]">Password: {demoPassword.password}</div>
                  <p className="text-[10px] text-[#1E3A5F]/40 mt-2">Give these to your tester — they log in at the normal /login page. Setting a new password here invalidates the previous one.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
        <h2 className="font-display text-base text-[#1E3A5F] mb-3">2. Demo data</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-cream rounded-lg p-3">
            <div className="text-xl font-display text-[#1E3A5F]">{demoOrdersCount}</div>
            <div className="text-[10px] text-[#1E3A5F]/50 uppercase">Demo Orders</div>
          </div>
          <div className="text-center bg-cream rounded-lg p-3">
            <div className="text-xl font-display text-[#1E3A5F]">{demoCustomersCount}</div>
            <div className="text-[10px] text-[#1E3A5F]/50 uppercase">Demo Customers</div>
          </div>
          <div className="text-center bg-cream rounded-lg p-3">
            <div className="text-xl font-display text-[#1E3A5F]">{demoQuotesCount}</div>
            <div className="text-[10px] text-[#1E3A5F]/50 uppercase">Demo Quotes</div>
          </div>
        </div>
        <button onClick={handleResetData} disabled={busy} className="border border-ember/40 text-ember rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
          Reset all demo data
        </button>
        {resetMessage && <p className="text-sm text-sage font-semibold mt-2">{resetMessage}</p>}
      </div>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
        <h2 className="font-display text-base text-[#1E3A5F] mb-3">3. Intercepted emails ({emailLog.length})</h2>
        <p className="text-xs text-[#1E3A5F]/50 mb-3">Every email a "Send" button would have sent while the demo account was active — none of these reached the real recipient. Click "View" to see exactly what it looked like.</p>
        {emailLog.length === 0 ? (
          <p className="text-sm text-[#1E3A5F]/50">No demo emails attempted yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {emailLog.map(e => (
              <div key={e.id} className="border border-[#1E3A5F]/10 rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-semibold text-[#1E3A5F]">{e.email_type}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-bold px-2 py-0.5 rounded-full ${e.success ? "bg-sage/15 text-sage" : "bg-ember/15 text-ember"}`}>
                      {e.success ? "Intercepted OK" : "Failed"}
                    </span>
                    {e.html_body && (
                      <button onClick={() => setViewingEmail(e)} className="bg-[#1E3A5F] text-white rounded-full px-2.5 py-0.5 font-semibold">
                        View
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[#1E3A5F]/60">Would have gone to: <span className="font-mono">{e.intended_recipient}</span></div>
                <div className="text-[#1E3A5F]/60">Redirected to: <span className="font-mono">{e.redirected_to}</span></div>
                {e.subject && <div className="text-[#1E3A5F]/60">Subject: {e.subject}</div>}
                {e.error_message && <div className="text-ember mt-1">{e.error_message}</div>}
                <div className="text-[#1E3A5F]/40 mt-1">{new Date(e.attempted_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 bg-cream border border-[#1E3A5F]/10 rounded-xl p-4">
        <h2 className="font-display text-sm text-[#1E3A5F] mb-2">To disable Demo Mode entirely</h2>
        <p className="text-xs text-[#1E3A5F]/60">
          In your Supabase dashboard, go to Authentication → Users, find the demo account, and either delete it or disable it.
          This instantly invalidates any password AND any login link that's ever been generated — no app deploy or code change needed.
        </p>
      </div>

      {viewingEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setViewingEmail(null)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1E3A5F]/10">
              <div>
                <div className="font-semibold text-[#1E3A5F]">{viewingEmail.subject}</div>
                <div className="text-xs text-[#1E3A5F]/50">To: {viewingEmail.intended_recipient} (intended) — redirected to {viewingEmail.redirected_to}</div>
              </div>
              <button onClick={() => setViewingEmail(null)} className="text-[#1E3A5F]/50 hover:text-[#1E3A5F] text-xl leading-none px-2">✕</button>
            </div>
            <iframe
              srcDoc={viewingEmail.html_body || ""}
              sandbox=""
              className="flex-1 w-full border-0"
              title="Email preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
