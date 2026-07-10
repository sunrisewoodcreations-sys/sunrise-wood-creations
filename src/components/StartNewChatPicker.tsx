"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { productLabel, ProductType } from "@/lib/statusSteps";

type Customer = { id: string; full_name: string; email: string };
type Order = { id: string; title: string; product_type: string; created_at: string };

export default function StartNewChatPicker({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderDropdownOpen, setOrderDropdownOpen] = useState(false);
  const orderBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
      if (orderBoxRef.current && !orderBoxRef.current.contains(e.target as Node)) {
        setOrderDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c =>
        c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  const filteredOrders = orderSearch.trim()
    ? orders.filter(o => o.title.toLowerCase().includes(orderSearch.toLowerCase()))
    : orders;

  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerSearch(c.full_name);
    setCustomerDropdownOpen(false);
    setOrders([]);
    setOrderSearch("");
    setLoadingOrders(true);
    const res = await fetch(`/api/customers/${c.id}/orders`);
    setLoadingOrders(false);
    if (res.ok) {
      const body = await res.json();
      setOrders(body.orders || []);
    }
  }

  function reset() {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setOrders([]);
    setOrderSearch("");
  }

  function goToOrder(orderId: string) {
    setOpen(false);
    reset();
    router.push(`/admin/orders/${orderId}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-sm font-semibold mb-5"
      >
        + Start new chat
      </button>
    );
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Which customer?</label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm bg-cream/50">
            <span>{selectedCustomer.full_name} <span className="text-[#1E3A5F]/50">({selectedCustomer.email})</span></span>
            <button type="button" onClick={reset} className="text-xs text-ember font-semibold ml-3">Change</button>
          </div>
        ) : (
          <div className="relative" ref={customerBoxRef}>
            <input
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
              onFocus={() => setCustomerDropdownOpen(true)}
              placeholder="Search customers by name or email..."
              className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
            />
            {customerDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-[#1E3A5F]/10 rounded-md shadow-lg max-h-56 overflow-y-auto">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(c => (
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
                  <div className="px-3 py-3 text-sm text-[#1E3A5F]/60">No matching customers.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Which order?</label>
          {loadingOrders ? (
            <p className="text-sm text-[#1E3A5F]/50">Loading their orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-[#1E3A5F]/50">This customer has no orders yet.</p>
          ) : (
            <div className="relative" ref={orderBoxRef}>
              <input
                value={orderSearch}
                onChange={e => { setOrderSearch(e.target.value); setOrderDropdownOpen(true); }}
                onFocus={() => setOrderDropdownOpen(true)}
                placeholder="Search their orders..."
                className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
              />
              {orderDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-[#1E3A5F]/10 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {filteredOrders.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => goToOrder(o.id)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-cream border-b border-[#1E3A5F]/5 last:border-0"
                    >
                      <div className="font-medium text-[#1E3A5F]">
                        {productLabel(o.product_type as ProductType)} — {o.title}
                      </div>
                      <div className="text-xs text-[#1E3A5F]/50">
                        Placed {new Date(o.created_at).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-xs text-[#1E3A5F]/50 underline">
        Cancel
      </button>
    </div>
  );
}
