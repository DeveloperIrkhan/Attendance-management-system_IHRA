
export const NOC_MAX_BYTES = 3 * 1024 * 1024; // 3 MB 
const TYPES = [
  { ext: "pdf", mime: "application/pdf", sig: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  {
    ext: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sig: [0x50, 0x4b, 0x03, 0x04], // zip container
  },
  { ext: "doc", mime: "application/msword", sig: [0xd0, 0xcf, 0x11, 0xe0] },
  { ext: "png", mime: "image/png", sig: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "jpg", mime: "image/jpeg", sig: [0xff, 0xd8, 0xff] },
  { ext: "jpeg", mime: "image/jpeg", sig: [0xff, 0xd8, 0xff] },
] as const;

export const NOC_ACCEPT = ".pdf,.docx,.doc,.png,.jpg,.jpeg";

/** A file name that is safe to store and to put in a download header. */
export function safeFileName(name: string, fallbackExt: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[^A-Za-z0-9 ._()-]/g, "")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(-100);
  return cleaned.length > 0 && cleaned !== "." ? cleaned : `NOC.${fallbackExt}`;
}

export type FileCheck =
  | { ok: true; fileName: string; mimeType: string; size: number }
  | { ok: false; error: string };

export function inspectNocFile(name: string, bytes: Uint8Array): FileCheck {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > NOC_MAX_BYTES) {
    return { ok: false, error: "The file is too large. The limit is 3 MB." };
  }
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const type = TYPES.find((t) => t.ext === ext);
  if (!type) {
    return { ok: false, error: "Upload a PDF, Word (.docx, .doc), PNG or JPG file." };
  }
  if (!type.sig.every((b, i) => bytes[i] === b)) {
    return { ok: false, error: "The file does not look like a real ." + type.ext + " file." };
  }
  return {
    ok: true,
    fileName: safeFileName(name, type.ext),
    mimeType: type.mime,
    size: bytes.length,
  };
}

/** Content-Disposition for a download: always an attachment, with an ASCII and a UTF-8 name. */
export function downloadHeader(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
