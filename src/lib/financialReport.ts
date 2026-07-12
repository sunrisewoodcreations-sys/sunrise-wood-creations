import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFinancialReportEmail } from "@/lib/email";

const SALES_TAX_RATE = 0.06;
const NAVY = rgb(0.1176, 0.2275, 0.3725);
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.4, 0.4, 0.4);
const EMBER = rgb(0.85, 0.376, 0.227);
const GREEN = rgb(0.22, 0.5, 0.34);
const LIGHT_LINE = rgb(0.85, 0.85, 0.85);

function easternMidnightUtc(year: number, month: number, day: number): Date {
  for (const offsetHours of [4, 5]) {
    const guess = new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false
    }).formatToParts(guess);
    const y = Number(parts.find(p => p.type === "year")?.value);
    const m = Number(parts.find(p => p.type === "month")?.value);
    const d = Number(parts.find(p => p.type === "day")?.value);
    const h = Number(parts.find(p => p.type === "hour")?.value) % 24;
    if (y === year && m === month && d === day && h === 0) return guess;
  }
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

function easternDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", weekday: "short"
  }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value),
    day: Number(parts.find(p => p.type === "day")?.value),
    weekday: parts.find(p => p.type === "weekday")?.value || ""
  };
}

// Pure calendar-date arithmetic (no timezone/clock involved) — safe to
// shift by whole days without worrying about daylight saving edge cases.
function shiftDate(year: number, month: number, day: number, deltaDays: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type Frequency = "off" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export function shouldSendToday(frequency: Frequency, now: Date): boolean {
  const { day, month, weekday } = easternDateParts(now);
  switch (frequency) {
    case "off": return false;
    case "daily": return true;
    case "weekly": return weekday === "Mon";
    case "monthly": return day === 1;
    case "quarterly": return day === 1 && [1, 4, 7, 10].includes(month);
    case "yearly": return day === 1 && month === 1;
    default: return false;
  }
}

export function getPreviousPeriod(frequency: Frequency, now: Date): { start: Date; end: Date; label: string; endDateString: string } {
  const { year, month, day } = easternDateParts(now);
  const todayMidnight = easternMidnightUtc(year, month, day);

  if (frequency === "daily") {
    const y = shiftDate(year, month, day, -1);
    return {
      start: easternMidnightUtc(y.year, y.month, y.day),
      end: todayMidnight,
      label: new Date(Date.UTC(y.year, y.month - 1, y.day)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
      endDateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    };
  }

  if (frequency === "weekly") {
    const weekAgo = shiftDate(year, month, day, -7);
    const lastDay = shiftDate(year, month, day, -1);
    const startLabel = new Date(Date.UTC(weekAgo.year, weekAgo.month - 1, weekAgo.day)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const endLabel = new Date(Date.UTC(lastDay.year, lastDay.month - 1, lastDay.day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    return {
      start: easternMidnightUtc(weekAgo.year, weekAgo.month, weekAgo.day),
      end: todayMidnight,
      label: `Week of ${startLabel} – ${endLabel}`,
      endDateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    };
  }

  if (frequency === "monthly") {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return {
      start: easternMidnightUtc(prevYear, prevMonth, 1),
      end: todayMidnight,
      label: `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`,
      endDateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    };
  }

  if (frequency === "quarterly") {
    const currentQStart = month; // month is guaranteed 1,4,7,10 when this runs
    const q = Math.floor((currentQStart - 1) / 3); // 0-3, the quarter that's ENDING
    let prevQ = q - 1, prevY = year;
    if (prevQ < 0) { prevQ = 3; prevY -= 1; }
    return {
      start: easternMidnightUtc(prevY, prevQ * 3 + 1, 1),
      end: todayMidnight,
      label: `Q${prevQ + 1} ${prevY}`,
      endDateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    };
  }

  // yearly
  return {
    start: easternMidnightUtc(year - 1, 1, 1),
    end: todayMidnight,
    label: String(year - 1),
    endDateString: `${year}-01-01`
  };
}

async function buildFinancialReportPdf(opts: {
  periodLabel: string;
  rows: { name: string; qty: number; revenue: number; cost: number; profit: number }[];
  totalRevenue: number;
  totalCost: number;
  totalMaterialsCost: number;
  totalProfit: number;
  salesTaxOwed: number;
  michiganIncomeTaxOwed: number;
  michiganPercent: number;
  federalIncomeTaxOwed: number;
  federalPercent: number;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: NAVY });
  page.drawText("Sunrise Wood Creations LLC", { x: 40, y: height - 45, size: 20, font: bold, color: WHITE });
  page.drawText("Financial summary", { x: 40, y: height - 68, size: 12, font, color: WHITE });

  let y = height - 120;
  page.drawText(`Period: ${opts.periodLabel}`, { x: 40, y, size: 12, font: bold, color: NAVY });
  y -= 30;

  const col = { name: 40, qty: 300, revenue: 380, cost: 450, profit: 520 };
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: LIGHT_LINE });
  page.drawText("Item", { x: col.name, y, size: 9, font: bold, color: NAVY });
  page.drawText("Qty", { x: col.qty, y, size: 9, font: bold, color: NAVY });
  page.drawText("Revenue", { x: col.revenue, y, size: 9, font: bold, color: NAVY });
  page.drawText("Cost", { x: col.cost, y, size: 9, font: bold, color: NAVY });
  page.drawText("Profit", { x: col.profit, y, size: 9, font: bold, color: NAVY });
  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: LIGHT_LINE });
  y -= 18;

  for (const row of opts.rows) {
    if (y < 220) break; // single-page cap; long histories should use the Reports tab instead
    page.drawText(row.name.slice(0, 40), { x: col.name, y, size: 9, font, color: NAVY });
    page.drawText(String(row.qty), { x: col.qty, y, size: 9, font, color: NAVY });
    page.drawText(`$${row.revenue.toFixed(2)}`, { x: col.revenue, y, size: 9, font, color: NAVY });
    page.drawText(`$${row.cost.toFixed(2)}`, { x: col.cost, y, size: 9, font, color: NAVY });
    page.drawText(`$${row.profit.toFixed(2)}`, { x: col.profit, y, size: 9, font, color: row.profit >= 0 ? GREEN : EMBER });
    y -= 16;
  }

  y -= 20;
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: NAVY });

  function summaryRow(label: string, value: string, yy: number, color?: ReturnType<typeof rgb>) {
    page.drawText(label, { x: 40, y: yy, size: 11, font: bold, color: NAVY });
    page.drawText(value, { x: 300, y: yy, size: 11, font: bold, color: color || NAVY });
  }
  summaryRow("Total sales:", `$${opts.totalRevenue.toFixed(2)}`, y); y -= 20;
  summaryRow("Total cost:", `$${opts.totalCost.toFixed(2)}`, y); y -= 20;
  summaryRow("  of which materials (planters):", `$${opts.totalMaterialsCost.toFixed(2)}`, y); y -= 20;
  summaryRow("Profit:", `$${opts.totalProfit.toFixed(2)}`, y, opts.totalProfit >= 0 ? GREEN : EMBER); y -= 20;
  summaryRow("Sales tax owed (6% MI):", `$${opts.salesTaxOwed.toFixed(2)}`, y, EMBER); y -= 20;
  summaryRow(`Michigan income tax (${opts.michiganPercent}%):`, `$${opts.michiganIncomeTaxOwed.toFixed(2)}`, y, EMBER); y -= 20;
  summaryRow(`Federal income tax set-aside (${opts.federalPercent}%):`, `$${opts.federalIncomeTaxOwed.toFixed(2)}`, y, EMBER); y -= 34;

  page.drawText("Sales tax and Michigan income tax use real statutory rates. Federal income tax is a", { x: 40, y, size: 9, font, color: GRAY }); y -= 12;
  page.drawText("planning estimate you control in Report Settings, since it depends on your total income and", { x: 40, y, size: 9, font, color: GRAY }); y -= 12;
  page.drawText("filing status. Profit only reflects items with a cost entered. Confirm exact amounts with your tax preparer.", { x: 40, y, size: 9, font, color: GRAY });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function generateAndSendFinancialReport(frequency: Frequency, now: Date): Promise<{ sent: boolean; reason?: string }> {
  const admin = createAdminClient();

  const { data: settings } = await admin.from("report_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings) return { sent: false, reason: "No report_settings row found." };

  const period = getPreviousPeriod(frequency, now);

  if (settings.last_sent_period_end === period.endDateString) {
    return { sent: false, reason: "Already sent for this period." };
  }

  // Only count orders that have actually been picked up — and bucket them
  // by the date they were picked up, not the date they were placed. An
  // order placed last month but picked up this month belongs in this
  // period's report, not last period's.
  const { data: pickupEvents } = await admin
    .from("order_status_history")
    .select("order_id, created_at")
    .eq("status", "picked_up")
    .gte("created_at", period.start.toISOString())
    .lt("created_at", period.end.toISOString())
    .order("created_at", { ascending: true });

  // Dedupe in case an order somehow got marked picked_up more than once —
  // only count it the first time within this period.
  const pickedUpOrderIds: string[] = [];
  const seenOrderIds = new Set<string>();
  (pickupEvents || []).forEach((ev: any) => {
    if (!seenOrderIds.has(ev.order_id)) {
      seenOrderIds.add(ev.order_id);
      pickedUpOrderIds.push(ev.order_id);
    }
  });

  const { data: ordersInRange } = pickedUpOrderIds.length > 0
    ? await admin
        .from("orders")
        .select("id, title, quantity, price_cents, product_id, material_cost_cents, products:product_id(name, cost_cents)")
        .in("id", pickedUpOrderIds)
    : { data: [] as any[] };

  const orderIds = (ordersInRange || []).map((o: any) => o.id);

  const { data: itemRows } = orderIds.length > 0
    ? await admin
        .from("order_items")
        .select("order_id, title, quantity, unit_price_cents, product_id, products:product_id(name, cost_cents)")
        .in("order_id", orderIds)
    : { data: [] as any[] };

  const orderIdsWithItems = new Set((itemRows || []).map((it: any) => it.order_id));

  // Real picket-based material cost per order, when it's been logged —
  // this takes priority over the flat product cost for that order's items.
  const materialCostByOrder: Record<string, number> = {};
  (ordersInRange || []).forEach((o: any) => {
    if (o.material_cost_cents != null) materialCostByOrder[o.id] = o.material_cost_cents;
  });
  const totalMaterialsCostCents = Object.values(materialCostByOrder).reduce((s, c) => s + c, 0);
  // Tracks which orders' material cost has already been counted, so it's
  // only applied once even if an order has multiple order_items rows.
  const materialCostAlreadyApplied = new Set<string>();

  const totals: Record<string, { qty: number; revenueCents: number; costCents: number }> = {};

  (itemRows || []).forEach((it: any) => {
    const key = it.products?.name || it.title || "Untitled";
    if (!totals[key]) totals[key] = { qty: 0, revenueCents: 0, costCents: 0 };
    totals[key].qty += it.quantity || 1;
    totals[key].revenueCents += (it.unit_price_cents || 0) * (it.quantity || 1);

    const orderMaterialCost = materialCostByOrder[it.order_id];
    if (orderMaterialCost != null) {
      if (!materialCostAlreadyApplied.has(it.order_id)) {
        totals[key].costCents += orderMaterialCost;
        materialCostAlreadyApplied.add(it.order_id);
      }
    } else {
      totals[key].costCents += (it.products?.cost_cents || 0) * (it.quantity || 1);
    }
  });

  (ordersInRange || []).forEach((o: any) => {
    if (orderIdsWithItems.has(o.id)) return;
    const key = o.products?.name || o.title || "Untitled";
    if (!totals[key]) totals[key] = { qty: 0, revenueCents: 0, costCents: 0 };
    totals[key].qty += o.quantity || 1;
    totals[key].revenueCents += o.price_cents || 0;

    if (o.material_cost_cents != null) {
      totals[key].costCents += o.material_cost_cents;
    } else {
      totals[key].costCents += (o.products?.cost_cents || 0) * (o.quantity || 1);
    }
  });

  const rows = Object.entries(totals)
    .map(([name, v]) => ({
      name,
      qty: v.qty,
      revenue: v.revenueCents / 100,
      cost: v.costCents / 100,
      profit: (v.revenueCents - v.costCents) / 100
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMaterialsCost = totalMaterialsCostCents / 100;
  const salesTaxOwed = totalRevenue - totalRevenue / (1 + SALES_TAX_RATE);
  const michiganPercent = Number(settings.michigan_income_tax_percent) || 4.25;
  const federalPercent = Number(settings.federal_income_tax_percent) || 15.3;
  const michiganIncomeTaxOwed = totalProfit > 0 ? totalProfit * (michiganPercent / 100) : 0;
  const federalIncomeTaxOwed = totalProfit > 0 ? totalProfit * (federalPercent / 100) : 0;

  const pdfBuffer = await buildFinancialReportPdf({
    periodLabel: period.label,
    rows,
    totalRevenue,
    totalCost,
    totalMaterialsCost,
    totalProfit,
    salesTaxOwed,
    michiganIncomeTaxOwed,
    michiganPercent,
    federalIncomeTaxOwed,
    federalPercent
  });

  await sendFinancialReportEmail({
    toEmail: settings.recipient_email,
    periodLabel: period.label,
    totalRevenue,
    totalMaterialsCost,
    totalProfit,
    salesTaxOwed,
    michiganIncomeTaxOwed,
    federalIncomeTaxOwed,
    pdfBuffer
  });

  await admin.from("report_settings").update({ last_sent_period_end: period.endDateString }).eq("id", 1);

  return { sent: true };
}
