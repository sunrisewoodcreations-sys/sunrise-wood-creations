"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BOMPartRow, bomPartsToRows, withAutoNames } from "@/components/ProductBOMEditor";

// All the state and save/delete/duplicate logic that used to live only
// inside ProductRow.tsx (the desktop table row), extracted so a mobile
// card view can share the exact same behavior instead of a second,
// separately-maintained copy of it. Nothing about how saving, deleting,
// duplicating, or keeping parts in sync actually works has changed —
// this is the same logic, just usable from more than one component.

export type Product = {
  id: string;
  product_type: string;
  name: string;
  size_details: string | null;
  price_cents: number;
  cost_cents: number;
  stock_quantity: number;
  low_stock_threshold: number;
  pickets_per_unit: number;
  estimated_build_minutes: number | null;
};

export type BOMPartsInput = { part_name: string; length_inches: number; final_length_inches: number | null; quantity_per_unit: number; material_type: string; is_trim: boolean; grain_direction: string | null }[];

export function useProductEditor(product: Product, bomParts?: BOMPartsInput) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState("");

  const [productType, setProductType] = useState(product.product_type);
  const [name, setName] = useState(product.name);
  const [sizeDetails, setSizeDetails] = useState(product.size_details || "");
  const [price, setPrice] = useState((product.price_cents / 100).toString());
  const [costPrice, setCostPrice] = useState(((product.cost_cents ?? 0) / 100).toString());
  const [stockQuantity, setStockQuantity] = useState(String(product.stock_quantity ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product.low_stock_threshold ?? 0));
  const [picketsPerUnit, setPicketsPerUnit] = useState(String(product.pickets_per_unit ?? 0));
  const [estimatedBuildMinutes, setEstimatedBuildMinutes] = useState(String(product.estimated_build_minutes ?? ""));
  const [partRows, setPartRows] = useState<BOMPartRow[]>(() => bomPartsToRows(bomParts || []));

  // Keep the parts rows in sync with the real server data whenever it
  // actually changes (e.g. after a save completes and this page
  // refreshes) — not just once on first mount.
  const bomPartsKey = JSON.stringify(bomParts || []);
  const lastSyncedBomKey = useRef(bomPartsKey);
  useEffect(() => {
    if (bomPartsKey !== lastSyncedBomKey.current) {
      lastSyncedBomKey.current = bomPartsKey;
      setPartRows(bomPartsToRows(bomParts || []));
    }
  }, [bomPartsKey, bomParts]);

  const margin = (product.price_cents - (product.cost_cents || 0)) / 100;
  const isLowStock = (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 0);

  async function handleSave() {
    setLoading(true);
    setError("");

    const validPartRows = withAutoNames(partRows.filter(r => Number(r.length) > 0));

    const [productRes, partsRes] = await Promise.all([
      fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productType, name, sizeDetails, priceCents: price, costCents: costPrice, stockQuantity, lowStockThreshold, picketsPerUnit, estimatedBuildMinutes })
      }),
      fetch(`/api/products/${product.id}/bom-parts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: validPartRows.map(r => ({
            partName: r.partName,
            length: r.length,
            finalLength: r.finalLength || undefined,
            quantityPerUnit: r.quantityPerUnit,
            materialType: r.materialType,
            isTrim: r.isTrim,
            grainDirection: r.grainDirection || undefined
          }))
        })
      })
    ]);

    setLoading(false);

    if (productRes.ok && partsRes.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const failedRes = !productRes.ok ? productRes : partsRes;
      const body = await failedRes.json().catch(() => ({}));
      setError(body.error || "Couldn't save changes. Nothing was closed so you don't lose your edits — fix the issue above and try again.");
    }
  }

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  async function handleDuplicate() {
    setDuplicating(true);
    const res = await fetch(`/api/products/${product.id}/duplicate`, { method: "POST" });
    setDuplicating(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't duplicate this product.");
    }
  }

  return {
    editing, setEditing,
    confirmingDelete, setConfirmingDelete,
    loading, duplicating, error, setError,
    productType, setProductType,
    name, setName,
    sizeDetails, setSizeDetails,
    price, setPrice,
    costPrice, setCostPrice,
    stockQuantity, setStockQuantity,
    lowStockThreshold, setLowStockThreshold,
    picketsPerUnit, setPicketsPerUnit,
    estimatedBuildMinutes, setEstimatedBuildMinutes,
    partRows, setPartRows,
    margin, isLowStock,
    handleSave, handleDelete, handleDuplicate
  };
}
