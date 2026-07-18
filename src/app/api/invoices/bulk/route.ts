import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function easternMidnightUtc(year: number, month: number, day: number): Date {
  // Tries EDT (-4) then EST (-5) and picks whichever lands on the exact
  // Eastern calendar date/midnight requested — handles daylight saving
  // without needing a timezone library.
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

function easternYearMonth(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "numeric"
  }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value)
  };
}

function getDateRange(period: string, now: Date): { start: Date; end: Date; label: string } {
  const { year, month } = easternYearMonth(now);
  const quarter = Math.floor((month - 1) / 3);

  if (period === "this_month") {
    const start = easternMidnightUtc(year, month, 1);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return { start, end: easternMidnightUtc(nextYear, nextMonth, 1), label: `${year}-${String(month).padStart(2, "0")}` };
  }

  if (period === "this_quarter" || period === "last_quarter") {
    let q = quarter, y = year;
    if (period === "last_quarter") {
      q -= 1;
      if (q < 0) { q = 3; y -= 1; }
    }
    const start = easternMidnightUtc(y, q * 3 + 1, 1);
    let endQ = q + 1, endY = y;
    if (endQ > 3) { endQ = 0; endY += 1; }
    return { start, end: easternMidnightUtc(endY, endQ * 3 + 1, 1), label: `Q${q + 1}-${y}` };
  }

  if (period === "this_year" || period === "last_year") {
    const y = period === "this_year" ? year : year - 1;
    return { start: easternMidnightUtc(y, 1, 1), end: easternMidnightUtc(y + 1, 1, 1), label: String(y) };
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

  const period = req.nextUrl.searchParams.get("period") || "this_quarter";
  let range;
  try {
    range = getDateRange(period, new Date());
  } catch {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Grouped by when each invoice was actually paid off, not when it was
  // first generated — an invoice created last quarter but paid this
  // quarter belongs in this quarter's bundle.
  const { data: invoices, error } = await admin
    .from("invoices")
    .select("*, orders:order_id(title)")
    .eq("paid_in_full", true)
    .gte("created_at", range.start.toISOString())
    .lt("created_at", range.end.toISOString())
    .order("invoice_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ error: "No paid invoices found for that period." }, { status: 404 });
  }

  const zip = new JSZip();

  for (const inv of invoices) {
    if (!inv.pdf_url) continue;
    try {
      const res = await fetch(inv.pdf_url);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const orderTitle = (inv as any).orders?.title || "order";
      const safeTitle = orderTitle.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-");
      zip.file(`invoice-${inv.invoice_year}-${inv.invoice_number}-${safeTitle}.pdf`, buffer);
    } catch {
      // Skip any invoice whose PDF can't be fetched rather than failing the whole batch.
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="invoices-${range.label}.zip"`
    }
  });
}
