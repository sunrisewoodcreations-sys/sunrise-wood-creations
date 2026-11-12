import type { SupabaseClient } from "@supabase/supabase-js";

// Finds the customer for a website quote request (matched by email, the same
// "match by email" rule used elsewhere in the app) or creates one from what
// the person typed on the form. No email is sent to them from here.
export async function findOrCreateCustomerForRequest(
  admin: SupabaseClient,
  request: { name: string; email: string; phone?: string | null }
): Promise<{ id: string; created: boolean; error?: string }> {
  const email = request.email.trim();
  const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) return { id: existing.id, created: false };

  const { data: newCustomer, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: request.name }
  });
  if (error || !newCustomer?.user) {
    return { id: "", created: false, error: error?.message || "Couldn't create a customer record for this request" };
  }
  await admin.from("profiles").update({ full_name: request.name, phone: request.phone || null }).eq("id", newCustomer.user.id);
  return { id: newCustomer.user.id, created: true };
}
