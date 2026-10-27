export type ReportType =
  | "daily"
  | "monthly"
  | "late"
  | "absent"
  | "overtime"
  | "department"
  | "history"
  | "leaves"
  | "shortleaves";

export const REPORT_TYPE: {
  value: ReportType;
  label: string;
  description: string;
  filters: (
    | "date"
    | "month"
    | "range"
    | "department"
    | "employee"
    | "status"
  )[];
}[] = [
  {
    value: "monthly",
    label: "Monthly attendance",
    description:
      "One line per employee: days present, late, absent, leave, overtime",
    filters: ["month", "department"],
  },
  {
    value: "daily",
    label: "Daily attendance",
    description: "Every employee's check-in, check-out and status on one day",
    filters: ["date", "department"],
  },
  {
    value: "late",
    label: "Late arrivals",
    description: "Short leaves, half days and late minutes in a date range",
    filters: ["range", "department"],
  },
  {
    value: "absent",
    label: "Absentees",
    description: "Absent days and missing punches in a date range",
    filters: ["range", "department"],
  },
  {
    value: "overtime",
    label: "Overtime",
    description: "Total overtime per employee in a date range",
    filters: ["range", "department"],
  },
  {
    value: "department",
    label: "Department summary",
    description: "One line per department for a month",
    filters: ["month"],
  },
  {
    value: "history",
    label: "Employee history",
    description: "Day-by-day attendance of one employee",
    filters: ["employee", "range"],
  },
  {
    value: "leaves",
    label: "Leave history",
    description: "Leave requests, who decided and when",
    filters: ["range", "status", "department"],
  },
];

export type ReportColumn = {
  label: string;
  align?: "left" | "right" | "center";
  weight?: number;
};

export type ReportTable = {
  title: string;
  subtitle: string;
  column: ReportColumn[];
  rows: string[][];
  totals?: string[];
  notes?: string[];
};

export type ReportParams = {
  type: ReportType;
  date?: string;
  from?: string;
  to?: string;
  month?: string;
  department?: string;
  employee?: string;
  status?: string;
};

export function parseReportType(value: string | undefined): ReportType {
  return REPORT_TYPE.some((t) => t.value === value)
    ? (value as ReportType)
    : "monthly";
}

export function parseReportParams(
  get: (key: string) => string | null | undefined,
): ReportParams {
  const v = (key: string) => get(key)?.trim() || undefined;
  return {
    type: parseReportType(v("type")),
    date: v("date"),
    from: v("from"),
    to: v("to"),
    month: v("month"),
    department: v("department"),
    employee: v("employee"),
    status: v("status"),
  };
}
