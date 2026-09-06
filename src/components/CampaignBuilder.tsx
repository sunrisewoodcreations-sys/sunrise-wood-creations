"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Product = { id: string; name: string; product_type: string };
type Customer = { id: string; full_name: string; email: string; phone: string | null };

const CATEGORIES = [
  { value: "cornhole", label: "Cornhole Boards" },
  { value: "sign", label: "Wooden Signs" },
  { value: "planter", label: "Planter Boxes" },
  { value: "cutting_board", label: "Cutting Boards" }
];

export default function CampaignBuilder({ products }: { products: Product[] }) {
  const router = useRouter();

  // Coupon fields
  const [name, setName] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("15");
  const [appliesToType, setAppliesToType] = useState<"all" | "product_type" | "product">("all");
  const [appliesToValue, setAppliesToValue] = useState("");

  // Rules
  const [minPurchase, setMinPurchase] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxTotalRedemptions, setMaxTotalRedemptions] = useState("");
  const [maxPerCustomer, setMaxPerCustomer] = useState("1");
  const [combinable, setCombinable] = useState(false);

  // Targeting
  const [targetingType, setTargetingType] = useState<"all" | "product_type" | "product" | "date_range" | "manual">("product_type");
  const [targetProductType, setTargetProductType] = useState("planter");
  const [targetProductId, setTargetProductId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [excludePreviouslySent, setExcludePreviouslySent] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);

  const [matchedCustomers, setMatchedCustomers] = useState<Customer[]>([]);
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [manualCustomers, setManualCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Email
  const [emailSubject, setEmailSubject] = useState("A Special Thank You From Sunrise Wood Creations");
  const [emailHeading, setEmailHeading] = useState("A Special Thank You For Supporting Our Small Business");
  const [emailBody, setEmailBody] = useState(
    "Thank you for supporting Sunrise Wood Creations!\n\nBecause you've purchased from us before, we'd like to offer you {{discount}} on your next order.\n\nThank you for supporting our small business!"
  );

  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendSchedule, setSendSchedule] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("14:00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [testEmailSentMsg, setTestEmailSentMsg] = useState("");

  useEffect(() => {
    fetch("/api/coupons/recipients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "category_counts" }) })
      .then(r => r.json()).then(d => setCategoryCounts(d.counts || {})).catch(() => setCategoryCounts({}));
  }, []);

  // Recomputes the matched-customer list any time targeting changes —
  // this is what keeps the recipient count live, per the requirement
  // that it update as targeting options change.
  const refreshRecipients = useCallback(async () => {
    if (targetingType === "manual") { setMatchedCustomers([]); return; }
    setLoadingRecipients(true);
    const spec: any = { type: targetingType };
    if (targetingType === "product_type") spec.productType = targetProductType;
    if (targetingType === "product") spec.productId = targetProductId;
    if (targetingType === "date_range") { spec.startDate = dateStart; spec.endDate = dateEnd; }
    try {
      const res = await fetch("/api/coupons/recipients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec })
      });
      const data = await res.json();
      setMatchedCustomers(data.customers || []);
      setDeselectedIds(new Set());
    } finally {
      setLoadingRecipients(false);
    }
  }, [targetingType, targetProductType, targetProductId, dateStart, dateEnd]);

  useEffect(() => { refreshRecipients(); }, [refreshRecipients]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch("/api/coupons/recipients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "search", query: searchQuery }) })
        .then(r => r.json()).then(d => setSearchResults(d.customers || [])).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const finalRecipients: Customer[] = targetingType === "manual"
    ? manualCustomers
    : matchedCustomers.filter(c => !deselectedIds.has(c.id));

  function toggleDeselect(id: string) {
    setDeselectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addManualCustomer(c: Customer) {
    if (!manualCustomers.some(m => m.id === c.id)) setManualCustomers(prev => [...prev, c]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeManualCustomer(id: string) {
    setManualCustomers(prev => prev.filter(c => c.id !== id));
  }

  function buildPayload() {
    return {
      name, couponCode, autoGenerateCode: autoGenerate,
      discountType, discountValue: discountType === "percentage" ? Number(discountValue) : Math.round(Number(discountValue) * 100),
      appliesToType, appliesToValue: appliesToType === "all" ? null : appliesToValue,
      minPurchaseCents: minPurchase ? Math.round(Number(minPurchase) * 100) : null,
      maxDiscountCents: maxDiscount ? Math.round(Number(maxDiscount) * 100) : null,
      startsAt: startsAt || null, expiresAt: expiresAt || null,
      maxTotalRedemptions: maxTotalRedemptions ? Number(maxTotalRedemptions) : null,
      maxRedemptionsPerCustomer: Number(maxPerCustomer) || 1,
      combinable,
      targetingType,
      targetingValue: targetingType === "manual"
        ? { customerIds: manualCustomers.map(c => c.id) }
        : {
            ...(targetingType === "product_type" ? { productType: targetProductType }
              : targetingType === "product" ? { productId: targetProductId }
              : targetingType === "date_range" ? { startDate: dateStart, endDate: dateEnd }
              : {}),
            excludedCustomerIds: Array.from(deselectedIds)
          },
      excludePreviouslySent,
      emailSubject, emailHeading, emailBody
    };
  }

  async function saveCampaign(): Promise<string | null> {
    setError("");
    if (!name.trim()) { setError("Campaign name is required."); return null; }
    if (!autoGenerate && !couponCode.trim()) { setError("Enter a coupon code or choose to auto-generate one."); return null; }
    if (appliesToType !== "all" && !appliesToValue) { setError("Choose what the coupon applies to."); return null; }
    if (finalRecipients.length === 0) { setError("No recipients selected — choose who should receive this campaign."); return null; }

    const res = await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Couldn't save the campaign."); return null; }
    return data.campaign.id as string;
  }

  async function handleSaveDraft() {
    setBusy("draft");
    const id = await saveCampaign();
    setBusy(null);
    if (id) router.push(`/admin/coupons/${id}`);
  }

  async function handleSendTest() {
    setBusy("test");
    setTestEmailSentMsg("");
    const id = await saveCampaign();
    if (!id) { setBusy(null); return; }
    const res = await fetch(`/api/coupons/${id}/test-send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setError(data.error || "Couldn't send the test email."); return; }
    setTestEmailSentMsg(`Test email sent to ${data.sentTo}. This campaign was saved as a draft — it has not been sent to any customers.`);
  }

  async function handleConfirmSend() {
    setBusy("send");
    const id = await saveCampaign();
    if (!id) { setBusy(null); setShowConfirm(false); return; }
    const scheduledAt = sendSchedule === "later" && scheduledDate ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : undefined;
    const res = await fetch(`/api/coupons/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledAt }) });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setError(data.error || "Couldn't send the campaign."); setShowConfirm(false); return; }
    router.push(`/admin/coupons/${id}`);
  }

  const discountDisplay = discountType === "percentage" ? `${discountValue || 0}% off` : `$${discountValue || 0} off`;
  const appliesToDisplay = appliesToType === "all" ? "Entire order" : appliesToType === "product_type"
    ? CATEGORIES.find(c => c.value === appliesToValue)?.label || appliesToValue
    : products.find(p => p.id === appliesToValue)?.name || "Specific product";

  return (
    <div className="bg-cream/40 -m-8 p-8 min-h-full pb-32">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/coupons" className="text-sm text-[#1E3A5F]/50 hover:underline">Coupons &amp; Campaigns</Link>
        <span className="text-[#1E3A5F]/30">/</span>
        <span className="text-sm text-[#1E3A5F]/50">New Campaign</span>
      </div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-6">Create Campaign</h1>

      {error && (
        <div className="bg-ember/10 border border-ember/30 text-ember text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
      )}
      {testEmailSentMsg && (
        <div className="bg-sage/10 border border-sage/30 text-sage text-sm rounded-lg px-4 py-3 mb-6">{testEmailSentMsg}</div>
      )}

      {/* ===== Campaign basics ===== */}
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 shadow-sm mb-5">
        <h2 className="font-display text-base text-[#1E3A5F] mb-4">Campaign</h2>
        <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Campaign Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Planter Box Customer Thank You"
          className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-4" />

        <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Coupon Code</label>
        <div className="flex items-center gap-3 mb-1">
          <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} disabled={autoGenerate}
            placeholder="PLANTER15" className="flex-1 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm font-mono disabled:bg-[#1E3A5F]/5" />
          <label className="flex items-center gap-1.5 text-xs text-[#1E3A5F]/70 whitespace-nowrap">
            <input type="checkbox" checked={autoGenerate} onChange={e => setAutoGenerate(e.target.checked)} />
            Auto-generate
          </label>
        </div>
        <p className="text-xs text-[#1E3A5F]/40 mb-4">{autoGenerate ? "A code will be generated from the campaign name when you save." : "Customers will mention this code when they place their next order."}</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Discount Type</label>
            <select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm">
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed dollar amount</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Discount Amount</label>
            <div className="relative">
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
              <span className="absolute right-3 top-2 text-sm text-[#1E3A5F]/40">{discountType === "percentage" ? "%" : "$"}</span>
            </div>
          </div>
        </div>

        <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Applies To</label>
        <select value={appliesToType} onChange={e => { setAppliesToType(e.target.value as any); setAppliesToValue(""); }} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-2">
          <option value="all">Entire order</option>
          <option value="product_type">A product category</option>
          <option value="product">A specific product</option>
        </select>
        {appliesToType === "product_type" && (
          <select value={appliesToValue} onChange={e => setAppliesToValue(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm">
            <option value="">Choose a category…</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        )}
        {appliesToType === "product" && (
          <select value={appliesToValue} onChange={e => setAppliesToValue(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm">
            <option value="">Choose a product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* ===== Rules ===== */}
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 shadow-sm mb-5">
        <h2 className="font-display text-base text-[#1E3A5F] mb-4">Coupon Rules</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Minimum Purchase ($, optional)</label>
            <input type="number" value={minPurchase} onChange={e => setMinPurchase(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Maximum Discount ($, optional)</label>
            <input type="number" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Start Date (optional)</label>
            <input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Expiration Date (optional)</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Max Total Redemptions (optional)</label>
            <input type="number" value={maxTotalRedemptions} onChange={e => setMaxTotalRedemptions(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Max Redemptions Per Customer</label>
            <input type="number" value={maxPerCustomer} onChange={e => setMaxPerCustomer(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#1E3A5F]/80">
          <input type="checkbox" checked={combinable} onChange={e => setCombinable(e.target.checked)} />
          Allow this coupon to be combined with other discounts
        </label>
      </div>

      {/* ===== Targeting ===== */}
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 shadow-sm mb-5">
        <h2 className="font-display text-base text-[#1E3A5F] mb-1">Who Should Receive This?</h2>
        <p className="text-xs text-[#1E3A5F]/50 mb-4">Target customers based on what they've actually purchased before.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {[
            { v: "all", label: "All customers" },
            { v: "product_type", label: "Purchased a category" },
            { v: "product", label: "Purchased a product" },
            { v: "date_range", label: "Purchased in date range" },
            { v: "manual", label: "Individual customers" }
          ].map(opt => (
            <button
              key={opt.v}
              onClick={() => setTargetingType(opt.v as any)}
              className={`px-3 py-2.5 rounded-md text-sm font-semibold border transition-colors ${targetingType === opt.v ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F]/70 border-[#1E3A5F]/15 hover:border-[#1E3A5F]/40"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {targetingType === "product_type" && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-[#1E3A5F]/60 mb-2">Customers who have purchased:</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setTargetProductType(c.value)}
                  className={`text-left px-3 py-2.5 rounded-md border text-sm ${targetProductType === c.value ? "border-ember bg-ember/5" : "border-[#1E3A5F]/15"}`}>
                  <div className="font-semibold text-[#1E3A5F]">{c.label}</div>
                  <div className="text-xs text-[#1E3A5F]/50">{categoryCounts ? `${categoryCounts[c.value] ?? 0} customers` : "…"}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {targetingType === "product" && (
          <select value={targetProductId} onChange={e => setTargetProductId(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-4">
            <option value="">Choose a product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {targetingType === "date_range" && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Purchased after</label>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Purchased before</label>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {targetingType === "manual" && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Search by name, email, or phone</label>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search customers…"
              className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-2" />
            {searchResults.length > 0 && (
              <div className="border border-[#1E3A5F]/10 rounded-md overflow-hidden mb-3">
                {searchResults.map(c => (
                  <button key={c.id} onClick={() => addManualCustomer(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-cream/60 border-b border-[#1E3A5F]/5 last:border-0">
                    <div className="font-medium text-[#1E3A5F]">{c.full_name}</div>
                    <div className="text-xs text-[#1E3A5F]/50">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
                  </button>
                ))}
              </div>
            )}
            {manualCustomers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {manualCustomers.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 bg-[#1E3A5F]/5 text-[#1E3A5F] text-xs px-2.5 py-1.5 rounded-full">
                    {c.full_name}
                    <button onClick={() => removeManualCustomer(c.id)} className="text-[#1E3A5F]/50 hover:text-ember font-bold">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {targetingType !== "manual" && (
          <label className="flex items-center gap-2 text-sm text-[#1E3A5F]/80 mb-4">
            <input type="checkbox" checked={excludePreviouslySent} onChange={e => setExcludePreviouslySent(e.target.checked)} />
            Exclude customers who have already received this campaign
          </label>
        )}

        {/* Recipient list with select-all / individual deselect */}
        <div className="border-t border-[#1E3A5F]/10 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[#1E3A5F]">
              RECIPIENTS — {loadingRecipients ? "…" : finalRecipients.length} customer{finalRecipients.length === 1 ? "" : "s"} selected
            </p>
            {targetingType !== "manual" && matchedCustomers.length > 0 && (
              <div className="flex gap-3 text-xs font-semibold">
                <button onClick={() => setDeselectedIds(new Set())} className="text-[#1E3A5F] hover:underline">Select All</button>
                <button onClick={() => setDeselectedIds(new Set(matchedCustomers.map(c => c.id)))} className="text-[#1E3A5F]/60 hover:underline">Deselect All</button>
              </div>
            )}
          </div>

          {targetingType !== "manual" && matchedCustomers.length === 0 && !loadingRecipients && (
            <p className="text-sm text-[#1E3A5F]/50 py-3">
              {targetingType === "product_type" ? `No customers have purchased ${CATEGORIES.find(c => c.value === targetProductType)?.label.toLowerCase()} yet.` : "No matching customers found."}
            </p>
          )}

          {targetingType !== "manual" && matchedCustomers.length > 0 && (
            <div className="max-h-64 overflow-y-auto border border-[#1E3A5F]/10 rounded-md">
              {matchedCustomers.map(c => (
                <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm border-b border-[#1E3A5F]/5 last:border-0 hover:bg-cream/40 cursor-pointer">
                  <input type="checkbox" checked={!deselectedIds.has(c.id)} onChange={() => toggleDeselect(c.id)} />
                  <span className="text-[#1E3A5F]">{c.full_name}</span>
                  <span className="text-xs text-[#1E3A5F]/40">{c.email}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Email composer ===== */}
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 shadow-sm mb-5">
        <h2 className="font-display text-base text-[#1E3A5F] mb-1">Email</h2>
        <p className="text-xs text-[#1E3A5F]/50 mb-4">
          Use <code className="bg-[#1E3A5F]/5 px-1 rounded">{"{{first_name}}"}</code>, <code className="bg-[#1E3A5F]/5 px-1 rounded">{"{{coupon_code}}"}</code>, <code className="bg-[#1E3A5F]/5 px-1 rounded">{"{{discount}}"}</code>, <code className="bg-[#1E3A5F]/5 px-1 rounded">{"{{expiration_date}}"}</code>, and <code className="bg-[#1E3A5F]/5 px-1 rounded">{"{{applies_to}}"}</code> anywhere — they'll be filled in automatically. The coupon code is also always shown in its own box below your message.
        </p>
        <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Email Subject</label>
        <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-4" />
        <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Email Heading</label>
        <input value={emailHeading} onChange={e => setEmailHeading(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-4" />
        <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Email Body</label>
        <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={7} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />

        <button onClick={() => setShowPreview(true)} className="mt-4 border border-[#1E3A5F] text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold">
          Preview Email
        </button>
      </div>

      {/* ===== Bottom action bar ===== */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-[#1E3A5F]/10 px-6 py-4 flex flex-wrap gap-3 items-center justify-end z-20">
        <button onClick={handleSaveDraft} disabled={!!busy} className="text-sm font-semibold text-[#1E3A5F]/70 px-4 py-2.5">
          {busy === "draft" ? "Saving…" : "Save as Draft"}
        </button>
        <button onClick={handleSendTest} disabled={!!busy} className="border border-[#1E3A5F] text-[#1E3A5F] px-4 py-2.5 rounded-md text-sm font-semibold">
          {busy === "test" ? "Sending…" : "Send Test Email"}
        </button>
        <button onClick={() => setShowConfirm(true)} disabled={!!busy} className="bg-ember text-white px-5 py-2.5 rounded-md text-sm font-semibold">
          Review &amp; Send
        </button>
      </div>

      {/* ===== Email preview modal ===== */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-ember uppercase tracking-wide">Preview — sample data, not sent</p>
              <button onClick={() => setShowPreview(false)} className="text-[#1E3A5F]/50 text-xl leading-none">×</button>
            </div>
            <div className="border border-[#1E3A5F]/10 rounded-lg p-5 bg-cream/40">
              <p className="text-xs text-[#1E3A5F]/50 mb-2">Subject: {emailSubject.replace(/\{\{\s*discount\s*\}\}/g, discountDisplay)}</p>
              <h3 className="font-display text-lg text-[#1E3A5F] mb-3">{emailHeading}</h3>
              {emailBody.split("\n").filter(Boolean).map((line, i) => (
                <p key={i} className="text-sm text-[#2A211C] mb-2">
                  {line
                    .replace(/\{\{\s*first_name\s*\}\}/g, "Andrew")
                    .replace(/\{\{\s*coupon_code\s*\}\}/g, couponCode || "PLANTER15")
                    .replace(/\{\{\s*discount\s*\}\}/g, discountDisplay)
                    .replace(/\{\{\s*expiration_date\s*\}\}/g, expiresAt ? new Date(expiresAt).toLocaleDateString() : "")
                    .replace(/\{\{\s*applies_to\s*\}\}/g, appliesToDisplay)}
                </p>
              ))}
              <div className="bg-[#FCEFDC] rounded-lg p-4 text-center mt-4">
                <div className="text-[10px] uppercase text-[#8a7a6b] mb-1">Your Code</div>
                <div className="text-xl font-bold text-ember font-mono">{couponCode || "PLANTER15"}</div>
                <div className="text-xs text-[#6b5d4f] mt-2">Just mention this code when you place your next order and we'll apply your discount — no account or login needed.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Final confirmation modal ===== */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="font-display text-lg text-[#1E3A5F] mb-4">Confirm Campaign</h3>
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between"><span className="text-[#1E3A5F]/50">Campaign</span><span className="font-semibold text-[#1E3A5F] text-right">{name || "(untitled)"}</span></div>
              <div className="flex justify-between"><span className="text-[#1E3A5F]/50">Coupon</span><span className="font-mono text-[#1E3A5F]">{couponCode || "(auto-generated)"}</span></div>
              <div className="flex justify-between"><span className="text-[#1E3A5F]/50">Discount</span><span className="text-[#1E3A5F]">{discountDisplay}</span></div>
              <div className="flex justify-between"><span className="text-[#1E3A5F]/50">Applies To</span><span className="text-[#1E3A5F]">{appliesToDisplay}</span></div>
              <div className="flex justify-between"><span className="text-[#1E3A5F]/50">Recipients</span><span className="font-semibold text-[#1E3A5F]">{finalRecipients.length} customers</span></div>
            </div>

            <p className="text-xs font-semibold text-[#1E3A5F]/60 mb-2">Recipients ({finalRecipients.length})</p>
            <div className="max-h-32 overflow-y-auto border border-[#1E3A5F]/10 rounded-md mb-5 text-sm">
              {finalRecipients.map(c => (
                <div key={c.id} className="px-3 py-1.5 border-b border-[#1E3A5F]/5 last:border-0 text-[#1E3A5F]">{c.full_name}</div>
              ))}
            </div>

            <div className="flex gap-4 mb-4 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" checked={sendSchedule === "now"} onChange={() => setSendSchedule("now")} /> Send Now</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={sendSchedule === "later"} onChange={() => setSendSchedule("later")} /> Schedule Send</label>
            </div>
            {sendSchedule === "later" && (
              <div className="mb-5">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
                  <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
                </div>
                <p className="text-xs text-amber bg-amber/10 border border-amber/30 rounded-md px-3 py-2">
                  This will save the campaign as "Scheduled" for the chosen time, but it won't send itself automatically until a scheduler is set up to trigger it. Ask your developer before relying on this.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm font-semibold text-[#1E3A5F]/70">Cancel</button>
              <button onClick={handleConfirmSend} disabled={!!busy || (sendSchedule === "later" && !scheduledDate)} className="bg-ember text-white px-5 py-2 rounded-md text-sm font-semibold">
                {busy === "send" ? "Sending…" : sendSchedule === "now" ? "Send Campaign" : "Schedule Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
