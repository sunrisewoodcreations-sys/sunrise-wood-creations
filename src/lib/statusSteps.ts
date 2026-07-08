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
  { key: "deposit_received", label: "Deposit received" },
  { key: "order_placed", label: "Order placed" },
  { key: "design_approved", label: "Design approved" },
  { key: "top_being_printed", label: "Top being printed" },
  { key: "being_assembled", label: "Being assembled" },
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
