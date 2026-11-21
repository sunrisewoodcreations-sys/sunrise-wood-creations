import { applyDesignDecision } from "../src/lib/proofDecisions";
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + ": " + JSON.stringify(a)); };

// single image behaves as before
let r = applyDesignDecision({}, 1, "approved", "");
eq(r.final, "approved", "single approve"); eq(r.patch.status, "approved", "single status");
r = applyDesignDecision({}, 1, "changes_requested", "bigger logo");
eq(r.final, "changes_requested", "single changes"); eq(r.combinedFeedback, "bigger logo", "single fb");

// two images: first answer does not finish the proof
const two = { image_url_2: "x" };
r = applyDesignDecision(two, 1, "approved", "");
eq(r.final, null, "partial"); eq(r.patch.status, undefined, "no status yet");
// then approve both -> approved
r = applyDesignDecision({ ...two, design1_decision: "approved" }, 2, "approved", "");
eq(r.final, "approved", "both approved");
// approve 1, change 2 -> changes_requested with labelled feedback
r = applyDesignDecision({ ...two, design1_decision: "approved" }, 2, "changes_requested", "make it red");
eq(r.final, "changes_requested", "mixed");
if (!r.combinedFeedback!.includes("Design 1: approved") || !r.combinedFeedback!.includes("Design 2: changes requested — make it red")) throw new Error("fb text");
// answering design 2 first works too
r = applyDesignDecision(two, 2, "approved", "");
eq(r.final, null, "order independent");
console.log("proof decisions ok");
