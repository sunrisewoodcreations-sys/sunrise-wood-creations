import { stepsFor, ProductType } from "@/lib/statusSteps";

function formatStamp(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

// A narrower version of the admin progress bar, sized to fit inline in
// a list of orders without needing to scroll sideways — every step
// takes an even share of the available width instead of a fixed size.
export default function CompactProgressTracker({
  productType,
  currentStatus,
  statusTimestamps
}: {
  productType: ProductType;
  currentStatus: string;
  statusTimestamps?: Record<string, string>;
}) {
  const steps = stepsFor(productType);
  const currentIndex = steps.findIndex(s => s.key === currentStatus);

  return (
    <div className="flex items-start w-full mt-3">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const stamp = statusTimestamps?.[step.key];
        return (
          <div key={step.key} className="flex flex-col items-center flex-1 min-w-0 relative">
            {i > 0 && (
              <div
                className={`absolute top-[10px] -left-1/2 w-full h-[2px] ${
                  isDone || isCurrent ? "bg-sage" : "bg-walnut/10"
                }`}
              />
            )}
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 text-[9px] font-bold
              ${isDone ? "bg-sage border-sage text-white" : ""}
              ${isCurrent ? "bg-white border-ember" : ""}
              ${!isDone && !isCurrent ? "bg-white border-walnut/10" : ""}`}
            >
              {isDone && "✓"}
              {isCurrent && <span className="w-2 h-2 rounded-full bg-ember" />}
            </div>
            <div className={`text-[9px] text-center mt-1 leading-tight px-0.5 ${isCurrent ? "text-ember font-semibold" : "text-walnut/50"}`}>
              {step.label}
            </div>
            {(isDone || isCurrent) && stamp && (
              <div className="text-[8px] text-center leading-tight text-walnut/35 font-mono">
                {formatStamp(stamp)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
