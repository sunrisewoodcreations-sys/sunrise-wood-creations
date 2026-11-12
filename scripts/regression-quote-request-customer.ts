import { findOrCreateCustomerForRequest } from "../src/lib/quoteRequestCustomer";
let bad = 0;
const t = (ok: boolean, m: string) => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + m); };

function fake(existing: { id: string } | null, createFails = false) {
  const calls: any = { created: [], updates: [], ilike: [] };
  const admin: any = {
    from: () => ({
      select: () => ({ ilike: (_c: string, v: string) => { calls.ilike.push(v); return { maybeSingle: async () => ({ data: existing }) }; } }),
      update: (p: any) => ({ eq: async (_c: string, id: string) => { calls.updates.push({ id, ...p }); return {}; } })
    }),
    auth: { admin: { createUser: async (a: any) => { calls.created.push(a); return createFails ? { data: {}, error: { message: "boom" } } : { data: { user: { id: "new-1" } }, error: null }; } } }
  };
  return { admin, calls };
}

(async () => {
  const req = { name: "Pat Smith", email: "Pat@Example.com ", phone: "555-1234" };

  let f = fake({ id: "c-9" });
  let r = await findOrCreateCustomerForRequest(f.admin, req);
  t(r.id === "c-9" && !r.created, "existing customer (any email capitalization) is reused, not duplicated");
  t(f.calls.created.length === 0, "no new login is made for an existing customer");
  t(f.calls.ilike[0] === "Pat@Example.com", "email is trimmed before matching");

  f = fake(null);
  r = await findOrCreateCustomerForRequest(f.admin, req);
  t(r.id === "new-1" && r.created, "new customer is created when none exists");
  t(f.calls.created[0].email === "Pat@Example.com" && f.calls.created[0].email_confirm === true, "created with their email, no password/invite email");
  t(f.calls.updates[0].full_name === "Pat Smith" && f.calls.updates[0].phone === "555-1234", "name and phone copied from the request");

  f = fake(null, true);
  r = await findOrCreateCustomerForRequest(f.admin, req);
  t(!!r.error && r.id === "", "a failure is reported, not hidden");
  process.exit(bad ? 1 : 0);
})();
