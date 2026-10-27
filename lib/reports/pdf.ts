import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { ReportTable } from "./type";

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;
const ROW_H = 18;
const HEAD_H = 28;
const FONT_SIZE = 8.5;
const GREEN = rgb(0.086, 0.396, 0.204);
function safe(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.replace(/\s+/g, " ")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function fit(font: PDFFont, text: string, width: number, size: number): string {
  const clean = safe(font, text);
  if (font.widthOfTextAtSize(clean, size) <= width) return clean;
  let cut = clean;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

export async function renderReportPdf(
  table: ReportTable,
  generatedBy: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const usable = PAGE_W - MARGIN * 2;
  const totalWeight = table.column.reduce((s, c) => s + (c.weight ?? 1), 0);
  const widths = table.column.map(
    (c) => ((c.weight ?? 1) / totalWeight) * usable,
  );
  const lines = [...table.rows, ...(table.totals ? [table.totals] : [])];

  const pages: ReturnType<typeof pdf.addPage>[] = [];
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H - MARGIN;

  // title block (first page only)
  page.drawText(safe(bold, table.title), {
    x: MARGIN,
    y: y - 14,
    size: 16,
    font: bold,
    color: GREEN,
  });
  y -= 32;
  page.drawText(fit(font, table.subtitle, usable, 10), {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });
  y -= 18;

  // Headings wrap onto two lines so "Working days" or "Missing punch" are never cut off.
  const wrapHeading = (text: string, width: number): string[] => {
    const clean = safe(bold, text);
    if (bold.widthOfTextAtSize(clean, FONT_SIZE) <= width) return [clean];
    const words = clean.split(" ");
    for (let split = 1; split < words.length; split++) {
      const a = words.slice(0, split).join(" ");
      const b = words.slice(split).join(" ");
      if (
        bold.widthOfTextAtSize(a, FONT_SIZE) <= width &&
        bold.widthOfTextAtSize(b, FONT_SIZE) <= width
      ) {
        return [a, b];
      }
    }
    return [fit(bold, clean, width, FONT_SIZE)];
  };

  const drawHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - HEAD_H + 6,
      width: usable,
      height: HEAD_H,
      color: GREEN,
    });
    let x = MARGIN;
    table.column.forEach((c, i) => {
      const heading = wrapHeading(c.label, widths[i] - 8);
      heading.forEach((text, line) => {
        const w = bold.widthOfTextAtSize(text, FONT_SIZE);
        const tx =
          c.align === "right"
            ? x + widths[i] - 4 - w
            : c.align === "center"
              ? x + (widths[i] - w) / 2
              : x + 4;
        const ty = heading.length === 1 ? y - 11 : y - 6 - line * 10;
        page.drawText(text, {
          x: tx,
          y: ty,
          size: FONT_SIZE,
          font: bold,
          color: rgb(1, 1, 1),
        });
      });
      x += widths[i];
    });
    y -= HEAD_H;
  };
  drawHeader();

  lines.forEach((row, index) => {
    if (y - ROW_H < MARGIN + 18) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      y = PAGE_H - MARGIN;
      drawHeader();
    }
    const isTotals = Boolean(table.totals) && index === lines.length - 1;
    const f = isTotals ? bold : font;
    if (isTotals) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_H + 6,
        width: usable,
        height: ROW_H,
        color: rgb(0.9, 0.95, 0.91),
      });
    } else if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_H + 6,
        width: usable,
        height: ROW_H,
        color: rgb(0.965, 0.965, 0.965),
      });
    }
    let x = MARGIN;
    row.forEach((cell, i) => {
      const text = fit(f, cell ?? "", widths[i] - 8, FONT_SIZE);
      const w = f.widthOfTextAtSize(text, FONT_SIZE);
      const align = table.column[i]?.align;
      const tx =
        align === "right"
          ? x + widths[i] - 4 - w
          : align === "center"
            ? x + (widths[i] - w) / 2
            : x + 4;
      page.drawText(text, {
        x: tx,
        y: y - 8,
        size: FONT_SIZE,
        font: f,
        color: rgb(0.1, 0.1, 0.1),
      });
      x += widths[i];
    });
    y -= ROW_H;
  });

  if (lines.length === 0) {
    page.drawText("No records match these filters.", {
      x: MARGIN + 4,
      y: y - 10,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= ROW_H;
  }

  // notes after the table
  for (const note of table.notes ?? []) {
    if (y - 16 < MARGIN + 18) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      y = PAGE_H - MARGIN;
    }
    y -= 6;
    page.drawText(fit(font, note, usable, 9), {
      x: MARGIN,
      y: y - 8,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 12;
  }

  // footer on every page
  const stamp = `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by ${generatedBy}`;
  pages.forEach((p, i) => {
    p.drawText(fit(font, stamp, usable - 80, 8), {
      x: MARGIN,
      y: 20,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8),
      y: 20,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return pdf.save();
}
