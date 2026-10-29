import {
  evaluateDay,
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
 */
export function evaluateLiveDay(
  input: LiveDayInput,
  cfg: RuleConfig,
): { result: DayResult; note: string | null } {
  const result = evaluateDay(
    { dayType: input.dayType, punches: input.punches },
    cfg,
  );

  const stillInOffice =
    input.isToday &&
    input.dayType === "WORKING" &&
    input.nowMinutes < cfg.shiftEnd &&
    result.status === "INCOMPLETE" &&
    result.accepted.length === 1;
  if (!stillInOffice) return { result, note: null };

  // Judge the arrival by pretending the person left a moment later, then drop the made-up check-out.
  const arrival = result.accepted[0];
  const probe = evaluateDay(
    {
      dayType: input.dayType,
      punches: [...input.punches, Math.max(input.nowMinutes, arrival + cfg.duplicatePunchMinutes)],
    },
    cfg,
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
