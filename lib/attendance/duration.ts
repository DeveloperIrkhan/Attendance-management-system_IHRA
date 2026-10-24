/** 435 -> "7h 15m", 0 -> "0m", null/undefined -> "-" */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}