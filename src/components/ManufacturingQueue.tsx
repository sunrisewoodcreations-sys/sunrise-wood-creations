"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WORKFLOW_LABELS, WORKFLOW_STYLES, WorkflowStage } from "@/lib/workflow";
import { PRIORITY_STYLES, PRIORITY_LABELS } from "@/lib/priorityStyles";
import { productLabel, ProductType } from "@/lib/statusSteps";
import { formatCalendarDate } from "@/lib/dateDisplay";
import { getNextProductionStage } from "@/lib/productionQueue";
import QueueStageAdvanceButton from "@/components/QueueStageAdvanceButton";

type QueueOrder = {
  id: string;
  customerName: string;
  isPriorityCustomer: boolean;
  productType: string;
  title: string;
  products: string[];
  productPhotoUrl: string | null;
  sizeDetails: string | null;
  quantity: number;
  productionDate: string | null;
  dueDate: string | null;
  priority: string;
  manualQueuePosition: number | null;
  workflowStage: WorkflowStage;
  materialCheck: { available: boolean; shortages: { materialType: string; short: number | null }[] };
  estimatedBuildMinutes: number | null;
  buildTimePartiallyTracked: boolean;
  scheduledPickupDate: string | null;
  scheduledPickupTime: string | null;
  productionStatus: string;
};

function formatBuildTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

// The command center for what's actually being built right now.
// Deliberately scoped to just "In Production" orders (building,
// assembly, finishing) — a different, narrower view than the existing
// Queue page, which covers everything scheduled regardless of whether
// work has actually started. Reuses the workflow engine, material
// check, and priority styling already built for the workflow engine
// and Production Schedule — no new logic for any of that here.
export default function ManufacturingQueue({ orders: initialOrders }: { orders: QueueOrder[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const anyPinned = orders.some(o => o.manualQueuePosition != null);

  // Same HTML5 drag-and-drop approach already proven on Production
  // Schedule for assigning production dates — reused here for
  // reordering instead of date assignment. Reorders the visible list
  // immediately (so dragging feels instant), then persists sequential
  // positions for the whole list in one call — from that point on,
  // this exact arrangement is what the queue shows until manually
  // reset back to automatic sorting.
  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); return; }
    setOrders(prev => {
      const next = [...prev];
      const fromIndex = next.findIndex(o => o.id === draggingId);
      const toIndex = next.findIndex(o => o.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persistOrder(next.map(o => o.id));
      return next;
    });
    setDraggingId(null);
  }

  async function persistOrder(orderedIds: string[]) {
    setSaving(true);
    await fetch("/api/production-queue-reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds })
    });
    setSaving(false);
    router.refresh();
  }

  async function handleResetToAutomatic() {
    setSaving(true);
    await fetch("/api/production-queue-reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: orders.map(o => o.id), clearAll: true })
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Manufacturing Queue</h1>
        <div className="flex gap-2">
          {anyPinned && (
            <button onClick={handleResetToAutomatic} disabled={saving} className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream disabled:opacity-60">
              Reset to automatic order
            </button>
          )}
          <Link href="/admin/queue" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream">
            Full Build Queue →
          </Link>
          <Link href="/admin/schedule" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream">
            Production Schedule →
          </Link>
        </div>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Every order currently in production, in the order it should be built. Drag any card to reorder.
      </p>

      {orders.length === 0 ? (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">
          <p className="mb-2">Nothing is actively in production right now.</p>
          <p className="text-xs">
            Scheduled orders show up here once production actually starts — either generate a cut list for their
            production date, or click "Start Production" on the Production Schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => (
            <div
              key={o.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData("text/plain", o.id); setDraggingId(o.id); }}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(o.id)}
              className={`bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 cursor-grab active:cursor-grabbing transition-opacity ${draggingId === o.id ? "opacity-40" : ""}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  {o.productPhotoUrl ? (
                    <img src={o.productPhotoUrl} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-[#1E3A5F]/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-cream border border-[#1E3A5F]/10 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/orders/${o.id}`} className="font-semibold text-[#1E3A5F] hover:underline truncate">
                        {o.customerName}
                      </Link>
                      {o.isPriorityCustomer && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-ember/15 text-ember flex-shrink-0">Priority</span>}
                    </div>
                    <div className="text-xs text-[#1E3A5F]/50 truncate">
                      {productLabel(o.productType as ProductType)} — {o.title}{o.sizeDetails ? ` (${o.sizeDetails})` : ""}
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${PRIORITY_STYLES[o.priority || "normal"]}`}>
                  {PRIORITY_LABELS[o.priority || "normal"]}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <Field label="Product(s)" value={o.products.join(", ")} />
                <Field label="Quantity" value={String(o.quantity)} />
                <Field label="Est. completion" value={o.dueDate ? formatCalendarDate(o.dueDate) : "—"} />
                <Field
                  label="Estimated build time"
                  value={o.estimatedBuildMinutes != null ? formatBuildTime(o.estimatedBuildMinutes) + (o.buildTimePartiallyTracked ? " (partial)" : "") : "Not tracked"}
                  muted={o.estimatedBuildMinutes == null}
                />
                <Field label="Production date" value={o.productionDate ? formatCalendarDate(o.productionDate) : "—"} />
                <Field
                  label="Scheduled pickup"
                  value={o.scheduledPickupDate ? `${formatCalendarDate(o.scheduledPickupDate)} ${o.scheduledPickupTime || ""}`.trim() : "Not scheduled"}
                  muted={!o.scheduledPickupDate}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${WORKFLOW_STYLES[o.workflowStage]}`}>
                  {WORKFLOW_LABELS[o.workflowStage]}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                  o.materialCheck.available ? "bg-sage/15 text-sage" : "bg-ember/15 text-ember"
                }`}>
                  {o.materialCheck.available ? "Material ready" : `Material short: ${o.materialCheck.shortages.map(s => `${s.materialType} (${s.short})`).join(", ")}`}
                </span>
                {o.manualQueuePosition != null && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]/60 whitespace-nowrap">Manually pinned</span>
                )}
              </div>

              <div className="flex gap-2">
                {getNextProductionStage(o.productionStatus) && (
                  <QueueStageAdvanceButton orderId={o.id} currentStage={o.productionStatus} nextStage={getNextProductionStage(o.productionStatus)!} />
                )}
                <Link href="/admin/cutlist" className="flex-1">
                  <button className="w-full border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-3 py-2 text-xs font-semibold hover:bg-cream">
                    Cut List →
                  </button>
                </Link>
                <Link href={`/admin/orders/${o.id}`} className="flex-1">
                  <button className="w-full bg-[#1E3A5F] text-white rounded-md px-3 py-2 text-xs font-semibold">
                    Open Order →
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">{label}</div>
      <div className={muted ? "text-[#1E3A5F]/40 italic text-sm" : "text-[#1E3A5F] text-sm font-semibold"}>{value}</div>
    </div>
  );
}
