// 1D cutting-stock optimizer — ported directly from the tested
// standalone prototype (Best-Fit-Decreasing bin-packing, kerf-aware,
// materials never mixed on the same board). Logic is unchanged from
// what was already tested; only the surrounding data source changed
// (real products/orders instead of sample data).

export type BOMPart = {
  partName: string;
  length: number;
  finalLength?: number;
  quantityPerUnit: number;
  materialType: string;
  isTrim: boolean;
};

export type CutPiece = {
  partName: string;
  length: number;
  finalLength?: number;
};

export type Board = {
  boardLength: number;
  pieces: CutPiece[];
  usedLength: number;
  leftover: number;
};

export type OptimizationResult = {
  materialType: string;
  boardLength: number;
  kerf: number;
  boards: Board[];
  totalBoards: number;
  totalWasteInches: number;
  wastePercent: number;
  oversizedParts: { partName: string; length: number }[];
};

export function optimizeCutList(parts: BOMPart[], materialType: string, boardLength: number, kerf: number): OptimizationResult {
  const pieces: CutPiece[] = [];
  const oversizedParts: { partName: string; length: number }[] = [];

  for (const part of parts) {
    if (part.length > boardLength) {
      oversizedParts.push({ partName: part.partName, length: part.length });
      continue;
    }
    for (let i = 0; i < part.quantityPerUnit; i++) {
      pieces.push({ partName: part.partName, length: part.length, finalLength: part.finalLength });
    }
  }

  pieces.sort((a, b) => b.length - a.length);

  const boards: Board[] = [];

  for (const piece of pieces) {
    const needed = piece.length + kerf;
    let bestBoardIndex = -1;
    let bestRemainingAfter = Infinity;

    boards.forEach((board, i) => {
      const remaining = board.boardLength - board.usedLength;
      if (remaining >= needed) {
        const remainingAfter = remaining - needed;
        if (remainingAfter < bestRemainingAfter) {
          bestRemainingAfter = remainingAfter;
          bestBoardIndex = i;
        }
      }
    });

    if (bestBoardIndex === -1) {
      boards.push({ boardLength, pieces: [piece], usedLength: needed, leftover: boardLength - needed });
    } else {
      const board = boards[bestBoardIndex];
      board.pieces.push(piece);
      board.usedLength += needed;
      board.leftover = board.boardLength - board.usedLength;
    }
  }

  const totalBoardLength = boards.length * boardLength;
  const totalWasteInches = boards.reduce((sum, b) => sum + b.leftover, 0);
  const wastePercent = totalBoardLength > 0 ? (totalWasteInches / totalBoardLength) * 100 : 0;

  return { materialType, boardLength, kerf, boards, totalBoards: boards.length, totalWasteInches, wastePercent, oversizedParts };
}

export function optimizeByMaterial(parts: BOMPart[], boardLength: number, kerf: number): OptimizationResult[] {
  const byMaterial = new Map<string, BOMPart[]>();
  for (const part of parts) {
    const list = byMaterial.get(part.materialType) || [];
    list.push(part);
    byMaterial.set(part.materialType, list);
  }
  return Array.from(byMaterial.entries()).map(([materialType, materialParts]) =>
    optimizeCutList(materialParts, materialType, boardLength, kerf)
  );
}

export function mergeParts(partLists: BOMPart[][]): BOMPart[] {
  const merged = new Map<string, BOMPart>();
  for (const parts of partLists) {
    for (const part of parts) {
      const key = `${part.materialType}:${part.isTrim}:${part.partName}:${part.length}:${part.finalLength ?? ""}`;
      const existing = merged.get(key);
      if (existing) {
        existing.quantityPerUnit += part.quantityPerUnit;
      } else {
        merged.set(key, { ...part });
      }
    }
  }
  return Array.from(merged.values());
}

// Groups boards with the exact same cut pattern so the UI can show one
// diagram with a "×N" badge instead of repeating an identical board.
export function groupIdenticalBoards(boards: Board[]): { board: Board; count: number }[] {
  const groups = new Map<string, { board: Board; count: number }>();
  for (const board of boards) {
    const signature = [...board.pieces].map(p => `${p.partName}:${p.length}`).sort().join("|");
    const existing = groups.get(signature);
    if (existing) existing.count += 1;
    else groups.set(signature, { board, count: 1 });
  }
  return Array.from(groups.values());
}
