import { NextResponse } from "next/server";
import { ServiceError } from "@/lib/action-state";
import { apiAuth } from "@/lib/auth/authorization";
import { downloadHeader, NOC_MAX_BYTES } from "@/lib/noc/file";
import { getNocDocumentFor, issueNoc } from "@/services/noc.service";

type Context = { params: Promise<{ id: string }> };

// GET  /api/noc/<id>/document   download the NOC (the employee it was issued to, HR / Admin)
export async function GET(_request: Request, { params }: Context) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const doc = await getNocDocumentFor(auth.user, id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": downloadHeader(doc.fileName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

// POST /api/noc/<id>/document   HR / Admin upload the NOC (multipart form, field "file")
export async function POST(request: Request, { params }: Context) {
  // Only our own pages may upload: a request that comes from another site is refused.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  // refuse an oversized body before reading it
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > NOC_MAX_BYTES + 200_000) {
    return NextResponse.json({ error: "The file is too large. The limit is 3 MB." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }
    await issueNoc(auth.user, id, file);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Could not upload the file." }, { status: 500 });
  }
}
