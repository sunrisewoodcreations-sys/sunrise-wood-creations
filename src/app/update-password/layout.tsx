// update-password/page.tsx is a client component, so metadata has to
// come from this server-component layout instead — same reasoning as
// src/app/login/layout.tsx. Only ever reached from a real password-
// reset email link, so there's nothing here worth indexing.
export const metadata = {
  robots: { index: false, follow: false }
};

export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
