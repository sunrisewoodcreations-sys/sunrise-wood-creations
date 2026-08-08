import { Board } from "@/lib/cutlistOptimizer";

const COLORS = ["#1E3A5F", "#D9603A", "#7A9B76", "#8B6F47", "#C9A876", "#5A4530"];

export default function CutDiagram({ board, index, count = 1 }: { board: Board; index: number; count?: number }) {
  return (
    <div className="mb-4 print:break-inside-avoid">
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
    </div>
  );
}
