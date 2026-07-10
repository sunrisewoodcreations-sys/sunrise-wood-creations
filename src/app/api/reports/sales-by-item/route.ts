import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    // Week starts Sunday.
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

  let query = admin
    .from("orders")
    .select("title, product_type, quantity, price_cents, product_id, products:product_id(name)")
    .lt("created_at", range.end.toISOString());

  if (range.start) {
    query = query.gte("created_at", range.start.toISOString());
  }

  const { data: orders, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Group by saved product name if linked, otherwise by the raw title typed in.
  const itemTotals: Record<string, { qty: number; revenueCents: number }> = {};
  (orders || []).forEach((o: any) => {
    const key = o.products?.name || o.title || "Untitled";
    if (!itemTotals[key]) itemTotals[key] = { qty: 0, revenueCents: 0 };
    itemTotals[key].qty += o.quantity || 1;
    itemTotals[key].revenueCents += o.price_cents || 0;
  });

  const rows = Object.entries(itemTotals)
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenueCents / 100 }))
    .sort((a, b) => b.revenue - a.revenue);

  const grandTotal = rows.reduce((sum, r) => sum + r.revenue, 0);
  const grandQty = rows.reduce((sum, r) => sum + r.qty, 0);

  // Build the PDF.
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const BLACK = rgb(0.1176, 0.2275, 0.3725);
  const WHITE = rgb(1, 1, 1);
  const GRAY = rgb(0.4, 0.4, 0.4);
  const LIGHT_LINE = rgb(0.85, 0.85, 0.85);

  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BLACK });
  page.drawText("Sunrise Wood Creations LLC", { x: 40, y: height - 45, size: 20, font: bold, color: WHITE });
  page.drawText("Sales by item report", { x: 40, y: height - 68, size: 12, font, color: WHITE });

  let y = height - 120;
  page.drawText(`Period: ${range.label}`, { x: 40, y, size: 12, font: bold, color: BLACK });
  y -= 30;

  const col = { name: 40, qty: 380, revenue: 470 };
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: LIGHT_LINE });
  page.drawText("Item", { x: col.name, y, size: 9, font: bold, color: BLACK });
  page.drawText("Qty sold", { x: col.qty, y, size: 9, font: bold, color: BLACK });
  page.drawText("Revenue", { x: col.revenue, y, size: 9, font: bold, color: BLACK });
  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: LIGHT_LINE });
  y -= 20;

  for (const row of rows) {
    if (y < 60) break; // simple single-page cap
    page.drawText(row.name.slice(0, 55), { x: col.name, y, size: 10, font, color: BLACK });
    page.drawText(String(row.qty), { x: col.qty, y, size: 10, font, color: BLACK });
    page.drawText(`$${row.revenue.toFixed(2)}`, { x: col.revenue, y, size: 10, font, color: BLACK });
    y -= 18;
  }

  y -= 10;
  page.drawLine({ start: { x: 300, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: BLACK });
  page.drawText("Total:", { x: 300, y, size: 11, font: bold, color: BLACK });
  page.drawText(String(grandQty), { x: col.qty, y, size: 11, font: bold, color: BLACK });
  page.drawText(`$${grandTotal.toFixed(2)}`, { x: col.revenue, y, size: 11, font: bold, color: BLACK });

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
