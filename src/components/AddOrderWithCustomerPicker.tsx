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

  // Order fields
  const [productType, setProductType] = useState("cornhole");
  const [title, setTitle] = useState("");
  const [sizeDetails, setSizeDetails] = useState("");
  const [price, setPrice] = useState("");
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

    setCustomerCreatedMsg(
      `Invite sent to ${newName}. They'll appear in this list once they set up their account — you can add this order once they have.`
    );
    setNewName("");
    setNewEmail("");
    router.refresh();
  }

  function applyProduct(productId: string) {
    if (!productId) return;
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setProductType(p.product_type);
    setTitle(p.name);
    setSizeDetails(p.size_details || "");
    setPrice((p.price_cents / 100).toString());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) {
      setError("Pick a customer first.");
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
          productType,
          title,
          sizeDetails,
          priceCents: price
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Something went wrong (status ${res.status}).`);
        setLoading(false);
        return;
      }
      setLoading(false);
      setTitle(""); setSizeDetails(""); setPrice("");
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
        className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap"
      >
        + Add order
      </button>
    );
  }

  return (
    <div className="bg-white border border-walnut/10 rounded-xl p-5 mb-6 space-y-4">
      {/* Customer picker */}
      <div>
        <label className="block text-xs font-semibold text-walnut mb-1">Customer</label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between border border-walnut/15 rounded-md px-3 py-2 text-sm bg-cream/50">
            <span>{selectedCustomer.full_name} <span className="text-walnut/50">({selectedCustomer.email})</span></span>
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
              className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm"
            />
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-walnut/10 rounded-md shadow-lg max-h-56 overflow-y-auto">
                {filtered.length > 0 ? (
                  filtered.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-cream border-b border-walnut/5 last:border-0"
                    >
                      <div className="font-medium text-walnut">{c.full_name}</div>
                      <div className="text-xs text-walnut/50">{c.email}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-walnut/60">
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

      {/* Order fields — only shown once a customer is picked */}
      {selectedCustomer && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {products.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1">Fill in from a saved product (optional)</label>
              <select
                onChange={e => applyProduct(e.target.value)}
                defaultValue=""
                className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm"
              >
                <option value="">— Choose a saved product —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${(p.price_cents / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1">Product type</label>
              <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm">
                {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1">Order title / description</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Michigan flag design" className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1">Size / details</label>
              <input value={sizeDetails} onChange={e => setSizeDetails(e.target.value)} placeholder="24in x 48in, 2 boards" className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1">Price ($)</label>
              <input value={price} onChange={e => setPrice(e.target.value)} placeholder="225" className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
              {loading ? "Creating..." : "Create order"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border border-walnut text-walnut px-4 py-2 rounded-md text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!selectedCustomer && (
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-walnut/50 underline">
          Cancel
        </button>
      )}

      {/* Create-new-customer popup */}
      {showCreateCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-display text-lg text-walnut mb-3">Create new customer</h3>
            {customerCreatedMsg ? (
              <div>
                <p className="text-sm text-sage font-semibold mb-4">{customerCreatedMsg}</p>
                <button
                  type="button"
                  onClick={() => { setShowCreateCustomer(false); setCustomerCreatedMsg(""); }}
                  className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateCustomer} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-walnut mb-1">Full name</label>
                  <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jane Doe" className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-walnut mb-1">Email</label>
                  <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jane@example.com" className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
                </div>
                {customerCreateError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{customerCreateError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={creatingCustomer} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
                    {creatingCustomer ? "Sending..." : "Create & send invite"}
                  </button>
                  <button type="button" onClick={() => setShowCreateCustomer(false)} className="border border-walnut text-walnut px-4 py-2 rounded-md text-sm font-semibold">
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
