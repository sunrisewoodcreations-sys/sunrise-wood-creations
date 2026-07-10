import { stepsFor, ProductType } from "@/lib/statusSteps";

function formatStamp(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  return `${date}, ${time} ET`;
}

export default function ProgressTracker({
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
    <div className="flex items-start gap-0 overflow-x-auto pb-2 my-6">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const stamp = statusTimestamps?.[step.key];
        return (
          <div key={step.key} className="flex flex-col items-center min-w-[110px] relative">
            {i > 0 && (
              <div
                className={`absolute top-4 -left-1/2 w-full h-[3px] ${
                  isDone || isCurrent ? "bg-sage" : "bg-[#1E3A5F]/10"
                }`}
              />
            )}
            <div
              className={`w-8 h-8 rounded-full border-[3px] flex items-center justify-center z-10 text-xs font-bold
              ${isDone ? "bg-sage border-sage text-white" : ""}
              ${isCurrent ? "bg-white border-ember" : ""}
              ${!isDone && !isCurrent ? "bg-white border-[#1E3A5F]/10" : ""}`}
            >
              {isDone && "✓"}
              {isCurrent && <span className="w-3 h-3 rounded-full bg-ember" />}
            </div>
            <div className={`text-[11px] text-center mt-2 leading-tight max-w-[100px] ${isCurrent ? "text-ember font-semibold" : "text-[#1E3A5F]/60"}`}>
              {step.label}
            </div>
            {(isDone || isCurrent) && stamp && (
              <div className="text-[10px] text-center mt-1 leading-tight max-w-[100px] text-[#1E3A5F]/40 font-mono">
                {formatStamp(stamp)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
