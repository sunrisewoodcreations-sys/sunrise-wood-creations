// Pure helpers for the admin "Leads" list (people who messaged you).
// No database access in this file, so everything here is easy to test.

export const LEAD_STATUSES = ["in_talks", "not_responding", "ordered", "not_interested"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  in_talks: "In talks",
  not_responding: "Not responding",
  ordered: "Ordered",
  not_interested: "Not interested"
};

export const LEAD_SOURCES = ["facebook", "instagram", "text", "phone", "in_person", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  text: "Text message",
  phone: "Phone call",
  in_person: "In person",
  other: "Other"
};

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}
export function isLeadSource(v: unknown): v is LeadSource {
  return typeof v === "string" && (LEAD_SOURCES as readonly string[]).includes(v);
}

const MAX_NAME = 120;
const MAX_PHONE = 40;
const MAX_NOTES = 2000;

// Validates and cleans what the browser sent. For a new lead the name is
// required and missing fields get defaults in the database; for an edit
// only the fields that were actually sent are returned, so an edit can
// never blank out something it didn't mention.
export function cleanLeadFields(
  input: Record<string, unknown>,
  opts: { requireName: boolean }
): { ok: true; fields: Record<string, string | null> } | { ok: false; error: string } {
  const fields: Record<string, string | null> = {};

  if (input.fullName !== undefined || opts.requireName) {
    const name = typeof input.fullName === "string" ? input.fullName.trim() : "";
    if (!name) return { ok: false, error: "Name is required" };
    if (name.length > MAX_NAME) return { ok: false, error: "Name is too long" };
    fields.full_name = name;
  }
  if (input.phone !== undefined) {
    const phone = typeof input.phone === "string" ? input.phone.trim() : "";
    if (phone.length > MAX_PHONE) return { ok: false, error: "Phone is too long" };
    fields.phone = phone || null;
  }
  if (input.notes !== undefined) {
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (notes.length > MAX_NOTES) return { ok: false, error: "Notes are too long" };
    fields.notes = notes || null;
  }
  if (input.source !== undefined) {
    if (!isLeadSource(input.source)) return { ok: false, error: "Unknown source" };
    fields.source = input.source;
  }
  if (input.status !== undefined) {
    if (!isLeadStatus(input.status)) return { ok: false, error: "Unknown status" };
    fields.status = input.status;
  }
  return { ok: true, fields };
}

// Search box: matches a name, a phone number (ignoring dashes, spaces and
// brackets), or the notes. Case-insensitive; an empty search matches all.
export function leadMatchesQuery(
  lead: { full_name?: string | null; phone?: string | null; notes?: string | null },
  query: string
): boolean {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  if ((lead.full_name || "").toLowerCase().includes(q)) return true;
  if ((lead.notes || "").toLowerCase().includes(q)) return true;
  const phone = (lead.phone || "").toLowerCase();
  if (phone.includes(q)) return true;
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 3 && phone.replace(/\D/g, "").includes(qDigits)) return true;
  return false;
}

// "Ordered" is automatic: once the customer a lead was turned into has at
// least one order, the lead counts as Ordered, so you never have to
// remember to update it. Someone you marked Not interested stays that way.
export function effectiveLeadStatus(status: string, linkedOrderCount: number): LeadStatus {
  const s: LeadStatus = isLeadStatus(status) ? status : "in_talks";
  if (linkedOrderCount > 0 && (s === "in_talks" || s === "not_responding")) return "ordered";
  return s;
}

export function countByStatus(statuses: LeadStatus[]): Record<LeadStatus, number> {
  const counts: Record<LeadStatus, number> = { in_talks: 0, not_responding: 0, ordered: 0, not_interested: 0 };
  for (const s of statuses) counts[s] += 1;
  return counts;
}
