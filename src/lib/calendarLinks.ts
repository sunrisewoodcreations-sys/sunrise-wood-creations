// Generates "Add to Calendar" links for the three major calendar
// providers. Deliberately dependency-free (no ics-generating library)
// so it's safe to import from anywhere — server-rendered emails or a
// client-rendered confirmation page — without pulling in extra weight
// for something this simple. Google and Outlook use a plain URL
// scheme; Apple Calendar (and anything else that reads .ics) gets a
// data: URI with the file contents inline, so no server-side file
// storage is needed for something this small and appointment-specific.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Converts a "YYYY-MM-DD" date + "HH:MM" time (already in the
// business's local time) into the UTC-basis format all three calendar
// formats expect, treating the appointment as Eastern time.
function toUtcCalendarStamp(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  // Same "try both possible Eastern UTC offsets" approach already used
  // elsewhere in this app for Eastern-time-safe date handling.
  for (const offsetHours of [4, 5]) {
    const guess = new Date(Date.UTC(y, m - 1, d, h + offsetHours, min, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(guess);
    const gy = Number(parts.find(p => p.type === "year")?.value);
    const gm = Number(parts.find(p => p.type === "month")?.value);
    const gd = Number(parts.find(p => p.type === "day")?.value);
    const gh = Number(parts.find(p => p.type === "hour")?.value) % 24;
    const gmin = Number(parts.find(p => p.type === "minute")?.value);
    if (gy === y && gm === m && gd === d && gh === h && gmin === min) {
      return `${guess.getUTCFullYear()}${pad(guess.getUTCMonth() + 1)}${pad(guess.getUTCDate())}T${pad(guess.getUTCHours())}${pad(guess.getUTCMinutes())}00Z`;
    }
  }
  // Fallback if neither offset matched exactly (shouldn't normally happen)
  const fallback = new Date(Date.UTC(y, m - 1, d, h + 4, min, 0));
  return `${fallback.getUTCFullYear()}${pad(fallback.getUTCMonth() + 1)}${pad(fallback.getUTCDate())}T${pad(fallback.getUTCHours())}${pad(fallback.getUTCMinutes())}00Z`;
}

export type CalendarEventInput = {
  title: string;
  description: string;
  location: string;
  dateStr: string; // "YYYY-MM-DD"
  timeStr: string; // "HH:MM", 24-hour, Eastern
  durationMinutes: number;
};

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

export function googleCalendarUrl(evt: CalendarEventInput): string {
  const start = toUtcCalendarStamp(evt.dateStr, evt.timeStr);
  const end = toUtcCalendarStamp(evt.dateStr, addMinutesToTime(evt.timeStr, evt.durationMinutes));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evt.title,
    dates: `${start}/${end}`,
    details: evt.description,
    location: evt.location
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(evt: CalendarEventInput): string {
  const start = toUtcCalendarStamp(evt.dateStr, evt.timeStr);
  const end = toUtcCalendarStamp(evt.dateStr, addMinutesToTime(evt.timeStr, evt.durationMinutes));
  const toIso = (stamp: string) => `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:00Z`;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: evt.title,
    startdt: toIso(start),
    enddt: toIso(end),
    body: evt.description,
    location: evt.location
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function icsEscape(text: string): string {
  return text.replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
}

// Apple Calendar (and any other .ics-compatible app) via a data: URI —
// no server-side file storage needed for something this small.
export function appleCalendarDataUrl(evt: CalendarEventInput): string {
  const start = toUtcCalendarStamp(evt.dateStr, evt.timeStr);
  const end = toUtcCalendarStamp(evt.dateStr, addMinutesToTime(evt.timeStr, evt.durationMinutes));
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sunrise Wood Creations//Pickup Scheduling//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@sunrisewoodcreations.com`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(evt.title)}`,
    `DESCRIPTION:${icsEscape(evt.description)}`,
    `LOCATION:${icsEscape(evt.location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
}
