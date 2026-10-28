import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOGO_FILE } from "./branding";

let cached: Uint8Array | null | undefined;

/** The logo for PDF headers, read once. Returns null if the file is missing, so reports still work. */
export async function loadLogoPng(): Promise<Uint8Array | null> {
  if (cached !== undefined) return cached;
  try {
    cached = new Uint8Array(await readFile(path.join(process.cwd(), LOGO_FILE)));
  } catch {
    console.warn(`Report logo not found at ${LOGO_FILE}; PDFs are made without it.`);
    cached = null;
  }
  return cached;
}