// The production workflow — deliberately a set of PURE FUNCTIONS that
// derive a single, clear stage from data that already exists
// (orders.status, orders.production_status, orders.production_date,
// whether a proof is pending, and material availability), rather than
// a new stored column. You already have two status fields; adding a
// third one to keep in sync would create more ways for the truth to
// drift apart, not fewer. This file is the one place that turns those
// existing fields into the 7 stages you asked for.

export type WorkflowStage =
  | "new"
  | "scheduled"
  | "ready_to_build"
  | "in_production"
  | "waiting_on_customer"
  | "ready_for_pickup"
  | "completed";

export const WORKFLOW_STAGES: WorkflowStage[] = [
  "new", "scheduled", "ready_to_build", "in_production", "waiting_on_customer", "ready_for_pickup", "completed"
];

export const WORKFLOW_LABELS: Record<WorkflowStage, string> = {
  new: "New",
  scheduled: "Scheduled",
  ready_to_build: "Ready to Build",
  in_production: "In Production",
  waiting_on_customer: "Waiting on Customer",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed"
};

export const WORKFLOW_STYLES: Record<WorkflowStage, string> = {
  new: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60",
  scheduled: "bg-amber/20 text-amber",
  ready_to_build: "bg-sage/20 text-sage",
  in_production: "bg-amber/40 text-white",
  waiting_on_customer: "bg-ember/20 text-ember",
  ready_for_pickup: "bg-sage/40 text-white",
  completed: "bg-sage text-white"
};

export type WorkflowOrderInput = {
  id: string;
  status: string;
  production_status: string | null;
  production_date: string | null;
};

// The single function every part of the admin panel should call to
// find out where an order stands. materialAvailable is optional
// (null when it hasn't been checked, e.g. list views where checking
// every single order's material would be expensive) — when unknown,
// an order that would otherwise be "Ready to Build" is shown as
// "Scheduled" instead, since we can't actually confirm it's buildable.
export function getWorkflowStage(
  order: WorkflowOrderInput,
  isWaitingOnCustomer: boolean,
  materialAvailable: boolean | null
): WorkflowStage {
  if (order.status === "picked_up") return "completed";
  if (order.production_status === "completed") return "completed";
  if (order.status === "ready_for_pickup" || order.production_status === "ready_for_pickup") return "ready_for_pickup";
  if (isWaitingOnCustomer) return "waiting_on_customer";
  if (order.production_status === "building" || order.production_status === "assembly" || order.production_status === "finishing") {
    return "in_production";
  }
  if (order.production_date) {
    return materialAvailable === true ? "ready_to_build" : "scheduled";
  }
  return "new";
}
