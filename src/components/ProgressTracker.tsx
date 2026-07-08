import { stepsFor, ProductType } from "@/lib/statusSteps";

export default function ProgressTracker({
  productType,
  currentStatus
}: {
  productType: ProductType;
  currentStatus: string;
}) {
  const steps = stepsFor(productType);
  const currentIndex = steps.findIndex(s => s.key === currentStatus);

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2 my-6">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step.key} className="flex flex-col items-center min-w-[92px] relative">
            {i > 0 && (
              <div
                className={`absolute top-4 -left-1/2 w-full h-[3px] ${
                  isDone || isCurrent ? "bg-sage" : "bg-walnut/10"
                }`}
              />
            )}
            <div
              className={`w-8 h-8 rounded-full border-[3px] flex items-center justify-center z-10 text-xs font-bold
              ${isDone ? "bg-sage border-sage text-white" : ""}
              ${isCurrent ? "bg-white border-ember" : ""}
              ${!isDone && !isCurrent ? "bg-white border-walnut/10" : ""}`}
            >
              {isDone && "✓"}
              {isCurrent && <span className="w-3 h-3 rounded-full bg-ember" />}
            </div>
            <div className={`text-[11px] text-center mt-2 leading-tight max-w-[90px] ${isCurrent ? "text-ember font-semibold" : "text-walnut/60"}`}>
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
