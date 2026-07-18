// Material Requirements Planning — material-agnostic by design.
//
// The calculation side (parts -> boards needed, waste %) already works
// for ANY material name, since it's driven entirely by whatever string
// is in a part's materialType field (Cedar, Pine, Plywood, Hardware,
// whatever you type on the Products page) and reuses the exact same
// optimizer already proven in the Cut List Generator.
//
// The INVENTORY side is different: right now, only cedar pickets have
// a real inventory table (picket_purchases). Pine, plywood, hardware,
// etc. have no tracked source of "how much is on hand" anywhere in this
// app yet. Rather than fake a number for materials with no real
// tracking, this file uses one small, explicit mapping
// (MATERIAL_INVENTORY_SOURCES below) from a material name to a
// function that knows how to look up its on-hand quantity. Today there
// is exactly one entry, for Cedar. Adding real inventory for another
// material later (Pine, Plywood, ...) means adding one more entry to
// that mapping and building its own inventory table/page — nothing
// else in this file, or in Material Planning's UI, needs to change.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOMPart, optimizeCutList, OptimizationResult } from "@/lib/cutlistOptimizer";

export const BOARD_LENGTH = 71; // your actual stock length, same constant the Cut List Generator uses
export const KERF = 0.125;

export type ContributingOrder = {
  orderId: string;
  orderTitle: string;
  customerName: string;
  totalInches: number;
  pieceCount: number;
};

export type PartBreakdown = {
  partName: string;
  length: number;
  totalQuantity: number;
};

export type MaterialRequirement = {
  materialType: string;
  optimization: OptimizationResult;      // boards required, waste %, etc — from the existing optimizer, untouched
  onHandQuantity: number | null;         // null = no inventory source tracked for this material yet
  shortQuantity: number | null;          // null if onHandQuantity is null
  parts: PartBreakdown[];                // drill-down: every part making up this material's total
  contributingOrders: ContributingOrder[]; // drill-down: every order consuming this material
};

export type MaterialPlanningResult = {
  rangeLabel: string;
  ordersInRange: number;
  requirements: MaterialRequirement[];
};

// --- Inventory sources ------------------------------------------------
// The one and only real inventory source that exists today. Matches
// case-insensitively against a part's materialType so "Cedar", "cedar",
// "CEDAR" all resolve to the same picket inventory.
async function getCedarPicketsOnHand(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("picket_purchases").select("remaining_quantity");
  return (data || []).reduce((sum: number, p: any) => sum + (p.remaining_quantity || 0), 0);
}

const MATERIAL_INVENTORY_SOURCES: Record<string, () => Promise<number>> = {
  cedar: getCedarPicketsOnHand
  // Add another material's inventory lookup here later, e.g.:
  // pine: getPineBoardsOnHand,
  // plywood: getPlywoodSheetsOnHand,
};

async function lookupOnHandQuantity(materialType: string): Promise<number | null> {
  const lookup = MATERIAL_INVENTORY_SOURCES[materialType.trim().toLowerCase()];
  return lookup ? await lookup() : null;
}

