// Keeps every /account/* page out of Google's index, same reasoning
// and same pattern as src/app/admin/layout.tsx — one place instead of
// repeating this on each individual account page. Purely a metadata
// wrapper: it renders nothing of its own, each account page still
// builds its own full page (SiteHeader/SiteFooter and all), so this
// adds no visual markup and changes no existing behavior.
export const metadata = {
  robots: { index: false, follow: false }
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
