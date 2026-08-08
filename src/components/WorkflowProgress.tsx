import { WorkflowStage, WORKFLOW_STAGES, WORKFLOW_LABELS } from "@/lib/workflow";

// Visual progress indicator for the production workflow — shown on
// every order. Purely presentational; the actual stage is computed
// elsewhere (getWorkflowStage in lib/workflow.ts) and passed in as a prop.
export default function WorkflowProgress({ stage }: { stage: WorkflowStage }) {
  const currentIndex = WORKFLOW_STAGES.indexOf(stage);

  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {WORKFLOW_STAGES.map((s, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isCurrent ? "bg-[#1E3A5F] text-white" : isDone ? "bg-sage text-white" : "bg-[#1E3A5F]/10 text-[#1E3A5F]/40"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] mt-1 whitespace-nowrap ${isCurrent ? "font-bold text-[#1E3A5F]" : "text-[#1E3A5F]/50"}`}>
                {WORKFLOW_LABELS[s]}
              </span>
            </div>
            {i < WORKFLOW_STAGES.length - 1 && (
              <div className={`w-6 sm:w-10 h-0.5 mb-4 flex-shrink-0 ${isDone ? "bg-sage" : "bg-[#1E3A5F]/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
