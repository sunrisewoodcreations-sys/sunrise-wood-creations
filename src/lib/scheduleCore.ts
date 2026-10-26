// Pure scheduling math for pickups and deliveries. No database, no network —
// everything here is easy to test.
//
// All dates/times are Eastern "wall clock" values (the shop's local time),
// the same way appointment_date / appointment_time are stored.

export type Kind = "pickup" | "delivery";

export const TZ = "America/New_York";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Day number (days since 1970-01-01) of a YYYY-MM-DD string.
export function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function dateFromDayNumber(n: number): string {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}
export function addDays(dateStr: string, days: number): string {
  return dateFromDayNumber(dayNumber(dateStr) + days);
}
export function weekdayOf(dateStr: string): number {
  return new Date(dayNumber(dateStr) * 86400000).getUTCDay();
}

// Absolute "minute" on one continuous line: day * 1440 + minute of day.
export function absMinute(dateStr: string, time: string): number {
  return dayNumber(dateStr) * 1440 + timeToMinutes(time);
}
export function absToDateTime(abs: number): { dateStr: string; time: string } {
  const day = Math.floor(abs / 1440);
  return { dateStr: dateFromDayNumber(day), time: minutesToTime(abs - day * 1440) };
}
// 'YYYY-MM-DD HH:MM:SS' string, as the database's local timestamp wants it.
export function absToTimestamp(abs: number): string {
  const { dateStr, time } = absToDateTime(abs);
  return `${dateStr} ${time}:00`;
}

// Current Eastern date + minutes since midnight.
export function easternNow(now: Date = new Date()): { dateStr: string; minutes: number; abs: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value || "0";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return { dateStr, minutes, abs: dayNumber(dateStr) * 1440 + minutes };
}

// The real moment (UTC ms) for an Eastern wall-clock date + time. Handles
// daylight saving by checking what Eastern time a guess actually lands on.
export function easternToUtcMs(dateStr: string, time: string): number {
  const abs = absMinute(dateStr, time);
  let guess = abs * 60000; // pretend it's UTC
  for (let i = 0; i < 2; i++) {
    const shown = easternNow(new Date(guess)).abs;
    guess += (abs - shown) * 60000;
  }
  return guess;
}

// A block of time an appointment uses, as absolute minutes [start, end).
export type Block = { start: number; end: number };

export type TripTimes = {
  minutesAtCustomer: number;
  bufferAfterMinutes: number;
  slotLengthMinutes: number;
};

// Pickup: just its own slot.
export function pickupBlock(arrival: number, t: TripTimes): Block {
  return { start: arrival, end: arrival + t.slotLengthMinutes };
}

// Delivery: leave `drive` minutes before arriving, spend minutesAtCustomer
// there, drive `drive` home, then keep a buffer for traffic.
// `arrival` is when you arrive at the customer.
export function deliveryBlock(arrival: number, driveMinutes: number, t: TripTimes): Block {
  return {
    start: arrival - driveMinutes,
    end: arrival + t.minutesAtCustomer + driveMinutes + t.bufferAfterMinutes
  };
}

// "On my way home" stop: you leave customer A and go straight to B.
// A's block ends when you leave A. B's block starts then, and B's arrival
// is that moment plus the A->B drive (rounded up to 5 minutes).
export function chainedStop(opts: {
  aArrival: number; minutesAtCustomer: number;
  driveAtoB: number; driveBHome: number; bufferAfterMinutes: number;
}): { aEnd: number; bArrival: number; bBlock: Block } {
  const aEnd = opts.aArrival + opts.minutesAtCustomer;
  const bArrival = Math.ceil((aEnd + opts.driveAtoB) / 5) * 5;
  return {
    aEnd,
    bArrival,
    bBlock: { start: aEnd, end: bArrival + opts.minutesAtCustomer + opts.driveBHome + opts.bufferAfterMinutes }
  };
}

export function overlaps(a: Block, b: Block): boolean {
  return a.start < b.end && b.start < a.end;
}

export type BlockedRange = { date: string; start: string; end: string };

export function blockedRangeToBlock(r: BlockedRange): Block {
  return { start: absMinute(r.date, r.start), end: absMinute(r.date, r.end) };
}

export type SlotConfig = {
  kind: Kind;
  driveMinutes: number;               // one way; ignored for pickups
  availableDays: number[];            // 0=Sun..6=Sat
  startTime: string;
  endTime: string;
  slotLengthMinutes: number;
  minutesAtCustomer: number;
  bufferAfterMinutes: number;
  blockedDates: Set<string>;
  blockedRanges: BlockedRange[];
  existing: Block[];                  // active appointments' blocks
  todayStr: string;
  nowAbs: number;
  daysAhead: number;
};

export function blockFor(cfg: Pick<SlotConfig, "kind" | "driveMinutes" | "slotLengthMinutes" | "minutesAtCustomer" | "bufferAfterMinutes">, arrival: number): Block {
  const t: TripTimes = { minutesAtCustomer: cfg.minutesAtCustomer, bufferAfterMinutes: cfg.bufferAfterMinutes, slotLengthMinutes: cfg.slotLengthMinutes };
  return cfg.kind === "delivery" ? deliveryBlock(arrival, cfg.driveMinutes, t) : pickupBlock(arrival, t);
}

// Is one specific date+time bookable? Used both to build the picker and to
// re-check at booking time.
export function isSlotOpen(cfg: SlotConfig, dateStr: string, time: string, ignoreBlock?: Block): boolean {
  if (cfg.blockedDates.has(dateStr)) return false;
  if (!cfg.availableDays.includes(weekdayOf(dateStr))) return false;

  const tm = timeToMinutes(time);
  const start = timeToMinutes(cfg.startTime);
  const end = timeToMinutes(cfg.endTime);
  // Customer-facing time must sit on the slot grid and inside open hours,
  // and the visit itself must finish before closing.
  if ((tm - start) % cfg.slotLengthMinutes !== 0) return false;
  const visit = cfg.kind === "delivery" ? cfg.minutesAtCustomer : cfg.slotLengthMinutes;
  if (tm < start || tm + visit > end) return false;

  const arrival = absMinute(dateStr, time);
  const block = blockFor(cfg, arrival);
  if (block.start <= cfg.nowAbs) return false;

  for (const e of cfg.existing) {
    if (ignoreBlock && e.start === ignoreBlock.start && e.end === ignoreBlock.end) continue;
    if (overlaps(block, e)) return false;
  }
  for (const r of cfg.blockedRanges) {
    if (overlaps(block, blockedRangeToBlock(r))) return false;
  }
  return true;
}

export type DaySlots = { date: string; times: string[] };

export function computeSlots(cfg: SlotConfig, ignoreBlock?: Block): DaySlots[] {
  const days: DaySlots[] = [];
  const start = timeToMinutes(cfg.startTime);
  const end = timeToMinutes(cfg.endTime);
  for (let i = 0; i <= cfg.daysAhead; i++) {
    const dateStr = addDays(cfg.todayStr, i);
    const times: string[] = [];
    for (let m = start; m < end; m += cfg.slotLengthMinutes) {
      const t = minutesToTime(m);
      if (isSlotOpen(cfg, dateStr, t, ignoreBlock)) times.push(t);
    }
    if (times.length > 0) days.push({ date: dateStr, times });
  }
  return days;
}
