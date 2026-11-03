import { Board } from "@/lib/cutlistOptimizer";

const COLORS = ["#1E3A5F", "#D9603A", "#7A9B76", "#8B6F47", "#C9A876", "#5A4530"];

export default function CutDiagram({
  board, index, count = 1, cutCount = 0, onCutChange, step = 1
}: {
  board: Board; index: number; count?: number;
  // How many boards get cut at once per tap (4 for standard parts, 1 for trim).
  step?: number;
  // How many of these boards are already cut, and the handler that makes the
  // diagram tappable. Without a handler it is a plain, read-only diagram.
  cutCount?: number; onCutChange?: (n: number) => void;
}) {
  const cut = Math.min(cutCount, count);
  const allDone = cut >= count;
  const nextBatch = Math.min(step, count - cut);
  // Undo steps back over the batch that was just tapped.
  const undoBy = cut % step === 0 ? step : cut % step;
  return (
    <div className={`mb-4 print:break-inside-avoid rounded-lg ${onCutChange && allDone ? "bg-sage/10 ring-1 ring-sage/40 p-2 -mx-2" : onCutChange ? "p-2 -mx-2" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-[#1E3A5F]">
          Board {index + 1}
          {count > 1 && (
            <span className="ml-2 inline-block bg-[#1E3A5F] text-white text-xs font-bold px-2 py-0.5 rounded-full align-middle">
              × {count} — cut this pattern {count} times
            </span>
          )}
        </span>
        <span className="text-xs text-[#1E3A5F]/50">
          Leftover: {board.leftover.toFixed(2)}{'"'} ({((board.leftover / board.boardLength) * 100).toFixed(1)}%) each
        </span>
      </div>
      <div className="relative h-10 bg-cream border border-[#1E3A5F]/20 rounded overflow-hidden flex">
        {board.pieces.map((piece, i) => {
          const widthPct = (piece.length / board.boardLength) * 100;
          return (
            <div
              key={i}
              style={{ width: `${widthPct}%`, backgroundColor: COLORS[i % COLORS.length] }}
              className="h-full border-r border-white/50 flex items-center justify-center relative flex-shrink-0"
              title={`${piece.partName} — ${piece.length}"`}
            >
              {widthPct > 6 && (
                <span className="text-[10px] font-semibold text-white truncate px-0.5">{piece.length}{'"'}</span>
              )}
            </div>
          );
        })}
        {board.leftover > 0.01 && (
          <div
            style={{ width: `${(board.leftover / board.boardLength) * 100}%` }}
            className="h-full bg-[#1E3A5F]/5 flex items-center justify-center flex-shrink-0"
          >
            {(board.leftover / board.boardLength) * 100 > 4 && (
              <span className="text-[9px] text-[#1E3A5F]/40">scrap</span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {board.pieces.map((piece, i) => (
          <span key={i} className="text-[11px] text-[#1E3A5F]/70">
            <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {piece.partName} ({piece.length}{'"'})
          </span>
        ))}
      </div>
      {onCutChange && (
        <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
          {allDone ? (
            // Finished: locked, nothing more to tap.
            <div className="min-h-[44px] px-4 rounded-md text-sm font-semibold bg-sage text-white inline-flex items-center">
              {count === 1 ? "✓ Cut" : `✓ All ${count} cut`}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onCutChange(cut + nextBatch)}
              className="min-h-[44px] px-4 rounded-md text-sm font-semibold border bg-white text-[#1E3A5F] border-[#1E3A5F]/30"
            >
              {count === 1
                ? "Tap when cut"
                : `${cut} of ${count} cut — tap after cutting ${nextBatch === 1 ? "1" : `${nextBatch}${nextBatch < step ? " (the last ones)" : ""}`}`}
            </button>
          )}
          {count > 1 && cut > 0 && !allDone && (
            <button type="button" onClick={() => onCutChange(Math.max(0, cut - undoBy))} className="min-h-[44px] px-3 rounded-md text-sm font-semibold border border-[#1E3A5F]/20 text-[#1E3A5F]/70">
              {undoBy === 1 ? "Undo one" : `Undo ${undoBy}`}
            </button>
          )}
        </div>
      )}
      {!onCutChange ? null : (
        <div className="hidden print:block text-xs text-[#1E3A5F]/60 mt-1">{allDone ? "✓ cut" : `Cut ${cut} of ${count}`}</div>
      )}
    </div>
  );
}
