// Run:  npx tsx lib/noc/file.check.mts
import assert from "node:assert/strict";
import { inspectNocFile, safeFileName, downloadHeader, NOC_MAX_BYTES } from "./file.ts";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);
const pdf = bytes(0x25, 0x50, 0x44, 0x46);

// good files
const good = inspectNocFile("NOC Ahmed.pdf", pdf);
assert.equal(good.ok, true);
assert.equal((good as { mimeType: string }).mimeType, "application/pdf");
assert.equal(inspectNocFile("letter.DOCX", bytes(0x50, 0x4b, 0x03, 0x04)).ok, true);           // extension in capitals
assert.equal(inspectNocFile("scan.jpg", bytes(0xff, 0xd8, 0xff, 0xe0)).ok, true);
assert.equal(inspectNocFile("scan.png", bytes(0x89, 0x50, 0x4e, 0x47)).ok, true);
assert.equal(inspectNocFile("old.doc", bytes(0xd0, 0xcf, 0x11, 0xe0)).ok, true);
// a renamed program or page is refused even with a good extension
assert.equal(inspectNocFile("virus.pdf", bytes(0x4d, 0x5a, 0x90, 0x00)).ok, false);            // an .exe called .pdf
assert.equal(inspectNocFile("page.pdf", new TextEncoder().encode("<html><script>")).ok, false);
assert.equal(inspectNocFile("a.docx", pdf).ok, false);                                          // wrong kind of file
// wrong or missing extension
assert.equal(inspectNocFile("run.exe", bytes(0x4d, 0x5a)).ok, false);
assert.equal(inspectNocFile("noext", pdf).ok, false);
assert.equal(inspectNocFile("x.pdf.exe", pdf).ok, false);
assert.equal(inspectNocFile("x.html", pdf).ok, false);
// empty and too large
assert.equal(inspectNocFile("a.pdf", new Uint8Array(0)).ok, false);
const big = new Uint8Array(NOC_MAX_BYTES + 1); big.set([0x25, 0x50, 0x44, 0x46]);
assert.equal(inspectNocFile("big.pdf", big).ok, false);
const edge = new Uint8Array(NOC_MAX_BYTES); edge.set([0x25, 0x50, 0x44, 0x46]);
assert.equal(inspectNocFile("edge.pdf", edge).ok, true);                                        // exactly 3 MB is fine
// names
assert.equal(safeFileName("../../etc/passwd", "pdf"), "passwd");
assert.equal(safeFileName("C:\\Users\\x\\NOC.pdf", "pdf"), "NOC.pdf");
assert.equal(safeFileName('bad"na<me>.pdf', "pdf"), "badname.pdf");
assert.equal(safeFileName("....", "pdf"), "NOC.pdf");
assert.equal(safeFileName("", "pdf"), "NOC.pdf");
assert.ok(safeFileName("a".repeat(300) + ".pdf", "pdf").length <= 100);
// download header never allows a break-out and is always an attachment
const h = downloadHeader('NOC "Ali".pdf');
assert.ok(h.startsWith("attachment;")); assert.ok(!h.includes('"Ali"'));
assert.ok(downloadHeader("NOC عمر.pdf").includes("filename*=UTF-8''"));
console.log("noc file: all checks passed");
