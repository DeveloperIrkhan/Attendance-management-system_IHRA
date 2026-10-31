export type AttendanceStatusName =
  | "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE"
  | "HOLIDAY" | "WEEKEND" | "INCOMPLETE" | "SHORT_LEAVE";

export type DayType = "WORKING" | "WEEKEND" | "HOLIDAY";


export type RuleSettingsLike = {
  shiftStart: string; // "HH:mm"
  shiftEnd: string; // "HH:mm"
  graceMinutes: number;
  halfDayAfterMinutes: number;
  duplicatePunchMinutes: number;
  earliestPunch: string; // "HH:mm", punches before this are ignored
  latestPunch: string; // "HH:mm", punches after this are ignored
  overtimeMinMinutes: number;
  offDayWorkIsOvertime: boolean;
  /** "HH:mm": a check-out before this is a half day. Empty or missing = rule off. */
  earlyLeaveHalfDayBefore?: string | null;
  /** "HH:mm": a check-out before this is a short leave. Empty or missing = rule off. */
  earlyLeaveShortLeaveBefore?: string | null;
};

export type RuleConfig = {
  shiftStart: number;
  shiftEnd: number;
  graceMinutes: number;
  halfDayAfterMinutes: number;
  duplicatePunchMinutes: number;
  earliestPunch: number;
  latestPunch: number;
  overtimeMinMinutes: number;
  offDayWorkIsOvertime: boolean;
  /** minutes since midnight, or null when the rule is off */
  earlyLeaveHalfDayBefore: number | null;
  earlyLeaveShortLeaveBefore: number | null;
};

export type DayInput = {
  dayType: DayType;
  punches: number[]; // minutes, any order, may contain duplicates
  hintIn?: number | null; // machine's own Clock In column
  hintOut?: number | null; // machine's own Clock Out column
};

export type DayResult = {
  status: AttendanceStatusName;
  checkIn: number | null;
  checkOut: number | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  /** set when the check-out time (leaving early) lowered or matched the status */
  earlyLeaveStatus: "SHORT_LEAVE" | "HALF_DAY" | null;
  accepted: number[];
  ignored: number[];
  remarks: string | null;
};

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toRuleConfig(s: RuleSettingsLike): RuleConfig {
  return {
    shiftStart: toMinutes(s.shiftStart),
    shiftEnd: toMinutes(s.shiftEnd),
    graceMinutes: s.graceMinutes,
    halfDayAfterMinutes: s.halfDayAfterMinutes,
    duplicatePunchMinutes: s.duplicatePunchMinutes,
    earliestPunch: toMinutes(s.earliestPunch),
    latestPunch: toMinutes(s.latestPunch),
    overtimeMinMinutes: s.overtimeMinMinutes,
    offDayWorkIsOvertime: s.offDayWorkIsOvertime,
    earlyLeaveHalfDayBefore: s.earlyLeaveHalfDayBefore
      ? toMinutes(s.earlyLeaveHalfDayBefore)
      : null,
    earlyLeaveShortLeaveBefore: s.earlyLeaveShortLeaveBefore
      ? toMinutes(s.earlyLeaveShortLeaveBefore)
      : null,
  };
}

/** The same rules with the leaving-early rule switched off. */
export function withoutEarlyLeaveRule(cfg: RuleConfig): RuleConfig {
  return {
    ...cfg,
    earlyLeaveHalfDayBefore: null,
    earlyLeaveShortLeaveBefore: null,
  };
}

const SEVERITY: Partial<Record<AttendanceStatusName, number>> = {
  PRESENT: 0,
  SHORT_LEAVE: 1,
  HALF_DAY: 2,
};

//Builds the punch list for a day from the sheet's punch text and in/out columns 
export function collectPunches(
  sourcePunches: string | null,
  clockIn: string | null,
  clockOut: string | null,
): number[] {
  const found = new Set<number>();
  const add = (text: string | null) => {
    if (!text) return;
    for (const m of text.matchAll(/(\d{1,2}):(\d{2})/g)) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h < 24 && min < 60) found.add(h * 60 + min);
    }
  };
  add(sourcePunches);
  add(clockIn);
  add(clockOut);
  return [...found].sort((a, b) => a - b);
}

function describeOffDay(dayType: DayType) {
  return dayType === "HOLIDAY" ? "holiday" : "weekly off day";
}

