import "server-only";
import { createHash } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  ExcelFileError,
  parseAttendanceExcel,
} from "@/lib/attendance/excel-parse";
import { normalizeBiometricId } from "@/lib/attendance/biometric-id";
import { MONTHS } from "@/lib/attendance/months";
import type {
  ImportSummary,
  ProcessingInfo,
} from "@/lib/attendance/import-types";
import { processBatch } from "@/services/attendance.service";

const CHUNK = 1000;
const MAX_ISSUES = 5000;
const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

type Issue = {
  rowNumber: number | null;
  columnName: string | null;
  message: string;
};
type RowData = Omit<
  Prisma.ImportedAttendanceRowCreateManyInput,
  "importBatchId"
>;
type Status = ImportSummary["status"];

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/* ---------- Employee matching ---------- */

// normalized biometric ID -> employeeId, or null when two employees share it
type EmployeeIndex = Map<string, string | null>;

async function buildEmployeeIndex(): Promise<EmployeeIndex> {
  const employees = await prisma.employee.findMany({
    where: { biometricId: { not: null } },
    select: { id: true, biometricId: true },
  });
  const index: EmployeeIndex = new Map();
  for (const e of employees) {
    const key = normalizeBiometricId(e.biometricId);
    if (!key) continue;
    index.set(key, index.has(key) ? null : e.id);
  }
  return index;
}

type Match =
  | { status: "matched"; employeeId: string }
  | { status: "none" }
  | { status: "ambiguous" };

function resolve(index: EmployeeIndex, id: string): Match {
  if (!index.has(id)) return { status: "none" };
  const employeeId = index.get(id);
  return employeeId
    ? { status: "matched", employeeId }
    : { status: "ambiguous" };
}

function matchIssue(
  id: string,
  name: string | null,
  rows: number,
  firstRow: number,
  ambiguous: boolean,
): Issue {
  return {
    rowNumber: firstRow,
    columnName: "Biometric ID",
    message: ambiguous
      ? `Biometric ID ${id} is assigned to more than one employee. Fix the duplicate IDs under Employees, then re-match.`
      : `No employee found for Biometric ID ${id}${name ? ` (${name})` : ""}. ${rows} row(s) affected.`,
  };
}

function statusFor(successful: number, failed: number): Status {
  if (successful === 0) return "FAILED";
  return failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
}

/* ---------- Import ---------- */

