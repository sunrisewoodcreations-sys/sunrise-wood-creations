import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SALES_TAX_RATE = 0.06; // Michigan

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
    timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value),
    day: Number(parts.find(p => p.type === "day")?.value)
  };
}

function getDateRange(period: string, now: Date): { start: Date | null; end: Date; label: string } {
  const { year, month, day } = easternDateParts(now);

  if (period === "today") {
    const start = easternMidnightUtc(year, month, day);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end, label: `Today (${month}/${day}/${year})` };
  }

  if (period === "this_week") {
    const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" });
    const weekdayShort = weekdayFormatter.format(now);
    const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayShort);
    const startOfWeekUtc = new Date(easternMidnightUtc(year, month, day).getTime() - weekdayIndex * 24 * 60 * 60 * 1000);
    const end = new Date(startOfWeekUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start: startOfWeekUtc, end, label: "This week" };
  }

  if (period === "this_month") {
    const start = easternMidnightUtc(year, month, 1);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return { start, end: easternMidnightUtc(nextYear, nextMonth, 1), label: `${year}-${String(month).padStart(2, "0")}` };
  }

  if (period === "this_quarter") {
    const quarter = Math.floor((month - 1) / 3);
    const start = easternMidnightUtc(year, quarter * 3 + 1, 1);
    let endQ = quarter + 1, endY = year;
    if (endQ > 3) { endQ = 0; endY += 1; }
    return { start, end: easternMidnightUtc(endY, endQ * 3 + 1, 1), label: `Q${quarter + 1} ${year}` };
  }

  if (period === "this_year") {
    return { start: easternMidnightUtc(year, 1, 1), end: easternMidnightUtc(year + 1, 1, 1), label: String(year) };
  }

  if (period === "lifetime") {
    return { start: null, end: new Date(8640000000000000), label: "Lifetime" };
  }

  throw new Error("Unknown period");
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") || "this_month";
  let range;
  try {
    range = getDateRange(period, new Date());
  } catch {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: settings } = await admin.from("report_settings").select("*").eq("id", 1).maybeSingle();
  const michiganPercent = Number(settings?.michigan_income_tax_percent) || 4.25;
  const federalPercent = Number(settings?.federal_income_tax_percent) || 15.3;

  let pickupQuery = admin
    .from("order_status_history")
    .select("order_id, created_at")
    .eq("status", "picked_up")
    .lt("created_at", range.end.toISOString());
  if (range.start) pickupQuery = pickupQuery.gte("created_at", range.start.toISOString());

  const { data: pickupEvents, error: pickupError } = await pickupQuery;
  if (pickupError) {
    return NextResponse.json({ error: pickupError.message }, { status: 400 });
  }

  const pickedUpOrderIds: string[] = [];
  const seenOrderIds = new Set<string>();
  (pickupEvents || []).forEach((ev: any) => {
    if (!seenOrderIds.has(ev.order_id)) {
      seenOrderIds.add(ev.order_id);
      pickedUpOrderIds.push(ev.order_id);
    }
  });

  const { data: ordersInRange, error: ordersError } = pickedUpOrderIds.length > 0
    ? await admin
        .from("orders")
        .select("id, title, product_type, quantity, price_cents, product_id, material_cost_cents, created_at, products:product_id(name, cost_cents)")
        .in("id", pickedUpOrderIds)
    : { data: [] as any[], error: null };
  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 400 });
  }

  const orderIds = (ordersInRange || []).map((o: any) => o.id);

  const { data: itemRows } = orderIds.length > 0
    ? await admin
        .from("order_items")
        .select("order_id, title, quantity, unit_price_cents, product_id, material_cost_cents, products:product_id(name, cost_cents)")
        .in("order_id", orderIds)
    : { data: [] as any[] };

  const orderIdsWithItems = new Set((itemRows || []).map((it: any) => it.order_id));

  const itemTotals: Record<string, { qty: number; revenueCents: number; costCents: number }> = {};

  (itemRows || []).forEach((it: any) => {
    const key = it.products?.name || it.title || "Untitled";
    if (!itemTotals[key]) itemTotals[key] = { qty: 0, revenueCents: 0, costCents: 0 };
    itemTotals[key].qty += it.quantity || 1;
    itemTotals[key].revenueCents += (it.unit_price_cents || 0) * (it.quantity || 1);

    if (it.material_cost_cents != null) {
      itemTotals[key].costCents += it.material_cost_cents;
    } else {
      itemTotals[key].costCents += (it.products?.cost_cents || 0) * (it.quantity || 1);
    }
  });

  (ordersInRange || []).forEach((o: any) => {
    if (orderIdsWithItems.has(o.id)) return;
    const key = o.products?.name || o.title || "Untitled";
    if (!itemTotals[key]) itemTotals[key] = { qty: 0, revenueCents: 0, costCents: 0 };
    itemTotals[key].qty += o.quantity || 1;
    itemTotals[key].revenueCents += o.price_cents || 0;

    if (o.material_cost_cents != null) {
      itemTotals[key].costCents += o.material_cost_cents;
    } else {
      itemTotals[key].costCents += (o.products?.cost_cents || 0) * (o.quantity || 1);
    }
  });

  const rows = Object.entries(itemTotals)
    .map(([name, v]) => ({
      name,
      qty: v.qty,
      revenue: v.revenueCents / 100,
      cost: v.costCents / 100,
      profit: (v.revenueCents - v.costCents) / 100
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const grandRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const grandCost = rows.reduce((sum, r) => sum + r.cost, 0);
  const grandProfit = grandRevenue - grandCost;
  const grandQty = rows.reduce((sum, r) => sum + r.qty, 0);

  const salesTaxOwed = grandRevenue - grandRevenue / (1 + SALES_TAX_RATE);
  const michiganIncomeTaxOwed = grandProfit > 0 ? grandProfit * (michiganPercent / 100) : 0;
  const federalIncomeTaxOwed = grandProfit > 0 ? grandProfit * (federalPercent / 100) : 0;

  // Build the PDF.
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const NAVY = rgb(0.1176, 0.2275, 0.3725);
  const WHITE = rgb(1, 1, 1);
  const GRAY = rgb(0.4, 0.4, 0.4);
  const EMBER = rgb(0.85, 0.376, 0.227);
  const GREEN = rgb(0.22, 0.5, 0.34);
  const LIGHT_LINE = rgb(0.85, 0.85, 0.85);

  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: NAVY });
  page.drawText("Sunrise Wood Creations LLC", { x: 40, y: height - 45, size: 20, font: bold, color: WHITE });
  page.drawText("Sales by item report", { x: 40, y: height - 68, size: 12, font, color: WHITE });

  let y = height - 120;
  page.drawText(`Period: ${range.label}`, { x: 40, y, size: 12, font: bold, color: NAVY });
  y -= 30;

  const col = { name: 40, qty: 280, revenue: 340, cost: 420, profit: 500 };
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: LIGHT_LINE });
  page.drawText("Item", { x: col.name, y, size: 9, font: bold, color: NAVY });
  page.drawText("Qty", { x: col.qty, y, size: 9, font: bold, color: NAVY });
  page.drawText("Revenue", { x: col.revenue, y, size: 9, font: bold, color: NAVY });
  page.drawText("Cost", { x: col.cost, y, size: 9, font: bold, color: NAVY });
  page.drawText("Profit", { x: col.profit, y, size: 9, font: bold, color: NAVY });
  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: LIGHT_LINE });
  y -= 20;

  for (const row of rows) {
    if (y < 220) break; // single-page cap, leaves room for the tax summary below
    page.drawText(row.name.slice(0, 38), { x: col.name, y, size: 9, font, color: NAVY });
    page.drawText(String(row.qty), { x: col.qty, y, size: 9, font, color: NAVY });
    page.drawText(`$${row.revenue.toFixed(2)}`, { x: col.revenue, y, size: 9, font, color: NAVY });
    page.drawText(`$${row.cost.toFixed(2)}`, { x: col.cost, y, size: 9, font, color: NAVY });
    page.drawText(`$${row.profit.toFixed(2)}`, { x: col.profit, y, size: 9, font, color: row.profit >= 0 ? GREEN : EMBER });
    y -= 16;
  }

  y -= 10;
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: NAVY });

  function summaryRow(label: string, value: string, yy: number, color?: ReturnType<typeof rgb>) {
    page.drawText(label, { x: 40, y: yy, size: 10, font: bold, color: NAVY });
    page.drawText(value, { x: col.profit, y: yy, size: 10, font: bold, color: color || NAVY });
  }
  summaryRow("Total revenue:", `$${grandRevenue.toFixed(2)}`, y); y -= 18;
  summaryRow("Total cost:", `$${grandCost.toFixed(2)}`, y); y -= 18;
  summaryRow("Profit:", `$${grandProfit.toFixed(2)}`, y, grandProfit >= 0 ? GREEN : EMBER); y -= 22;
  summaryRow("Sales tax owed (6% MI):", `$${salesTaxOwed.toFixed(2)}`, y, EMBER); y -= 18;
  summaryRow(`Michigan income tax (${michiganPercent}%):`, `$${michiganIncomeTaxOwed.toFixed(2)}`, y, EMBER); y -= 18;
  summaryRow(`Federal income tax set-aside (${federalPercent}%):`, `$${federalIncomeTaxOwed.toFixed(2)}`, y, EMBER); y -= 32;

  page.drawText(`Total items sold: ${grandQty}`, { x: 40, y, size: 9, font, color: GRAY }); y -= 24;
  page.drawText("Sales tax and Michigan income tax use real statutory rates. Federal income tax is a", { x: 40, y, size: 8, font, color: GRAY }); y -= 11;
  page.drawText("planning estimate you control in Report Settings. Cost only reflects items with a cost", { x: 40, y, size: 8, font, color: GRAY }); y -= 11;
  page.drawText("entered in Products, or picket usage logged on planter orders. Confirm exact amounts with your tax preparer.", { x: 40, y, size: 8, font, color: GRAY });

  if (rows.length === 0) {
    page.drawText("No sales found for this period.", { x: 40, y: height - 160, size: 11, font, color: GRAY });
  }

  const bytes = await doc.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sales-by-item-${period}.pdf"`
    }
  });
}