export function evaluateDay(input: DayInput, cfg: RuleConfig): DayResult {
  // 1a. Ignore punches outside the allowed window (same idea as the machine software).
  const unique = [...new Set(input.punches)].sort((a, b) => a - b);
  const outside = unique.filter((p) => p < cfg.earliestPunch || p > cfg.latestPunch);
  const sorted = unique.filter((p) => p >= cfg.earliestPunch && p <= cfg.latestPunch);

  // 1b. Ignore repeat punches within the duplicate window of the last accepted punch.
  const accepted: number[] = [];
  const ignored: number[] = [];
  for (const p of sorted) {
    const last = accepted[accepted.length - 1];
    if (last !== undefined && p - last < cfg.duplicatePunchMinutes) ignored.push(p);
    else accepted.push(p);
  }

  const remarks: string[] = [];
  if (outside.length) {
    remarks.push(
      `Punch at ${outside.map(formatMinutes).join(", ")} outside ${formatMinutes(cfg.earliestPunch)}-${formatMinutes(cfg.latestPunch)} ignored`,
    );
  }
  if (ignored.length) {
    remarks.push(`${ignored.length} repeated punch(es) ignored`);
  }

  const base: DayResult = {
    status: "ABSENT",
    checkIn: null,
    checkOut: null,
    workingMinutes: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    earlyLeaveStatus: null,
    accepted,
    ignored,
    remarks: null,
  };
  const finish = (r: Partial<DayResult>): DayResult => ({
    ...base,
    ...r,
    remarks: remarks.length ? remarks.join("; ") : null,
  });

  const first = accepted[0];
  const last = accepted[accepted.length - 1];

  // 2. Weekly off / holiday
  if (input.dayType !== "WORKING") {
    const status: AttendanceStatusName = input.dayType === "HOLIDAY" ? "HOLIDAY" : "WEEKEND";
    if (accepted.length >= 2) {
      const working = last - first;
      remarks.push(`Worked on a ${describeOffDay(input.dayType)}`);
      return finish({
        status,
        checkIn: first,
        checkOut: last,
        workingMinutes: working,
        overtimeMinutes: cfg.offDayWorkIsOvertime ? working : 0,
      });
    }
    return finish({ status });
  }

  // 3. Working day, no punches: full-day absence
  if (accepted.length === 0) {
    remarks.push("No punches");
    return finish({ status: "ABSENT" });
  }

  // 4. Working day, one punch: missing check-in or check-out (needs HR)
  if (accepted.length === 1) {
    let asCheckIn: boolean;
    if (input.hintIn != null && input.hintOut == null) asCheckIn = true;
    else if (input.hintOut != null && input.hintIn == null) asCheckIn = false;
    else asCheckIn = first < Math.floor((cfg.shiftStart + cfg.shiftEnd) / 2);

    remarks.push(
      asCheckIn
        ? "Missing check-out. Contact HR."
        : "Missing check-in. Contact HR.",
    );
    return finish({
      status: "INCOMPLETE",
      checkIn: asCheckIn ? first : null,
      checkOut: asCheckIn ? null : first,
    });
  }

  // 5. Working day with check-in and check-out (first and last accepted punch)
  const delay = first - cfg.shiftStart;
  let status: AttendanceStatusName = "PRESENT";
  let lateMinutes = 0;
  if (delay > cfg.graceMinutes) {
    lateMinutes = delay;
    status = delay >= cfg.halfDayAfterMinutes ? "HALF_DAY" : "SHORT_LEAVE";
  }

  const earlyLeaveMinutes = Math.max(0, cfg.shiftEnd - last);
  if (earlyLeaveMinutes > 0) remarks.push(`Left ${earlyLeaveMinutes} min early`);

  // Leaving early: the day gets the worse of the arrival result and the departure result,
  // so being late and leaving early never counts twice.
  let earlyLeaveStatus: DayResult["earlyLeaveStatus"] = null;
  let earlyRuleText = "";
  if (cfg.earlyLeaveHalfDayBefore !== null && last < cfg.earlyLeaveHalfDayBefore) {
    earlyLeaveStatus = "HALF_DAY";
    earlyRuleText = `half day rule (before ${formatMinutes(cfg.earlyLeaveHalfDayBefore)})`;
  } else if (
    cfg.earlyLeaveShortLeaveBefore !== null &&
    last < cfg.earlyLeaveShortLeaveBefore
  ) {
    earlyLeaveStatus = "SHORT_LEAVE";
    earlyRuleText = `short leave rule (before ${formatMinutes(cfg.earlyLeaveShortLeaveBefore)})`;
  }
  if (earlyLeaveStatus) {
    remarks.push(`Checked out at ${formatMinutes(last)}: ${earlyRuleText}`);
    if ((SEVERITY[earlyLeaveStatus] ?? 0) > (SEVERITY[status] ?? 0)) {
      status = earlyLeaveStatus;
    }
  }

  const rawOvertime = Math.max(0, last - cfg.shiftEnd);
  const overtimeMinutes = rawOvertime >= cfg.overtimeMinMinutes ? rawOvertime : 0;

  return finish({
    status,
    checkIn: first,
    checkOut: last,
    workingMinutes: last - first,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    earlyLeaveStatus,
  });
}