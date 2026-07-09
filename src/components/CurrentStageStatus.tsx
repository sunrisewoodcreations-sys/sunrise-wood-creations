import { statusLabel, ProductType } from "@/lib/statusSteps";

// A compact "what stage is this at, and when did it get there" badge —
// used instead of the full step-by-step progress bar on customer-facing
// pages. Disappears entirely once an order is picked up, since there's
// nothing left to track at that point.
export default function CurrentStageStatus({
  productType,
  currentStatus,
  movedAt
}: {
  productType: ProductType;
  currentStatus: string;
  movedAt?: string | null;
}) {
  if (currentStatus === "picked_up") return null;

  return (
    <div className="flex flex-col items-end">
      <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber/20 text-walnut whitespace-nowrap">
        {statusLabel(productType, currentStatus)}
      </span>
      {movedAt && (
        <span className="text-[10px] text-walnut/40 font-mono mt-1 whitespace-nowrap">
          {new Date(movedAt).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })},{" "}
          {new Date(movedAt).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET
        </span>
      )}
    </div>
  );
}
