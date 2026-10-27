import type { ReportTable } from "./type";

const cell = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

/** CSV that Excel opens correctly (UTF-8 with a byte-order mark). */
export function renderReportCsv(table: ReportTable): string {
  const lines = [
    [table.title],
    [table.subtitle],
    [],
    table.column.map((c) => c.label),
    ...table.rows,
    ...(table.totals ? [table.totals] : []),
    [],
    ...(table.notes ?? []).map((n) => [n]),
  ];
  return (
    "\uFEFF" + lines.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
import {
  getApproverIdentity,
  hasPermission,
  type AuthUser,
} from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

/**
 * Who may download a report as PDF or CSV (viewing needs only a department or organization scope):
 * people with reports:export (Admin, HR), and DD, CEO and Chairman, who are limited to
 * their scope.
 */
export function canExportReports(user: AuthUser): boolean {
  if (hasPermission(user, PERMISSIONS.REPORTS_EXPORT)) return true;
  return (getApproverIdentity(user)?.level ?? "STAFF") !== "STAFF";
}
