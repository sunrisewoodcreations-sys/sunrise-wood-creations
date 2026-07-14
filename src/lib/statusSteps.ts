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

export function stepsFor(productType: ProductType) {
  return productType === "cornhole" ? CORNHOLE_STEPS : STANDARD_STEPS;
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
export function statusLabel(productType: ProductType, statusKey: string) {
  const steps = stepsFor(productType);
  const match = steps.find(s => s.key === statusKey);
  return match ? match.label : statusKey;
}

// Badge color for a given status, covering every status key across both
// step sets. Purely additive — used by the Orders table's status badges.
export function statusColor(statusKey: string): string {
  switch (statusKey) {
    case "order_placed":
      return "bg-[#1E3A5F]/10 text-[#1E3A5F]";
    case "deposit_received":
      return "bg-amber/25 text-[#1E3A5F]";
    case "design_proof_sent":
      return "bg-ember/15 text-ember";
    case "design_approved":
      return "bg-sage/15 text-sage";
    case "being_assembled":
    case "being_built":
      return "bg-amber/25 text-[#1E3A5F]";
    case "ready_for_pickup":
      return "bg-sage/20 text-sage";
    case "picked_up":
      return "bg-[#1E3A5F]/5 text-[#1E3A5F]/50";
    default:
      return "bg-[#1E3A5F]/10 text-[#1E3A5F]";
  }
}
