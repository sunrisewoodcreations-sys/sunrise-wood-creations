import assert from "node:assert/strict";
import { boardGroupKey, groupIdenticalBoards, optimizeByMaterial } from "../src/lib/cutlistOptimizer";
const parts = [{ partName: "Side", length: 21.5, quantityPerUnit: 12, materialType: "Cedar", isTrim: false }] as any;
const res = optimizeByMaterial(parts, 71, 0.125)[0];
const g = groupIdenticalBoards(res.boards);
const k1 = boardGroupKey(false, res.materialType, g[0].board);
assert.equal(k1, boardGroupKey(false, "Cedar", { ...g[0].board, pieces: [...g[0].board.pieces].reverse() }));
assert.notEqual(k1, boardGroupKey(true, "Cedar", g[0].board));
console.log("PASS cut progress keys are stable and separate standard from trim");
