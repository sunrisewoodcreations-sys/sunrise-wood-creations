"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  isLeadSource,
  LeadStatus
} from "@/lib/leads";

type Lead = {
  id: string;
  full_name: string;
  phone: string | null;
  source: string;
  notes: string | null;
  customer_id: string | null;
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  in_talks: "bg-amber/20 text-[#8a5a00] border-amber/40",
  not_responding: "bg-[#2E2420]/10 text-[#2E2420]/70 border-[#2E2420]/20",
  ordered: "bg-sage/20 text-[#3f6a45] border-sage/40",
  not_interested: "bg-ember/10 text-ember border-ember/30"
};

export default function LeadCard({
  lead,
  status,
  orderCount,
  firstContactedLabel
}: {
  lead: Lead;
  // Already adjusted on the server: "Ordered" if the customer this lead
  // became has an order.
  status: LeadStatus;
  orderCount: number;
  firstContactedLabel: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(lead.notes || "");
  const [savedNotes, setSavedNotes] = useState(lead.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  async function patch(fields: Record<string, string>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save that.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveNotes() {
    if (await patch({ notes })) setSavedNotes(notes);
  }

  async function convert(opts: { confirmDuplicate?: boolean; useExistingCustomerId?: string } = {}) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/leads/${lead.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts)
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Couldn't create the customer.");
      return;
    }
    if (body.possibleDuplicate) {
      setDuplicate({ id: body.existingCustomerId, name: body.existingCustomerName });
      return;
    }
    router.push(`/admin/customers/${body.customerId}`);
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't remove this lead.");
      setConfirmDelete(false);
      return;
    }
    router.refresh();
  }

  const sourceLabel = isLeadSource(lead.source) ? LEAD_SOURCE_LABELS[lead.source] : lead.source;

  return (
    <div className="bg-white border border-[#2E2420]/10 rounded-xl shadow-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold text-[#2E2420]">{lead.full_name}</div>
          <div className="text-xs text-[#2E2420]/60 mt-0.5">
            {lead.phone ? <span>{lead.phone} &middot; </span> : null}
            {sourceLabel} &middot; first messaged {firstContactedLabel}
          </div>
        </div>
        <select
          value={status}
          disabled={busy}
          onChange={e => patch({ status: e.target.value })}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${STATUS_STYLES[status]}`}
          aria-label="Lead status"
        >
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="mt-3">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes: what they want, what you quoted, when to follow up..."
          className="w-full px-3 py-2 border border-[#2E2420]/15 rounded-md text-sm"
        />
        {notes !== savedNotes && (
          <button
            onClick={saveNotes}
            disabled={busy}
            className="mt-1.5 border border-[#2E2420] text-[#2E2420] px-3 py-1 rounded-md text-xs font-semibold disabled:opacity-60"
          >
            Save notes
          </button>
        )}
      </div>

      {duplicate && (
        <div className="mt-3 border border-amber/40 bg-amber/10 rounded-md p-3 text-sm text-[#2E2420]">
          <p className="mb-2 font-semibold">
            A customer named {duplicate.name} with this phone number already exists. Is it the same person?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => convert({ useExistingCustomerId: duplicate.id })}
              disabled={busy}
              className="bg-ember text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
            >
              Yes, use that customer
            </button>
            <button
              onClick={() => { setDuplicate(null); convert({ confirmDuplicate: true }); }}
              disabled={busy}
              className="border border-[#2E2420]/30 text-[#2E2420] px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
            >
              No, create a new customer
            </button>
            <button
              onClick={() => setDuplicate(null)}
              disabled={busy}
              className="text-xs text-[#2E2420]/60 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-ember">{error}</p>}

      <div className="mt-3 pt-3 border-t border-[#2E2420]/10 flex flex-wrap items-center gap-2">
        {lead.customer_id ? (
          <>
            <Link
              href={`/admin/customers/${lead.customer_id}`}
              className="bg-ember text-white px-3 py-1.5 rounded-md text-xs font-semibold"
            >
              Open customer / add order
            </Link>
            <span className="text-xs text-[#2E2420]/60">
              {orderCount > 0 ? `${orderCount} order${orderCount === 1 ? "" : "s"}` : "Customer created, no order yet"}
            </span>
          </>
        ) : (
          <button
            onClick={() => convert()}
            disabled={busy}
            className="bg-ember text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
          >
            {busy ? "Working..." : "Create order"}
          </button>
        )}

        <div className="ml-auto">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-ember/70 hover:text-ember underline"
            >
              Remove from list
            </button>
          ) : (
            <span className="text-xs text-[#2E2420]">
              Remove {lead.full_name}?{" "}
              <button onClick={handleDelete} disabled={busy} className="text-ember font-semibold underline">Yes</button>
              {" / "}
              <button onClick={() => setConfirmDelete(false)} className="underline">No</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