export async function importAttendanceFile(p: {
  buffer: Buffer;
  fileName: string;
  month: number;
  year: number;
  userId: string;
}): Promise<ImportSummary> {
  // Duplicate-file check
  const fileHash = createHash("sha256").update(p.buffer).digest("hex");
  const previous = await prisma.importBatch.findFirst({
    where: { fileHash, status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS"] } },
    select: { createdAt: true },
  });
  if (previous) {
    throw new ServiceError(
      `This exact file was already imported on ${fmt(previous.createdAt)}. If you have since added missing employees, open that batch in Import History and use "Re-match employees".`,
    );
  }

  // Excel data extraction
  let parsed;
  try {
    parsed = parseAttendanceExcel(p.buffer);
  } catch (e) {
    if (e instanceof ExcelFileError) throw new ServiceError(e.message);
    throw e;
  }
  if (parsed.totalRows === 0) {
    throw new ServiceError("No data rows were found in the file.");
  }

  // Employee matching + row validation
  const index = await buildEmployeeIndex();
  const monthStart = Date.UTC(p.year, p.month - 1, 1);
  const monthEnd = Date.UTC(p.year, p.month, 1);

  const issues: Issue[] = parsed.issues.map((i) => ({
    rowNumber: i.rowNumber,
    columnName: i.column,
    message: i.message,
  }));
  const rows: RowData[] = [];
  const seen = new Map<string, number>();
  const unmatched = new Map<
    string,
    { name: string | null; rows: number; firstRow: number; ambiguous: boolean }
  >();
  let successful = 0;

  for (const r of parsed.rows) {
    const time = r.date.getTime();
    if (time < monthStart || time >= monthEnd) {
      issues.push({
        rowNumber: r.rowNumber,
        columnName: "Date",
        message: `Date ${fmt(r.date)} is outside the selected period (${MONTHS[p.month - 1]} ${p.year}). Row skipped.`,
      });
      continue;
    }

    const key = `${r.biometricId}|${fmt(r.date)}`;
    const firstSeen = seen.get(key);
    if (firstSeen !== undefined) {
      issues.push({
        rowNumber: r.rowNumber,
        columnName: null,
        message: `Duplicate entry for ${r.biometricId} on ${fmt(r.date)} (same as row ${firstSeen}). Row skipped.`,
      });
      continue;
    }
    seen.set(key, r.rowNumber);

    const match = resolve(index, r.biometricId);
    if (match.status === "matched") {
      successful++;
    } else {
      const entry = unmatched.get(r.biometricId);
      if (entry) entry.rows++;
      else {
        unmatched.set(r.biometricId, {
          name: r.employeeName,
          rows: 1,
          firstRow: r.rowNumber,
          ambiguous: match.status === "ambiguous",
        });
      }
    }

    rows.push({
      sourceRowNumber: r.rowNumber,
      rawData: r.rawRow as Prisma.InputJsonValue,
      employeeId: match.status === "matched" ? match.employeeId : null,
      attendanceDate: r.date,
      sourceClockIn: r.clockIn,
      sourceClockOut: r.clockOut,
      sourceAbsent: r.absent,
      sourceWorkTime: r.workTime,
      sourceAttTime: r.attTime,
      sourcePunches: r.punches,
      sourceBiometricId: r.biometricId,
      sourceEmployeeName: r.employeeName,
    });
  }

  for (const [id, u] of unmatched) {
    issues.push(matchIssue(id, u.name, u.rows, u.firstRow, u.ambiguous));
  }

  const totalRows = parsed.totalRows;
  const failedRows = totalRows - successful;
  const status = statusFor(successful, failedRows);

  let storedIssues = issues;
  if (issues.length > MAX_ISSUES) {
    storedIssues = [
      ...issues.slice(0, MAX_ISSUES),
      {
        rowNumber: null,
        columnName: null,
        message: `${issues.length - MAX_ISSUES} more issues not shown.`,
      },
    ];
  }

  const fileName = path
    .basename(p.fileName)
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 255);

  // Save everything atomically
  const batchId = await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        fileName,
        fileHash,
        month: p.month,
        year: p.year,
        status,
        totalRows,
        successfulRows: successful,
        failedRows,
        uploadedById: p.userId,
      },
      select: { id: true },
    });

    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx.importedAttendanceRow.createMany({
        data: rows
          .slice(i, i + CHUNK)
          .map((r) => ({ ...r, importBatchId: batch.id })),
      });
    }
    for (let i = 0; i < storedIssues.length; i += CHUNK) {
      await tx.importError.createMany({
        data: storedIssues
          .slice(i, i + CHUNK)
          .map((e) => ({ ...e, importBatchId: batch.id })),
      });
    }
    return batch.id;
  }, TX_OPTIONS);
  let processing: ProcessingInfo | null = null;
  let processingError: string | undefined;
  if (successful > 0) {
    try {
      const r = await processBatch(batchId);
      processing = { processed: r.processed, byStatus: r.byStatus };
    } catch (e) {
      console.error("Attendance processing failed:", e);
      processingError =
        e instanceof ServiceError
          ? e.message
          : 'Attendance processing failed. Open the batch and click "Process attendance".';
    }
  }
  return {
    batchId,
    status,
    totalRows,
    successfulRows: successful,
    failedRows,
    unmatched: [...unmatched.entries()]
      .filter(([, u]) => !u.ambiguous)
      .map(([biometricId, u]) => ({ biometricId, name: u.name, rows: u.rows })),
    processing,
    processingError,
  };
}

