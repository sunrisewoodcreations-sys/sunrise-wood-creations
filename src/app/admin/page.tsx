import { redirect } from "next/navigation";

// Home has been removed as a separate page — this is what a bare
// /admin now resolves to, which also means post-login (which sends
// people to /admin) lands on Dashboard automatically, with nothing
// else needing to change for that.
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
