import {
  evaluateDay,
  withoutEarlyLeaveRule,
  type DayResult,
  type DayType,
  type RuleConfig,
} from "./attendance-rules";

export type LiveDayInput = {
  dayType: DayType;
  /** all punches of the day, in minutes since midnight */
  punches: number[];
  /** the day being evaluated is today on the office clock */
  isToday: boolean;
  /** minutes since midnight now, on the office clock */
  nowMinutes: number;
};

/**
 * Evaluates a day from device punches.
 *
 * The rules engine treats a single punch as "Missing punch". That is right once the day is over,
 * but during the day it only means the person has checked in and not left yet. So for today,
 * before the shift ends, a lone check-in is judged by its arrival time (present, short leave or
 * half day) and left without a check-out, with a note.
 *
 * Leaving early works the same way: while today's shift is still running, a second punch may be
 * a re-scan or a trip out, not the end of the day. So the leaving-early rule is applied only once
 * the shift has ended. Until then the day is judged by arrival alone, with a note.
 */
export function evaluateLiveDay(
  input: LiveDayInput,
  cfg: RuleConfig,
): { result: DayResult; note: string | null } {
  const shiftRunning =
    input.isToday &&
    input.dayType === "WORKING" &&
    input.nowMinutes < cfg.shiftEnd;

  // Leaving early is judged only after today's shift has ended.
  const relaxed = withoutEarlyLeaveRule(cfg);
  const full = evaluateDay(
    { dayType: input.dayType, punches: input.punches },
    cfg,
  );
  const result = shiftRunning
    ? evaluateDay({ dayType: input.dayType, punches: input.punches }, relaxed)
    : full;
  const earlyRuleWaiting =
    shiftRunning && full.earlyLeaveStatus !== null
      ? "Early-leave rule is applied after the shift ends"
      : null;

  const stillInOffice =
    input.isToday &&
    input.dayType === "WORKING" &&
    input.nowMinutes < cfg.shiftEnd &&
    result.status === "INCOMPLETE" &&
    result.accepted.length === 1;
  if (!stillInOffice) return { result, note: earlyRuleWaiting };

  // Judge the arrival by pretending the person left a moment later, then drop the made-up check-out.
  const arrival = result.accepted[0];
  const probe = evaluateDay(
    {
      dayType: input.dayType,
      punches: [...input.punches, Math.max(input.nowMinutes, arrival + cfg.duplicatePunchMinutes)],
    },
    relaxed,
  );
  if (probe.status === "ABSENT" || probe.status === "INCOMPLETE") {
    return { result, note: null };
  }

  return {
    result: {
      ...probe,
      checkOut: null,
      workingMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      accepted: result.accepted,
      remarks: result.remarks,
    },
    note: "Checked in, not checked out yet",
  };
}
