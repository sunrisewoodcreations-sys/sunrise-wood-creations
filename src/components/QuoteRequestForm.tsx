"use client";

import { useState } from "react";

const PRODUCT_TYPES = [
  { value: "", label: "Not sure yet" },
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" },
  { value: "other", label: "Something else" }
];

export default function QuoteRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [productType, setProductType] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [woodType, setWoodType] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, productType, dimensions, woodType, budget, timeline, description })
    });

    setLoading(false);
    if (res.ok) {
      setDone(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong. Try again in a moment.");
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-walnut/10 rounded-xl p-8 text-center">
        <h2 className="font-display text-xl text-walnut mb-2">Thanks, {name.split(" ")[0]}!</h2>
        <p className="text-walnut/70">We got your request and will email you back soon at {email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-walnut/10 rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">Your name</label>
          <input required value={name} onChange={e => setName(e.target.value)} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">Email</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">Phone (optional)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">What are you thinking?</label>
          <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm">
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">Size, if you know it</label>
          <input value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder={`e.g. 24"x48"`} className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">Wood type (if you have a preference)</label>
          <input value={woodType} onChange={e => setWoodType(e.target.value)} placeholder="Cedar, oak, no preference..." className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">Budget range</label>
          <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="$100-150" className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-walnut mb-1">When do you need it?</label>
          <input value={timeline} onChange={e => setTimeline(e.target.value)} placeholder="No rush, or a specific date" className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-walnut mb-1">Tell us what you're picturing</label>
        <textarea
          required
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the design, colors, occasion, anything that helps us understand what you want..."
          className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-ember text-white px-6 py-3 rounded-md text-sm font-semibold disabled:opacity-60"
      >
        {loading ? "Sending..." : "Request a quote"}
      </button>
    </form>
  );
}
