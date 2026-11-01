import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compareBySize, lastYearRange, type ItemSale } from "@/lib/planterComparison";

export const dynamic = "force-dynamic";

const etDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const pretty = (s: string) => { const [y, m, d] = s.split("-"); return `${Number(m)}/${Number(d)}/${y}`; };
const money = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;
const signed = (c: number) => `${c > 0 ? "+" : c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!isDate(start) || !isDate(end) || start > end) {
    return NextResponse.json({ error: "Pick a start date and an end date (start must be before end)." }, { status: 400 });
  }
  const range = { start, end };
  const prevRange = lastYearRange(range);

  const admin = createAdminClient();
  const [{ data: pickups }, { data: orders }, { data: items }] = await Promise.all([
    admin.from("order_status_history").select("order_id, created_at").eq("status", "picked_up"),
    admin.from("orders").select("id, title, quantity, price_cents, products:product_id(name)").eq("is_demo", false),
    admin.from("order_items").select("order_id, title, quantity, unit_price_cents, products:product_id(name)")
  ]);

  const itemsByOrder = new Map<string, any[]>();
  (items || []).forEach((it: any) => {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id)!.push(it);
  });
  const orderById = new Map<string, any>((orders || []).map((o: any) => [o.id, o]));

  // Counted when the order was picked up / delivered, same rule as the Reports page.
  const sales: ItemSale[] = [];
  const seen = new Set<string>();
  (pickups || []).forEach((ev: any) => {
    const o = orderById.get(ev.order_id);
    if (!o || seen.has(ev.order_id)) return;
    seen.add(ev.order_id);
    const date = etDate(ev.created_at);
    const its = itemsByOrder.get(o.id);
    if (its && its.length > 0) {
      its.forEach((it: any) => sales.push({
        date, name: it.products?.name || it.title || "Untitled",
        qty: it.quantity || 1, revenueCents: (it.unit_price_cents || 0) * (it.quantity || 1)
      }));
    } else {
      sales.push({ date, name: o.products?.name || o.title || "Untitled", qty: o.quantity || 1, revenueCents: o.price_cents || 0 });
    }
  });

  const rows = compareBySize(sales, range);
  const tot = rows.reduce((a, r) => ({
    thisQty: a.thisQty + r.thisQty, lastQty: a.lastQty + r.lastQty,
    thisCents: a.thisCents + r.thisCents, lastCents: a.lastCents + r.lastCents
  }), { thisQty: 0, lastQty: 0, thisCents: 0, lastCents: 0 });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const NAVY = rgb(0.1176, 0.2275, 0.3725), WHITE = rgb(1, 1, 1), GRAY = rgb(0.4, 0.4, 0.4);
  const EMBER = rgb(0.85, 0.376, 0.227), GREEN = rgb(0.22, 0.5, 0.34), LINE = rgb(0.85, 0.85, 0.85);
  const W = 612, H = 792;
  // Right edges for the numeric columns.
  const c = { name: 40, tq: 255, lq: 305, dq: 350, ts: 420, ls: 490, ds: 572 };
  const right = (p: any, t: string, x: number, y: number, size = 9, f = font, color = NAVY) =>
    p.drawText(t, { x: x - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  const colorFor = (n: number) => (n > 0 ? GREEN : n < 0 ? EMBER : NAVY);
  const fit = (t: string, max: number, size: number) => {
    if (font.widthOfTextAtSize(t, size) <= max) return t;
    while (t.length > 3 && font.widthOfTextAtSize(t + "...", size) > max) t = t.slice(0, -1);
    return t.trimEnd() + "...";
  };

  let page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: NAVY });
  page.drawText("Sunrise Wood Creations LLC", { x: 40, y: H - 45, size: 20, font: bold, color: WHITE });
  page.drawText("Sales by size: this year vs last year", { x: 40, y: H - 68, size: 12, font, color: WHITE });
  let y = H - 120;
  page.drawText(`This year: ${pretty(range.start)} to ${pretty(range.end)}`, { x: 40, y, size: 11, font: bold, color: NAVY }); y -= 16;
  page.drawText(`Last year: ${pretty(prevRange.start)} to ${pretty(prevRange.end)}`, { x: 40, y, size: 11, font, color: GRAY }); y -= 30;

  const header = (p: any, yy: number) => {
    p.drawLine({ start: { x: 40, y: yy + 14 }, end: { x: W - 40, y: yy + 14 }, thickness: 1, color: LINE });
    p.drawText("Size / item", { x: c.name, y: yy, size: 9, font: bold, color: NAVY });
    right(p, "Sold", c.tq, yy, 9, bold); right(p, "Last yr", c.lq, yy, 9, bold); right(p, "+/-", c.dq, yy, 9, bold);
    right(p, "Sales", c.ts, yy, 9, bold); right(p, "Last yr", c.ls, yy, 9, bold); right(p, "Up / down", c.ds, yy, 9, bold);
  };
  header(page, y); y -= 20;

  if (rows.length === 0) {
    page.drawText("No sales found for either period.", { x: 40, y, size: 11, font, color: GRAY });
  }
  for (const r of rows) {
    if (y < 80) { page = doc.addPage([W, H]); y = H - 60; header(page, y); y -= 20; }
    page.drawText(fit(r.name, 170, 9), { x: c.name, y, size: 9, font, color: NAVY });
    right(page, String(r.thisQty), c.tq, y); right(page, String(r.lastQty), c.lq, y);
    right(page, `${r.qtyDiff > 0 ? "+" : ""}${r.qtyDiff}`, c.dq, y, 9, font, colorFor(r.qtyDiff));
    right(page, money(r.thisCents), c.ts, y); right(page, money(r.lastCents), c.ls, y);
    const pctTxt = r.pct === null ? (r.thisCents > 0 ? "new" : "") : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(0)}%`;
    right(page, `${signed(r.centsDiff)} ${pctTxt}`.trim(), c.ds, y, 9, font, colorFor(r.centsDiff));
    y -= 16;
  }

  if (rows.length > 0) {
    if (y < 110) { page = doc.addPage([W, H]); y = H - 60; }
    y -= 4;
    page.drawLine({ start: { x: 40, y: y + 12 }, end: { x: W - 40, y: y + 12 }, thickness: 1, color: LINE });
    const diff = tot.thisCents - tot.lastCents;
    const pct = tot.lastCents > 0 ? `${diff > 0 ? "+" : ""}${((diff / tot.lastCents) * 100).toFixed(0)}%` : "";
    page.drawText("Total", { x: c.name, y, size: 10, font: bold, color: NAVY });
    right(page, String(tot.thisQty), c.tq, y, 10, bold); right(page, String(tot.lastQty), c.lq, y, 10, bold);
    right(page, `${tot.thisQty - tot.lastQty > 0 ? "+" : ""}${tot.thisQty - tot.lastQty}`, c.dq, y, 10, bold, colorFor(tot.thisQty - tot.lastQty));
    right(page, money(tot.thisCents), c.ts, y, 10, bold); right(page, money(tot.lastCents), c.ls, y, 10, bold);
    right(page, `${signed(diff)} ${pct}`.trim(), c.ds, y, 10, bold, colorFor(diff)); y -= 28;
    page.drawText("Based on orders marked picked up / delivered, dated by that day. Sales are what customers paid (6% sales tax included).", { x: 40, y, size: 8, font, color: GRAY }); y -= 11;
    page.drawText("Green = up from last year, red = down.", { x: 40, y, size: 8, font, color: GRAY });
  }

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sales-by-size-${range.start}-to-${range.end}.pdf"`
    }
  });
}
