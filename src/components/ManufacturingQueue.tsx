import Link from "next/link";
import { WORKFLOW_LABELS, WORKFLOW_STYLES, WorkflowStage } from "@/lib/workflow";
import { PRIORITY_STYLES, PRIORITY_LABELS } from "@/lib/priorityStyles";
import { productLabel, ProductType } from "@/lib/statusSteps";
import { formatCalendarDate } from "@/lib/dateDisplay";

type QueueOrder = {
  id: string;
  customerName: string;
  productType: string;
  title: string;
  products: string[];
  quantity: number;
  productionDate: string | null;
  priority: string;
  workflowStage: WorkflowStage;
  materialCheck: { available: boolean; shortages: { materialType: string; short: number | null }[] };
  estimatedBuildMinutes: number | null;
  buildTimePartiallyTracked: boolean;
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
export default function ManufacturingQueue({ orders }: { orders: QueueOrder[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Manufacturing Queue</h1>
        <div className="flex gap-2">
          <Link href="/admin/queue" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream">
            Full Build Queue →
          </Link>
          <Link href="/admin/schedule" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream">
            Production Schedule →
          </Link>
        </div>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Every order currently in production, in the order it should be built.
      </p>

      {orders.length === 0 ? (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">
          Nothing is actively in production right now.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => (
            <div key={o.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-[#1E3A5F] hover:underline">
                      {o.customerName}
                    </Link>
                    <div className="text-xs text-[#1E3A5F]/50">{productLabel(o.productType as ProductType)} — {o.title}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${PRIORITY_STYLES[o.priority || "normal"]}`}>
                  {PRIORITY_LABELS[o.priority || "normal"]}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <Field label="Product(s)" value={o.products.join(", ")} />
                <Field label="Quantity" value={String(o.quantity)} />
                <Field label="Production date" value={o.productionDate ? formatCalendarDate(o.productionDate) : "—"} />
                <Field
                  label="Estimated build time"
                  value={o.estimatedBuildMinutes != null ? formatBuildTime(o.estimatedBuildMinutes) + (o.buildTimePartiallyTracked ? " (partial)" : "") : "Not tracked"}
                  muted={o.estimatedBuildMinutes == null}
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
              </div>

              <div className="flex gap-2">
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
