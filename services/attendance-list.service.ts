import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/attendance/dates";
import type { DailyStatus } from "@/lib/attendance/daily-filters";
import { employeeWhereFor, type DataScope } from "@/lib/auth/data-scope";

export const DAILY_PAGE_SIZE = 100;

/**
 * Attendance records for one day, a date range or a month, filtered by department, status and a
 * search text. The DD's own department limit is always applied through `scope`.
 * `counts` ignores the status filter, so the status buttons can show how many days match each.
 */
export async function listAttendanceRecords(opts: {
  start: Date;
  end: Date;
  departmentId?: string;
  status: DailyStatus;
  q?: string;
  scope: DataScope;
  page: number;
}) {
  const q = opts.q?.trim().slice(0, 60);
  const employee = {
    ...employeeWhereFor(opts.scope, opts.departmentId),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { employeeCode: { contains: q, mode: "insensitive" as const } },
            { biometricId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const dateWhere = { gte: opts.start, lt: addDays(opts.end, 1) };
  const base = { date: dateWhere, employee };
  const where = opts.status === "ALL" ? base : { ...base, status: opts.status };

  const [grouped, records] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: base,
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "asc" }, { employee: { employeeCode: "asc" } }],
      skip: (opts.page - 1) * DAILY_PAGE_SIZE,
      take: DAILY_PAGE_SIZE,
      include: {
        employee: {
          select: {
            name: true,
            employeeCode: true,
            biometricId: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const counts: Record<string, number> = {};
  let all = 0;
  for (const g of grouped) {
    counts[g.status] = g._count._all;
    all += g._count._all;
  }
  const total = opts.status === "ALL" ? all : (counts[opts.status] ?? 0);
  return {
    records,
    counts,
    all,
    total,
    pages: Math.max(1, Math.ceil(total / DAILY_PAGE_SIZE)),
  };
}
