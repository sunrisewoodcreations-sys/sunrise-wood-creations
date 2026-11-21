export type ProofDecision = "approved" | "changes_requested";

export type ProofRowForDecision = {
  image_url_2?: string | null;
  design1_decision?: string | null;
  design1_feedback?: string | null;
  design2_decision?: string | null;
  design2_feedback?: string | null;
};

// Works out what to store when the customer answers ONE design of a proof.
// A proof stays "pending" until every design on it has an answer; then it
// becomes "approved" only if every design was approved, otherwise
// "changes_requested" (with each design's feedback labelled).
// A single-image proof behaves exactly as before.
export function applyDesignDecision(
  proof: ProofRowForDecision,
  design: 1 | 2,
  decision: ProofDecision,
  feedback: string
): { patch: Record<string, any>; final: ProofDecision | null; combinedFeedback: string | null } {
  const two = !!proof.image_url_2;
  const fb = feedback?.trim() || null;
  const d1 = design === 1 ? decision : (proof.design1_decision as ProofDecision | null);
  const d2 = design === 2 ? decision : (proof.design2_decision as ProofDecision | null);
  const f1 = design === 1 ? fb : proof.design1_feedback || null;
  const f2 = design === 2 ? fb : proof.design2_feedback || null;

  const patch: Record<string, any> = design === 1
    ? { design1_decision: decision, design1_feedback: fb }
    : { design2_decision: decision, design2_feedback: fb };

  const decisions = two ? [d1, d2] : [d1];
  if (decisions.some(d => !d)) return { patch, final: null, combinedFeedback: null };

  const final: ProofDecision = decisions.every(d => d === "approved") ? "approved" : "changes_requested";
  let combined: string | null;
  if (!two) {
    combined = f1;
  } else {
    const line = (n: number, d: string | null, f: string | null) =>
      `Design ${n}: ${d === "approved" ? "approved" : "changes requested"}${f ? ` — ${f}` : ""}`;
    combined = `${line(1, d1!, f1)}\n${line(2, d2!, f2)}`;
  }
  patch.status = final;
  patch.feedback = combined;
  patch.responded_at = new Date().toISOString();
  return { patch, final, combinedFeedback: combined };
}
