"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";
import { calculateQuoteTotals } from "@/lib/tax";
import { formatQuoteNumberWithRevision } from "@/lib/quoteNumber";

type Customer = { id: string; full_name: string; email: string };
type SavedProduct = { id: string; product_type: string; name: string; size_details: string | null; price_cents: number };

type LineItem = {
  title: string;
  description: string;
  quantity: string;
  unitPrice: string; // dollars, editable
  selectedProductId: string | null;
};

function blankLineItem(): LineItem {
  return { title: "", description: "", quantity: "1", unitPrice: "", selectedProductId: null };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysToDateStr(ds: string, days: number): string {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const STATUS_OPTIONS = ["draft", "sent", "viewed", "accepted", "declined"] as const;

export default function QuoteEditor({
  customers,
  products,
  existingQuote
}: {
  customers: Customer[];
  products: SavedProduct[];
  existingQuote?: {
    id: string;
    quote_number: number;
    quote_year: number;
    revision_number: number;
    status: string;
    expiration_date: string;
    discount_cents: number;
    delivery_cents: number;
    notes: string | null;
    terms: string | null;
    share_token: string;
    converted_order_id: string | null;
    customer_id: string;
    profiles: { full_name: string; email: string };
    items: { title: string; description: string | null; quantity: number; unit_price_cents: number; product_id: string | null }[];
    revisions: { id: string; revision_number: number; status: string; viewed_at: string | null; sent_at: string | null; created_at: string }[];
  };
}) {
  const router = useRouter();
  const isEditMode = !!existingQuote;

  const [search, setSearch] = useState(existingQuote?.profiles?.full_name || "");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    existingQuote ? { id: existingQuote.customer_id, full_name: existingQuote.profiles.full_name, email: existingQuote.profiles.email } : null
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerCreatedMsg, setCustomerCreatedMsg] = useState("");
  const [customerCreateError, setCustomerCreateError] = useState("");

  const [items, setItems] = useState<LineItem[]>(
    existingQuote && existingQuote.items.length > 0
      ? existingQuote.items.map(it => ({
          title: it.title,
          description: it.description || "",
          quantity: String(it.quantity),
          unitPrice: (it.unit_price_cents / 100).toString(),
          selectedProductId: it.product_id
        }))
      : [blankLineItem()]
  );

  const [discount, setDiscount] = useState(existingQuote ? (existingQuote.discount_cents / 100).toString() : "0");
  const [delivery, setDelivery] = useState(existingQuote ? (existingQuote.delivery_cents / 100).toString() : "0");
  const [expirationDate, setExpirationDate] = useState(existingQuote?.expiration_date || addDaysToDateStr(todayStr(), 30));
  const [status, setStatus] = useState(existingQuote?.status || "draft");
  const [notes, setNotes] = useState(existingQuote?.notes || "");
  const [terms, setTerms] = useState(existingQuote?.terms || "");

  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = search.trim()
    ? customers.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    : customers;

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setSearch(c.full_name);
    setDropdownOpen(false);
  }
  function clearSelection() {
    setSelectedCustomer(null);
    setSearch("");
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCustomer(true);
    setCustomerCreateError("");
    setCustomerCreatedMsg("");

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: newName, email: newEmail })
    });
    const body = await res.json().catch(() => ({}));
    setCreatingCustomer(false);

    if (!res.ok) {
      setCustomerCreateError(body.error || "Something went wrong.");
      return;
    }
    setCustomerCreatedMsg(
      newEmail.trim()
        ? `Invite sent to ${newName}. They'll appear in this list once they set up their account.`
        : `${newName} was added. Close this, search their name, and select them.`
    );
    setNewName("");
    setNewEmail("");
    router.refresh();
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItemRow() {
    setItems(prev => [...prev, blankLineItem()]);
  }
  function removeItemRow(index: number) {
    setItems(prev => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }
  function applySavedProduct(index: number, productId: string) {
    if (!productId) {
      updateItem(index, { selectedProductId: null });
      return;
    }
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    updateItem(index, {
      title: p.name,
      description: p.size_details || "",
      selectedProductId: p.id,
      unitPrice: (p.price_cents / 100).toString()
    });
  }

  const totalsInput = items.map(it => ({
    quantity: Math.max(1, Math.round(Number(it.quantity)) || 1),
    unitPriceCents: Math.round((Number(it.unitPrice) || 0) * 100)
  }));
  const discountCents = Math.max(0, Math.round((Number(discount) || 0) * 100));
  const deliveryCents = Math.max(0, Math.round((Number(delivery) || 0) * 100));
  const totals = calculateQuoteTotals(totalsInput, discountCents, deliveryCents);

  const isExpired = new Date(expirationDate + "T23:59:59Z") < new Date() && !["accepted", "declined"].includes(status);
  const displayNumber = existingQuote ? formatQuoteNumberWithRevision(existingQuote.quote_year, existingQuote.quote_number, existingQuote.revision_number) : null;
  const shareUrl = existingQuote && typeof window !== "undefined" ? `${window.location.origin}/quote/${existingQuote.share_token}` : "";

  function buildPayload() {
    return {
      customerId: selectedCustomer?.id,
      items: items.map(it => ({
        productId: it.selectedProductId,
        title: it.title,
        description: it.description,
        quantity: it.quantity,
        unitPriceCents: Math.round((Number(it.unitPrice) || 0) * 100)
      })),
      discountCents,
      deliveryCents,
      expirationDate,
      notes,
      terms,
      status
    };
  }

  async function handleSave() {
    if (!selectedCustomer) { setError("Select a customer first."); return; }
    if (items.some(it => !it.title.trim())) { setError("Every line item needs a title."); return; }

    setLoading(true);
    setError("");
    setSaveMessage("");

    const payload = buildPayload();
    const res = isEditMode
      ? await fetch(`/api/quotes/${existingQuote!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error || "Couldn't save this quote.");
      return;
    }

    if (isEditMode) {
      if (body.newRevisionId) {
        router.push(`/admin/quotes/${body.newRevisionId}`);
      } else {
        setSaveMessage("Saved.");
        router.refresh();
      }
    } else {
      router.push(`/admin/quotes/${body.quote.id}`);
    }
  }

  async function handleSend() {
    if (!existingQuote) return;
    setActionBusy("send");
    setError("");
    const res = await fetch(`/api/quotes/${existingQuote.id}/send`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setActionBusy(null);
    if (res.ok) { setSaveMessage("Emailed to customer."); router.refresh(); }
    else setError(body.error || "Couldn't send this quote.");
  }

  async function handleDuplicate() {
    if (!existingQuote) return;
    setActionBusy("duplicate");
    const res = await fetch(`/api/quotes/${existingQuote.id}/duplicate`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setActionBusy(null);
    if (res.ok) router.push(`/admin/quotes/${body.quote.id}`);
    else setError(body.error || "Couldn't duplicate this quote.");
  }

  async function handleConvert() {
    if (!existingQuote) return;
    setActionBusy("convert");
    setError("");
    const res = await fetch(`/api/quotes/${existingQuote.id}/convert-to-order`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setActionBusy(null);
    if (res.ok) router.push(`/admin/orders/${body.order.id}`);
    else setError(body.error || "Couldn't convert this quote to an order.");
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl);
    setActionBusy("copied");
    setTimeout(() => setActionBusy(null), 1500);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">{isEditMode ? `Quote ${displayNumber}` : "New Quote"}</h1>
        {isEditMode && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize bg-[#1E3A5F]/10 text-[#1E3A5F]/60">
            {isExpired ? "Expired" : status}
          </span>
        )}
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        {isEditMode
          ? existingQuote!.status === "draft"
            ? "Edit pricing, items, and terms — save when you're ready."
            : "This quote has already been sent. Changing items or pricing and saving will create a new revision, keeping this version exactly as the customer saw it."
          : "Pick a customer, add items, and save to generate a quote number."}
      </p>

      {isEditMode && (
        <div className="flex flex-wrap gap-2 mb-6">
          <AdminButton variant="secondary" onClick={() => setShowPreview(s => !s)}>{showPreview ? "Hide preview" : "Preview"}</AdminButton>
          <a href={`/api/quotes/${existingQuote!.id}/pdf`} target="_blank"><AdminButton variant="secondary">Download PDF</AdminButton></a>
          <a href={`/api/quotes/${existingQuote!.id}/pdf`} target="_blank"><AdminButton variant="secondary">Print</AdminButton></a>
          <AdminButton variant="secondary" onClick={handleSend} disabled={actionBusy === "send"}>{actionBusy === "send" ? "Sending..." : "Email to customer"}</AdminButton>
          <AdminButton variant="secondary" onClick={handleCopyLink}>{actionBusy === "copied" ? "Copied!" : "Copy shareable link"}</AdminButton>
          <AdminButton variant="secondary" onClick={handleDuplicate} disabled={actionBusy === "duplicate"}>{actionBusy === "duplicate" ? "Duplicating..." : "Duplicate"}</AdminButton>
          {existingQuote!.converted_order_id ? (
            <a href={`/admin/orders/${existingQuote!.converted_order_id}`}><AdminButton variant="secondary">View converted order →</AdminButton></a>
          ) : (
            <AdminButton onClick={handleConvert} disabled={actionBusy === "convert"}>{actionBusy === "convert" ? "Converting..." : "Convert to Order"}</AdminButton>
          )}
        </div>
      )}

      {isEditMode && existingQuote!.revisions.length > 1 && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4 mb-6">
          <h2 className="font-display text-base text-[#1E3A5F] mb-3">Revision History</h2>
          <div className="space-y-2">
            {[...existingQuote!.revisions].sort((a, b) => b.revision_number - a.revision_number).map(rev => (
              <div key={rev.id} className={`flex items-center justify-between text-sm rounded-md px-3 py-2 ${rev.id === existingQuote!.id ? "bg-[#1E3A5F]/5 border border-[#1E3A5F]/20" : "bg-cream/40"}`}>
                <div>
                  <span className="font-semibold text-[#1E3A5F]">Revision {rev.revision_number}</span>
                  {rev.id === existingQuote!.id && <span className="text-xs text-[#1E3A5F]/50 ml-2">(currently editing)</span>}
                  <span className="text-xs text-[#1E3A5F]/50 ml-2 capitalize">— {rev.status}</span>
                  {rev.viewed_at && <span className="text-xs text-sage ml-2">Viewed {new Date(rev.viewed_at).toLocaleDateString()}</span>}
                </div>
                <div className="flex gap-3">
                  {rev.id !== existingQuote!.id && (
                    <a href={`/admin/quotes/${rev.id}`} className="text-xs font-semibold text-[#1E3A5F] hover:underline">View</a>
                  )}
                  <a href={`/api/quotes/${rev.id}/pdf`} target="_blank" className="text-xs font-semibold text-[#1E3A5F] hover:underline">Download PDF</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPreview && isEditMode && (
        <div className="bg-white border-2 border-[#1E3A5F]/20 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-[#1E3A5F]">Quote {displayNumber}</h2>
            <span className="text-sm text-[#1E3A5F]/50">Expires {new Date(expirationDate + "T12:00:00Z").toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-[#1E3A5F]/60 mb-4">Prepared for {selectedCustomer?.full_name}</p>
          <div className="space-y-2 mb-4">
            {items.map((it, i) => (
              <div key={i} className="flex justify-between border-b border-[#1E3A5F]/5 pb-2 text-sm">
                <div>
                  <div className="font-semibold text-[#1E3A5F]">{it.title || "(untitled item)"}</div>
                  {it.description && <div className="text-xs text-[#1E3A5F]/50">{it.description}</div>}
                </div>
                <div className="text-[#1E3A5F]">${(((Number(it.unitPrice) || 0) * (Number(it.quantity) || 1))).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-[#1E3A5F]/70"><span>Subtotal</span><span>${(totals.subtotalCents / 100).toFixed(2)}</span></div>
            {discountCents > 0 && <div className="flex justify-between text-ember"><span>Discount</span><span>-${(discountCents / 100).toFixed(2)}</span></div>}
            <div className="flex justify-between text-[#1E3A5F]/70"><span>Tax</span><span>${(totals.taxCents / 100).toFixed(2)}</span></div>
            {deliveryCents > 0 && <div className="flex justify-between text-[#1E3A5F]/70"><span>Delivery</span><span>${(deliveryCents / 100).toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-[#1E3A5F] pt-2 border-t border-[#1E3A5F]/10"><span>Total</span><span>${(totals.totalCents / 100).toFixed(2)}</span></div>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 space-y-4">
        {/* Customer picker */}
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Customer</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm bg-cream/50">
              <span>{selectedCustomer.full_name} <span className="text-[#1E3A5F]/50">({selectedCustomer.email})</span></span>
              {!isEditMode && (
                <button type="button" onClick={clearSelection} className="text-xs text-ember font-semibold ml-3">Change</button>
              )}
            </div>
          ) : (
            <div className="relative" ref={searchBoxRef}>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Search customers by name or email..."
                className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
              />
              {dropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-[#1E3A5F]/10 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {filtered.length > 0 ? (
                    filtered.map(c => (
                      <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="block w-full text-left px-3 py-2 text-sm hover:bg-cream border-b border-[#1E3A5F]/5 last:border-0">
                        <div className="font-medium text-[#1E3A5F]">{c.full_name}</div>
                        <div className="text-xs text-[#1E3A5F]/50">{c.email}</div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-[#1E3A5F]/60">
                      No matching customers.
                      <button type="button" onClick={() => { setShowCreateCustomer(true); setDropdownOpen(false); }} className="block mt-2 text-ember font-semibold text-sm">
                        + Create new customer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line items */}
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-2">Items on this quote</label>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-[#1E3A5F]/10 rounded-lg p-3 bg-cream/30">
                <div className="mb-2">
                  <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Fill in from an existing product (optional)</label>
                  <select
                    value={item.selectedProductId || ""}
                    onChange={e => applySavedProduct(index, e.target.value)}
                    className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="">— Custom line item —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — ${(p.price_cents / 100).toFixed(2)}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Title</label>
                    <input required value={item.title} onChange={e => updateItem(index, { title: e.target.value })} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Qty</label>
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, { quantity: e.target.value })} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Unit price ($)</label>
                    <input value={item.unitPrice} onChange={e => updateItem(index, { unitPrice: e.target.value })} placeholder="55" className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm" />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Description (optional)</label>
                  <input value={item.description} onChange={e => updateItem(index, { description: e.target.value })} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm" />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-[#1E3A5F]/60">Line total: ${(((Number(item.unitPrice) || 0) * (Number(item.quantity) || 1))).toFixed(2)}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(index)} className="text-xs text-ember/70 hover:text-ember underline">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItemRow} className="mt-2 text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream">
            + Add another item
          </button>
        </div>

        {/* Pricing adjustments */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Discount ($)</label>
            <input value={discount} onChange={e => setDiscount(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Delivery fee ($)</label>
            <input value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Expiration date</label>
            <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          {isEditMode && (
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm capitalize">
                {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Live totals */}
        <div className="bg-cream/40 border border-[#1E3A5F]/10 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div><span className="text-[#1E3A5F]/50">Subtotal:</span> <span className="font-semibold text-[#1E3A5F]">${(totals.subtotalCents / 100).toFixed(2)}</span></div>
          <div><span className="text-[#1E3A5F]/50">Tax (6%):</span> <span className="font-semibold text-[#1E3A5F]">${(totals.taxCents / 100).toFixed(2)}</span></div>
          <div><span className="text-[#1E3A5F]/50">Delivery:</span> <span className="font-semibold text-[#1E3A5F]">${(deliveryCents / 100).toFixed(2)}</span></div>
          <div><span className="text-[#1E3A5F]/50">Total:</span> <span className="font-bold text-sage">${(totals.totalCents / 100).toFixed(2)}</span></div>
        </div>

        {/* Notes and terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Notes (internal + shown on quote)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Terms &amp; conditions</label>
            <textarea
              value={terms}
              onChange={e => setTerms(e.target.value)}
              rows={3}
              placeholder="This quote is valid until the expiration date shown above. Prices are subject to change after expiration. A deposit may be required to begin production."
              className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        <div className="flex items-center gap-3">
          <AdminButton onClick={handleSave} disabled={loading || !selectedCustomer}>
            {loading ? "Saving..." : isEditMode ? "Save changes" : "Create quote"}
          </AdminButton>
          {saveMessage && <span className="text-sm font-semibold text-sage">{saveMessage}</span>}
        </div>
      </div>

      {showCreateCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-display text-lg text-[#1E3A5F] mb-3">Create new customer</h3>
            {customerCreatedMsg ? (
              <div>
                <p className="text-sm text-sage font-semibold mb-4">{customerCreatedMsg}</p>
                <AdminButton onClick={() => { setShowCreateCustomer(false); setCustomerCreatedMsg(""); }}>Done</AdminButton>
              </div>
            ) : (
              <form onSubmit={handleCreateCustomer} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Full name</label>
                  <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jane Doe" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Email (optional)</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jane@example.com" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
                </div>
                {customerCreateError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{customerCreateError}</p>}
                <div className="flex gap-2">
                  <AdminButton type="submit" disabled={creatingCustomer}>{creatingCustomer ? "Sending..." : "Create & send invite"}</AdminButton>
                  <AdminButton type="button" variant="secondary" onClick={() => setShowCreateCustomer(false)}>Cancel</AdminButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
