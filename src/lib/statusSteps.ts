// This file is the single source of truth for what "progress" looks like
// for each product type. If you ever want to add or rename a step,
// change it here and it updates everywhere: the customer's progress bar,
// the admin status dropdown, and the wording used in emails.

export type ProductType = "cornhole" | "sign" | "planter" | "cutting_board";

export const STANDARD_STEPS = [
  { key: "order_placed", label: "Order placed" },
  { key: "being_built", label: "Being built" },
  { key: "ready_for_pickup", label: "Ready for pickup" },
  { key: "picked_up", label: "Picked up" }
] as const;

export const CORNHOLE_STEPS = [
  { key: "order_placed", label: "Order placed" },
  { key: "deposit_received", label: "Deposit received" },
  { key: "design_proof_sent", label: "Design proof sent" },
  { key: "design_approved", label: "Design approved" },
  { key: "being_assembled", label: "Being made" },
  { key: "ready_for_pickup", label: "Ready for pickup" },
  { key: "picked_up", label: "Picked up" }
] as const;

// Orders being delivered use delivery wording for the last two steps. The
// stored status keys never change (ready_for_pickup / picked_up), only what
// people read, so everything that keys off the status keeps working.
export function isDeliveryOrder(fulfillmentMethod?: string | null) {
  return fulfillmentMethod === "delivery";
}

export function stepsFor(productType: ProductType, fulfillmentMethod?: string | null) {
  const base = productType === "cornhole" ? CORNHOLE_STEPS : STANDARD_STEPS;
  if (!isDeliveryOrder(fulfillmentMethod)) return base;
  return base.map(s =>
    s.key === "ready_for_pickup" ? { ...s, label: "Ready for delivery" }
    : s.key === "picked_up" ? { ...s, label: "Delivered" }
    : s
  ) as unknown as typeof base;
}

export function productLabel(productType: ProductType) {
  switch (productType) {
    case "cornhole": return "Cornhole boards";
    case "sign": return "Wooden sign";
    case "planter": return "Planter box";
    case "cutting_board": return "Cutting board";
  }
}

// Used to build the "Your order has moved to: X" email copy.
export function statusLabel(productType: ProductType, statusKey: string, fulfillmentMethod?: string | null) {
  const steps = stepsFor(productType, fulfillmentMethod);
  const match = steps.find(s => s.key === statusKey);
  return match ? match.label : statusKey;
}

// Badge color for a given status, covering every status key across both
// step sets. Purely additive — used by the Orders table's status badges.
export function statusColor(statusKey: string): string {
  switch (statusKey) {
    case "order_placed":
      return "bg-[#1E3A5F] text-white";
    case "deposit_received":
      return "bg-amber text-white";
    case "design_proof_sent":
      return "bg-ember text-white";
    case "design_approved":
      return "bg-sage text-white";
    case "being_assembled":
    case "being_built":
      return "bg-amber text-white";
    case "ready_for_pickup":
      return "bg-sage text-white";
    case "picked_up":
      return "bg-[#1E3A5F]/10 text-[#1E3A5F]/60";
    default:
      return "bg-[#1E3A5F]/10 text-[#1E3A5F]";
  }
}
