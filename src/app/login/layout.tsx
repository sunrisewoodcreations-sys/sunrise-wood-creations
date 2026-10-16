// login/page.tsx is a client component ("use client"), and Next.js only
// reads a page's `metadata` export from a server component — so this
// thin server-component layout is what actually carries it.
//
// This is also the fix for the specific Search Console warning
// ("Duplicate without user-selected canonical"): the middleware sends
// every signed-out visit to /account or /admin here as
// /login?redirectTo=<whatever path they tried>, so Google can discover
// many different /login?redirectTo=... URLs that all render the exact
// same login form. The `canonical` below tells Google all of those are
// really just one page — the plain /login — and `robots: noindex` says
// not to index any of them anyway, since there's nothing public here.
export const metadata = {
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
