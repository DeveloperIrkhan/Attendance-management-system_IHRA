export const LEAVE_REMARK = "Approved leave";
const DAY_MS = 86_400_000;

export type DayType = "WORKING" | "WEEKEND" | "HOLIDAY";

export type ExistingRow = {
  status: string;
  isManual: boolean;
  hasCheckIn: boolean;
  remarks: string | null;
};

export type LeaveSyncInput = {
  fromMs: number;
  toMs: number;
  todayMs: number;
  nowMinutes: number;
  shiftEndMinutes: number;
  leaves: { startMs: number; endMs: number }[];
  joiningMs: number | null;
  rows: Map<string, ExistingRow>; 
  dayTypeOf: (ms: number) => DayType;
};

export type LeaveSyncPlan = {
  create: { dateMs: number }[];
  toOnLeave: { dateMs: number }[];
  toIncomplete: { dateMs: number }[];
  toAbsent: { dateMs: number }[];
  remove: { dateMs: number }[];
};

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function planLeaveSync(input: LeaveSyncInput): LeaveSyncPlan {
  const plan: LeaveSyncPlan = {
    create: [],
    toOnLeave: [],
    toIncomplete: [],
    toAbsent: [],
    remove: [],
  };
  // days still to come are not written (they would move the dashboards' "latest day")
  const lastMs = Math.min(input.toMs, input.todayMs);
  const dayIsOver = (ms: number) =>
    ms < input.todayMs || input.nowMinutes >= input.shiftEndMinutes;

  for (let ms = input.fromMs; ms <= lastMs; ms += DAY_MS) {
    if (input.joiningMs !== null && ms < input.joiningMs) continue;
    if (input.dayTypeOf(ms) !== "WORKING") continue;

    const row = input.rows.get(iso(ms));
    const covered = input.leaves.some((l) => l.startMs <= ms && l.endMs >= ms);

    if (covered) {
      if (!row) plan.create.push({ dateMs: ms });
      else if (
        !row.isManual &&
        (row.status === "ABSENT" || row.status === "INCOMPLETE")
      ) {
        plan.toOnLeave.push({ dateMs: ms });
      }
      continue;
    }

    // not covered: undo a row that only exists because of a leave that is now cancelled
    if (
      row &&
      !row.isManual &&
      row.status === "ON_LEAVE" &&
      (row.remarks ?? "").includes(LEAVE_REMARK)
    ) {
      if (row.hasCheckIn) plan.toIncomplete.push({ dateMs: ms });
      else if (dayIsOver(ms)) plan.toAbsent.push({ dateMs: ms });
      else plan.remove.push({ dateMs: ms });
    }
  }
  return plan;
}