/* ---------- Re-match (after adding missing employees) ---------- */

export async function rematchBatch(batchId: string) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, totalRows: true },
  });
  if (!batch) throw new ServiceError("Import batch not found.");

  const index = await buildEmployeeIndex();
  const open = await prisma.importedAttendanceRow.findMany({
    where: {
      importBatchId: batchId,
      employeeId: null,
      sourceBiometricId: { not: null },
    },
    select: {
      sourceBiometricId: true,
      sourceEmployeeName: true,
      sourceRowNumber: true,
    },
    orderBy: { sourceRowNumber: "asc" },
  });

  const groups = new Map<
    string,
    { name: string | null; rows: number; firstRow: number }
  >();
  for (const r of open) {
    const id = r.sourceBiometricId!;
    const g = groups.get(id);
    if (g) g.rows++;
    else
      groups.set(id, {
        name: r.sourceEmployeeName,
        rows: 1,
        firstRow: r.sourceRowNumber,
      });
  }

  let newlyMatched = 0;
  await prisma.$transaction(async (tx) => {
    const issues: Issue[] = [];

    for (const [id, g] of groups) {
      const match = resolve(index, id);
      if (match.status === "matched") {
        const res = await tx.importedAttendanceRow.updateMany({
          where: {
            importBatchId: batchId,
            employeeId: null,
            sourceBiometricId: id,
          },
          data: { employeeId: match.employeeId },
        });
        newlyMatched += res.count;
      } else {
        issues.push(
          matchIssue(
            id,
            g.name,
            g.rows,
            g.firstRow,
            match.status === "ambiguous",
          ),
        );
      }
    }

    await tx.importError.deleteMany({
      where: { importBatchId: batchId, columnName: "Biometric ID" },
    });
    if (issues.length) {
      await tx.importError.createMany({
        data: issues.map((i) => ({ ...i, importBatchId: batchId })),
      });
    }

    const successful = await tx.importedAttendanceRow.count({
      where: { importBatchId: batchId, employeeId: { not: null } },
    });
    const failed = batch.totalRows - successful;
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        successfulRows: successful,
        failedRows: failed,
        status: statusFor(successful, failed),
      },
    });
  }, TX_OPTIONS);
  try {
    await processBatch(batchId);
  } catch (e) {
    console.error("Re-processing after re-match failed:", e);
  }
  return { newlyMatched };
}

/* ---------- Queries ---------- */

export function listImportBatches() {
  return prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { uploadedBy: { select: { fullName: true } } },
  });
}

export const ROWS_PAGE_SIZE = 1000;

export async function getImportBatchDetail(
  id: string,
  requestedPage = 1,
  unmatchedOnly = false,
) {
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: { uploadedBy: { select: { fullName: true } } },
  });
  if (!batch) return null;

  const rowWhere = {
    importBatchId: id,
    ...(unmatchedOnly ? { employeeId: null } : {}),
  };

  const rowCount = await prisma.importedAttendanceRow.count({
    where: rowWhere,
  });
  const pageCount = Math.max(1, Math.ceil(rowCount / ROWS_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);

  const [errors, errorCount, preview] = await Promise.all([
    prisma.importError.findMany({
      where: { importBatchId: id },
      orderBy: { rowNumber: "asc" },
      take: 200,
    }),
    prisma.importError.count({ where: { importBatchId: id } }),
    prisma.importedAttendanceRow.findMany({
      where: rowWhere,
      orderBy: { sourceRowNumber: "asc" },
      skip: (page - 1) * ROWS_PAGE_SIZE,
      take: ROWS_PAGE_SIZE,
      include: { employee: { select: { name: true, employeeCode: true } } },
    }),
  ]);

  return {
    batch,
    errors,
    errorCount,
    preview,
    rowCount,
    page,
    pageCount,
    pageSize: ROWS_PAGE_SIZE,
  };
}