// --- Core computation --------------------------------------------------
// Given every order scheduled for production in a date range, works out
// total parts required per material, runs them through the existing
// optimizer, and compares against whatever inventory is actually
// trackable for that material.
export async function getMaterialRequirements(startDateStr: string, endDateStr: string, rangeLabel: string): Promise<MaterialPlanningResult> {
  const supabase = createClient();

  const [{ data: orderItems }, { data: bomParts }] = await Promise.all([
    supabase
      .from("order_items")
      .select("order_id, product_id, quantity, orders:order_id(title, production_date, status, customer_id, profiles:customer_id(full_name))"),
    supabase.from("product_bom_parts").select("*")
  ]);

  const bomPartsByProduct: Record<string, any[]> = {};
  (bomParts || []).forEach((p: any) => {
    if (!bomPartsByProduct[p.product_id]) bomPartsByProduct[p.product_id] = [];
    bomPartsByProduct[p.product_id].push(p);
  });

  // Same dedup principle already fixed in the Cut List Generator:
  // order_items is the source of truth, one order counted once.
  const seenOrderIds = new Set<string>();
  const jobs: { orderId: string; orderTitle: string; customerName: string; productId: string; quantity: number }[] = [];

  (orderItems || []).forEach((it: any) => {
    const order = it.orders;
    if (!order || !it.product_id) return;
    if (order.status === "picked_up") return;
    if (!order.production_date || order.production_date < startDateStr || order.production_date > endDateStr) return;
    if (seenOrderIds.has(it.order_id)) return; // one order, one line item counted per product — matches existing cut list behavior
    seenOrderIds.add(it.order_id);
    jobs.push({
      orderId: it.order_id,
      orderTitle: order.title,
      customerName: order.profiles?.full_name || "Unknown",
      productId: it.product_id,
      quantity: it.quantity || 1
    });
  });

  // Accumulate parts and per-order contributions, grouped by material —
  // built up job by job so drill-down data (which orders, which parts)
  // survives all the way through, not just the merged totals.
  const byMaterial = new Map<string, {
    parts: Map<string, PartBreakdown>;
    orders: Map<string, ContributingOrder>;
    allParts: BOMPart[];
  }>();

  for (const job of jobs) {
    const productParts = bomPartsByProduct[job.productId] || [];
    for (const p of productParts) {
      const materialKey = p.material_type || "Unspecified";
      if (!byMaterial.has(materialKey)) {
        byMaterial.set(materialKey, { parts: new Map(), orders: new Map(), allParts: [] });
      }
      const bucket = byMaterial.get(materialKey)!;

      const qty = (p.quantity_per_unit || 1) * job.quantity;
      const partKey = `${p.part_name}:${p.length_inches}`;
      const existingPart = bucket.parts.get(partKey);
      if (existingPart) {
        existingPart.totalQuantity += qty;
      } else {
        bucket.parts.set(partKey, { partName: p.part_name, length: p.length_inches, totalQuantity: qty });
      }

      const existingOrder = bucket.orders.get(job.orderId);
      const inchesForThisPart = p.length_inches * qty;
      if (existingOrder) {
        existingOrder.totalInches += inchesForThisPart;
        existingOrder.pieceCount += qty;
      } else {
        bucket.orders.set(job.orderId, {
          orderId: job.orderId,
          orderTitle: job.orderTitle,
          customerName: job.customerName,
          totalInches: inchesForThisPart,
          pieceCount: qty
        });
      }

      bucket.allParts.push({
        partName: p.part_name,
        length: p.length_inches,
        finalLength: p.final_length_inches ?? undefined,
        quantityPerUnit: qty,
        materialType: materialKey,
        isTrim: p.is_trim
      });
    }
  }

  const requirements: MaterialRequirement[] = [];
  for (const [materialType, bucket] of byMaterial.entries()) {
    const optimization = optimizeCutList(bucket.allParts, materialType, BOARD_LENGTH, KERF);
    const onHandQuantity = await lookupOnHandQuantity(materialType);
    const shortQuantity = onHandQuantity != null ? Math.max(0, optimization.totalBoards - onHandQuantity) : null;

    requirements.push({
      materialType,
      optimization,
      onHandQuantity,
      shortQuantity,
      parts: Array.from(bucket.parts.values()).sort((a, b) => b.length - a.length),
      contributingOrders: Array.from(bucket.orders.values()).sort((a, b) => b.totalInches - a.totalInches)
    });
  }

  requirements.sort((a, b) => a.materialType.localeCompare(b.materialType));

  return { rangeLabel, ordersInRange: jobs.length, requirements };
}

// A quick, always-reliable "can I start building today" check —
// independent of whatever date range is selected elsewhere on the page.
export async function getTodayReadiness(todayStr: string): Promise<{ ready: boolean; shortages: MaterialRequirement[] }> {
  const result = await getMaterialRequirements(todayStr, todayStr, "Today");
  const shortages = result.requirements.filter(r => r.shortQuantity != null && r.shortQuantity > 0);
  return { ready: shortages.length === 0, shortages };
}
