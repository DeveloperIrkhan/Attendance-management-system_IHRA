import { NextResponse } from "next/server";
import { ServiceError } from "@/lib/action-state";
import { apiAuth, getDataScope } from "@/lib/auth/authorization";
import { canExportReports, renderReportCsv } from "@/lib/reports/csv";
import { renderReportPdf } from "@/lib/reports/pdf";
import { buildReport } from "@/services/report.service";
import { parseReportParams } from "@/lib/reports/type";

// GET /api/reports?type=monthly&month=2026-06&department=...&format=pdf|csv
export async function GET(request: Request) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const scope = getDataScope(user);
  if (scope.kind === "SELF" || !canExportReports(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const params = parseReportParams((k) => url.searchParams.get(k));
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";

  try {
    // the scope is applied inside buildReport, so a DD only ever gets their own department
    const table = await buildReport(params, scope);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `${params.type}-report-${stamp}`;

    if (format === "csv") {
      return new Response(renderReportCsv(table), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const bytes = await renderReportPdf(table, user.fullName);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ServiceError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not build the report." },
      { status: 500 },
    );
  }
}
