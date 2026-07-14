"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const PRODUCT_TYPES = [
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

type Customer = { id: string; full_name: string; email: string };
type SavedProduct = { id: string; product_type: string; name: string; size_details: string | null; price_cents: number };

type LineItem = {
  productType: string;
  title: string;
  sizeDetails: string;
  price: string; // total for this line (unit price x quantity), editable
  quantity: string;
  selectedProductId: string | null;
  unitPriceCents: number | null;
};

function blankLineItem(): LineItem {
  return {
    productType: "cornhole",
    title: "",
    sizeDetails: "",
    price: "",
    quantity: "1",
    selectedProductId: null,
    unitPriceCents: null
  };
}

export default function AddOrderWithCustomerPicker({ customers, products }: { customers: Customer[]; products: SavedProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Customer search/select state
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // "Create new customer" popup state
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerCreatedMsg, setCustomerCreatedMsg] = useState("");
  const [customerCreateError, setCustomerCreateError] = useState("");

  // Line items — one order can now hold several different items.
  const [items, setItems] = useState<LineItem[]>([blankLineItem()]);
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = search.trim()
    ? customers.filter(c =>
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      )
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

    if (newEmail.trim()) {
      setCustomerCreatedMsg(
        `Invite sent to ${newName}. They'll appear in this list once they set up their account — you can add this order once they have.`
      );
    } else {
      setCustomerCreatedMsg(
        `${newName} was added with no account. Close this, search their name, and you can add this order right now.`
      );
    }
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
    setItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  }

  function applySavedProduct(index: number, productId: string) {
    if (!productId) {
      updateItem(index, { selectedProductId: null, unitPriceCents: null });
      return;
    }
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    const qty = Number(items[index].quantity) || 1;
    updateItem(index, {
      title: p.name,
      sizeDetails: p.size_details || "",
      selectedProductId: p.id,
      unitPriceCents: p.price_cents,
      price: ((p.price_cents * qty) / 100).toString()
    });
  }

  function changeItemQuantity(index: number, newQty: string) {
    const item = items[index];
    const patch: Partial<LineItem> = { quantity: newQty };
    if (item.unitPriceCents != null) {
      const qtyNum = Number(newQty) || 0;
      patch.price = ((item.unitPriceCents * qtyNum) / 100).toString();
    }
    updateItem(index, patch);
  }

  const grandTotal = items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) {
      setError("Pick a customer first.");
      return;
    }
    if (items.some(it => !it.title.trim())) {
      setError("Every item needs a title/description.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          dueDate,
          items: items.map(it => ({
            productType: it.productType,
            productId: it.selectedProductId,
            title: it.title,
            sizeDetails: it.sizeDetails,
            quantity: it.quantity,
            priceCents: Math.round((Number(it.price) || 0) * 100)
          }))
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Something went wrong (status ${res.status}).`);
        setLoading(false);
        return;
      }
      setLoading(false);
      setItems([blankLineItem()]);
      setDueDate("");
      clearSelection();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-[#1E3A5F] text-cream px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap"
      >
        + Add order
      </button>
    );
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6 space-y-4">
      {/* Customer picker */}
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Customer</label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm bg-cream/50">
            <span>{selectedCustomer.full_name} <span className="text-[#1E3A5F]/50">({selectedCustomer.email})</span></span>
            <button type="button" onClick={clearSelection} className="text-xs text-ember font-semibold ml-3">
              Change
            </button>
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
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-cream border-b border-[#1E3A5F]/5 last:border-0"
                    >
                      <div className="font-medium text-[#1E3A5F]">{c.full_name}</div>
                      <div className="text-xs text-[#1E3A5F]/50">{c.email}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-[#1E3A5F]/60">
                    No matching customers.
                    <button
                      type="button"
                      onClick={() => { setShowCreateCustomer(true); setDropdownOpen(false); }}
                      className="block mt-2 text-ember font-semibold text-sm"
                    >
                      + Create new customer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items — only shown once a customer is picked */}
      {selectedCustomer && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-2">Items on this order</label>
            <div className="space-y-3">
              {items.map((item, index) => {
                const matchingProducts = products.filter(p => p.product_type === item.productType);
                return (
                  <div key={index} className="border border-[#1E3A5F]/10 rounded-lg p-3 bg-cream/30">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Product type</label>
                        <select
                          value={item.productType}
                          onChange={e => updateItem(index, { productType: e.target.value, selectedProductId: null, unitPriceCents: null })}
                          className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
                        >
                          {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                      {item.productType !== "cornhole" && matchingProducts.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Fill in from saved product</label>
                          <select
                            onChange={e => applySavedProduct(index, e.target.value)}
                            value={item.selectedProductId || ""}
                            className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
                          >
                            <option value="">— Choose —</option>
                            {matchingProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name} — ${(p.price_cents / 100).toFixed(2)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Title / description</label>
                        <input
                          required
                          value={item.title}
                          onChange={e => updateItem(index, { title: e.target.value })}
                          placeholder={item.productType === "cornhole" ? "Design name (e.g. Michigan flag)" : "Title / description"}
                          className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Size / details</label>
                        <input
                          value={item.sizeDetails}
                          onChange={e => updateItem(index, { sizeDetails: e.target.value })}
                          className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => changeItemQuantity(index, e.target.value)}
                          className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 items-end">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Total price ($)</label>
                        <input
                          value={item.price}
                          onChange={e => updateItem(index, { price: e.target.value, unitPriceCents: null })}
                          placeholder="55"
                          className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="col-span-3 flex justify-end">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="text-xs text-ember/70 hover:text-ember underline"
                          >
                            Remove this item
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="mt-2 text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream"
            >
              + Add another item
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Needed by (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="text-sm font-semibold text-[#1E3A5F] text-right">
              Order total: ${grandTotal.toFixed(2)}
            </div>
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
              {loading ? "Creating..." : "Create order"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border border-[#1E3A5F] text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!selectedCustomer && (
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#1E3A5F]/50 underline">
          Cancel
        </button>
      )}

      {/* Create-new-customer popup */}
      {showCreateCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-display text-lg text-[#1E3A5F] mb-3">Create new customer</h3>
            {customerCreatedMsg ? (
              <div>
                <p className="text-sm text-sage font-semibold mb-4">{customerCreatedMsg}</p>
                <button
                  type="button"
                  onClick={() => { setShowCreateCustomer(false); setCustomerCreatedMsg(""); }}
                  className="bg-[#1E3A5F] text-cream px-4 py-2 rounded-md text-sm font-semibold"
                >
                  Done
                </button>
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
                  <button type="submit" disabled={creatingCustomer} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
                    {creatingCustomer ? "Sending..." : "Create & send invite"}
                  </button>
                  <button type="button" onClick={() => setShowCreateCustomer(false)} className="border border-[#1E3A5F] text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
