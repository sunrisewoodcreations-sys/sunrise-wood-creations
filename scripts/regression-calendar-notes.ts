process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy";
(async () => {
  const { adminCalendarNotes } = await import("../src/lib/pickupScheduling");
  const n = adminCalendarNotes([{ title: "Cedar planter 36x18", quantity: 2 }, { title: "Delivery fee", quantity: 1 }, { title: "Cornhole bags — Set of 8", quantity: 1 }], "x", "269-555-1212");
  const ok = n === "Picking up:\n• 2 × Cedar planter 36x18\n• Cornhole bags — Set of 8\n\nPhone: 269-555-1212";
  if (!ok) process.exitCode = 1;
  console.log(ok ? "ok   notes list the items (no delivery fee) and phone" : "FAIL notes: " + JSON.stringify(n));
  console.log(adminCalendarNotes([], "Michigan flag") === "Picking up:\n• Michigan flag" ? "ok   falls back to the order title" : "FAIL fallback");
})();
