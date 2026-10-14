import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ServiceError } from "@/lib/action-state";
import { validateExcelFile } from "@/lib/attendance/file-validation";
import { importAttendanceFile } from "@/lib/attendance/import-service";

const metaSchema = z.object({
  month: z.coerce.number().int().min(1, "Select a valid month").max(12, "Select a valid month"),
  year: z.coerce.number().int().min(2000, "Enter a valid year").max(2100, "Enter a valid year"),
});

export async function POST(request: Request) {
  const auth = await apiAuth({ permissions: [PERMISSIONS.ATTENDANCE_IMPORT] });
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please choose an Excel file." }, { status: 400 });
  }

  const meta = metaSchema.safeParse({ month: form.get("month"), year: form.get("year") });
  if (!meta.success) {
    return NextResponse.json({ error: meta.error.issues[0].message }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    validateExcelFile(file.name, file.size, buffer);

    const summary = await importAttendanceFile({
      buffer,
      fileName: file.name,
      month: meta.data.month,
      year: meta.data.year,
      userId: auth.user.id,
    });

    revalidatePath("/attendance/imports");
    return NextResponse.json(summary, { status: summary.status === "FAILED" ? 422 : 201 });
  } catch (e) {
    if (e instanceof ServiceError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Attendance import failed:", e);
    return NextResponse.json({ error: "Import failed unexpectedly." }, { status: 500 });
  }
}