// auth/confirm/page.tsx is a client component, so metadata has to come
// from this server-component layout instead — same reasoning as
// src/app/login/layout.tsx. This page is only ever reached from a real
// login-link email, carries no content of its own (just a brief
// "Signing you in..." message while it establishes the session), and
// is reached with a different token every time, so there's nothing
// here worth indexing.
export const metadata = {
  robots: { index: false, follow: false }
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
