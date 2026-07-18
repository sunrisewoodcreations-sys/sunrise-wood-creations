import { getMaterialRequirements, getTodayReadiness } from "@/lib/materialPlanning";
import MaterialPlanning from "@/components/MaterialPlanning";

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
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function addDays(ds: string, days: number): string {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default async function MaterialPlanningPage({
  searchParams
}: {
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const { year, month, day } = easternDateParts(new Date());
  const todayStr = dateStr(year, month, day);
  const tomorrowStr = addDays(todayStr, 1);
  const weekEndStr = addDays(todayStr, 7);

  const range = searchParams.range || "today";
  let startDateStr = todayStr;
  let endDateStr = todayStr;
  let rangeLabel = "Today";

  if (range === "tomorrow") {
    startDateStr = tomorrowStr; endDateStr = tomorrowStr; rangeLabel = "Tomorrow";
  } else if (range === "week") {
    startDateStr = todayStr; endDateStr = weekEndStr; rangeLabel = "This Week";
  } else if (range === "custom" && searchParams.start && searchParams.end) {
    startDateStr = searchParams.start; endDateStr = searchParams.end; rangeLabel = `${searchParams.start} to ${searchParams.end}`;
  }

  const [result, readiness] = await Promise.all([
    getMaterialRequirements(startDateStr, endDateStr, rangeLabel),
    getTodayReadiness(todayStr)
  ]);

  return (
    <MaterialPlanning
      result={result}
      readiness={readiness}
      currentRange={range}
      customStart={searchParams.start || todayStr}
      customEnd={searchParams.end || todayStr}
    />
  );
}
