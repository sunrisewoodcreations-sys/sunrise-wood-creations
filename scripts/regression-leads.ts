// Regression tests for the admin Leads list helpers (src/lib/leads.ts).
// Run: npx tsx scripts/regression-leads.ts
// Pure logic only: no database, no network, no email.

import assert from "node:assert/strict";
import {
  cleanLeadFields,
  leadMatchesQuery,
  effectiveLeadStatus,
  countByStatus,
  isLeadStatus,
  isLeadSource,
  LEAD_STATUSES,
  LEAD_SOURCES
} from "../src/lib/leads";

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${label}`);
  } catch (err: any) {
    console.error(`FAIL  ${label}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

test("The four statuses and six sources are exactly the ones the database allows", () => {
  assert.deepEqual([...LEAD_STATUSES], ["in_talks", "not_responding", "ordered", "not_interested"]);
  assert.deepEqual([...LEAD_SOURCES], ["facebook", "instagram", "text", "phone", "in_person", "other"]);
  assert.equal(isLeadStatus("in_talks"), true);
  assert.equal(isLeadStatus("won"), false);
  assert.equal(isLeadSource("facebook"), true);
  assert.equal(isLeadSource("fax"), false);
});

test("New lead: name is required and is trimmed", () => {
  assert.deepEqual(cleanLeadFields({ fullName: "  Jane Doe  " }, { requireName: true }), { ok: true, fields: { full_name: "Jane Doe" } });
  assert.equal(cleanLeadFields({}, { requireName: true }).ok, false);
  assert.equal(cleanLeadFields({ fullName: "   " }, { requireName: true }).ok, false);
  assert.equal(cleanLeadFields({ fullName: 42 }, { requireName: true }).ok, false);
});

test("New lead: phone, notes, source and status are cleaned; blank phone/notes become empty", () => {
  const r = cleanLeadFields({ fullName: "A", phone: " 269-555-0123 ", notes: "  two planters ", source: "instagram", status: "in_talks" }, { requireName: true });
  assert.deepEqual(r, { ok: true, fields: { full_name: "A", phone: "269-555-0123", notes: "two planters", source: "instagram", status: "in_talks" } });
  const blank = cleanLeadFields({ fullName: "A", phone: "  ", notes: "" }, { requireName: true });
  assert.deepEqual(blank, { ok: true, fields: { full_name: "A", phone: null, notes: null } });
});

test("Unknown status or source is rejected (nothing invented reaches the database)", () => {
  assert.equal(cleanLeadFields({ fullName: "A", status: "won" }, { requireName: true }).ok, false);
  assert.equal(cleanLeadFields({ fullName: "A", source: "fax" }, { requireName: true }).ok, false);
  assert.equal(cleanLeadFields({ status: "'; drop table leads;--" }, { requireName: false }).ok, false);
});

test("Over-long values are rejected", () => {
  assert.equal(cleanLeadFields({ fullName: "x".repeat(121) }, { requireName: true }).ok, false);
  assert.equal(cleanLeadFields({ fullName: "A", phone: "1".repeat(41) }, { requireName: true }).ok, false);
  assert.equal(cleanLeadFields({ fullName: "A", notes: "n".repeat(2001) }, { requireName: true }).ok, false);
});

test("Editing: only the fields that were sent are returned (an edit can't blank anything else)", () => {
  assert.deepEqual(cleanLeadFields({ status: "not_responding" }, { requireName: false }), { ok: true, fields: { status: "not_responding" } });
  assert.deepEqual(cleanLeadFields({ notes: "called back" }, { requireName: false }), { ok: true, fields: { notes: "called back" } });
  assert.deepEqual(cleanLeadFields({}, { requireName: false }), { ok: true, fields: {} });
  assert.equal(cleanLeadFields({ fullName: "" }, { requireName: false }).ok, false, "can't rename someone to blank");
});

test("Search finds a name, case-insensitively and by part of the name", () => {
  const lead = { full_name: "Jennifer Smith", phone: "(269) 762-1460", notes: "wants cedar planters" };
  for (const q of ["jennifer", "SMITH", "nnif", "Jennifer Smith"]) assert.equal(leadMatchesQuery(lead, q), true, q);
  assert.equal(leadMatchesQuery(lead, "Robert"), false);
});

test("Search finds a phone number however it was typed, and the notes", () => {
  const lead = { full_name: "Jennifer Smith", phone: "(269) 762-1460", notes: "wants cedar planters" };
  for (const q of ["269", "762-1460", "2697621460", "(269) 762", "762 1460"]) assert.equal(leadMatchesQuery(lead, q), true, q);
  assert.equal(leadMatchesQuery(lead, "cedar"), true);
  assert.equal(leadMatchesQuery(lead, "999"), false);
});

test("Search: empty matches everyone; a lead with no phone/notes never crashes", () => {
  assert.equal(leadMatchesQuery({ full_name: "A" }, ""), true);
  assert.equal(leadMatchesQuery({ full_name: "A", phone: null, notes: null }, "zzz"), false);
  assert.equal(leadMatchesQuery({ full_name: null }, "a"), false);
});

test("Search: fewer than 3 digits typed with spaces/dashes is not matched loosely against phone digits", () => {
  // "9 5" is only 2 digits, so it must not be matched against the phone's digits-only form ("2695550123").
  assert.equal(leadMatchesQuery({ full_name: "A", phone: "269-555-0123" }, "9 5"), false);
  // A normal partial number still works.
  assert.equal(leadMatchesQuery({ full_name: "A", phone: "269-555-0123" }, "555-01"), true);
});

test("Ordered is automatic once the customer has an order; the others stay as set", () => {
  assert.equal(effectiveLeadStatus("in_talks", 1), "ordered");
  assert.equal(effectiveLeadStatus("not_responding", 3), "ordered");
  assert.equal(effectiveLeadStatus("in_talks", 0), "in_talks");
  assert.equal(effectiveLeadStatus("not_responding", 0), "not_responding");
  assert.equal(effectiveLeadStatus("not_interested", 2), "not_interested", "Not interested is never overridden");
  assert.equal(effectiveLeadStatus("ordered", 0), "ordered", "manually marked Ordered stays");
  assert.equal(effectiveLeadStatus("garbage", 0), "in_talks");
});

test("Tab counts add up", () => {
  const c = countByStatus(["in_talks", "in_talks", "not_responding", "ordered", "not_interested", "in_talks"]);
  assert.deepEqual(c, { in_talks: 3, not_responding: 1, ordered: 1, not_interested: 1 });
});

console.log(process.exitCode ? "\nSOME TESTS FAILED" : "\nAll leads regression tests passed.");
