process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy";
const sent: any[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  if (new URL(url).host !== "api.resend.com") throw new Error("blocked " + url);
  sent.push(JSON.parse(init?.body ?? "{}"));
  return new Response(JSON.stringify({ id: "x" }), { status: 200, headers: { "content-type": "application/json" } });
}) as any;

(async () => {
  const { sendPickupScheduledAdminAlert, sendPickupConfirmationEmail } = await import("../src/lib/email");
  const { appointmentIcs } = await import("../src/lib/calendarLinks");
  let bad = 0;
  const t = (ok: boolean, m: string) => { if (!ok) { bad++; console.log("FAIL", m); } else console.log("ok  ", m); };
  const ics = appointmentIcs({ title: "Pickup: Flag", description: "Pat · 555", location: "Lawrence, MI", dateStr: "2026-11-17", timeStr: "14:00", durationMinutes: 30 });
  t(ics.startsWith("BEGIN:VCALENDAR") && ics.includes("DTSTART:20261117T190000Z") && ics.includes("SUMMARY:Pickup: Flag"), "ics has the right start (2pm Eastern = 19:00Z) and title");

  await sendPickupScheduledAdminAlert({ orderTitle: "Flag", customerName: "Pat", appointmentDateDisplay: "Tue", appointmentTimeDisplay: "2:00 PM", calendarIcs: ics, isReschedule: false, forceDemo: false });
  const a = sent[0];
  t(a.attachments?.[0]?.filename === "appointment.ics" && Buffer.from(a.attachments[0].content, "base64").toString().includes("BEGIN:VCALENDAR"), "admin alert attaches the .ics");
  t(!a.html.includes("Google Calendar") && a.html.includes("Apple Calendar"), "admin alert no longer offers Google, mentions Apple Calendar");

  await sendPickupConfirmationEmail({ toEmail: "c@e.com", customerName: "Pat", orderTitle: "Flag", appointmentDateDisplay: "Tue", appointmentTimeDisplay: "2:00 PM", businessAddress: "x", pickupInstructions: "y", contactPhone: "1", rescheduleUrl: "https://e.com", googleCalendarUrl: "https://g", outlookCalendarUrl: "https://o", appleCalendarUrl: "data:x", calendarIcs: ics, isReschedule: false, forceDemo: false });
  t(sent[1].attachments?.[0]?.filename === "appointment.ics", "customer confirmation attaches the .ics too");
  process.exit(bad ? 1 : 0);
})();
