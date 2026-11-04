import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  LOGO_FILE,
  ORG_NAME,
  ORG_SHORT,
  SYSTEM_NAME,
} from "./branding";

import type { ReportTable } from "./type";

// A4 landscape, in points
const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;
const ROW_H = 18;
const HEAD_H = 28;
const FONT_SIZE = 8.5;

const GREEN = rgb(0.086, 0.396, 0.204);
const LIGHT_GREEN = rgb(0.9, 0.95, 0.91);
const LIGHT_GRAY = rgb(0.965, 0.965, 0.965);
const DARK_TEXT = rgb(0.1, 0.1, 0.1);

/**
 * Load the organization logo from the public directory.
 */
async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const logoPath = path.join(process.cwd(), LOGO_FILE);

    const buffer = await readFile(logoPath);

    return new Uint8Array(buffer);
  } catch (error) {
    console.error("Unable to load PDF logo:", error);
    return null;
  }
}

/**
 * Standard PDF fonts only cover Western characters.
 * Unsupported characters are replaced with "?".
 */
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

/**
 * Fit text inside a specified width.
 */
function fit(
  font: PDFFont,
  text: string,
  width: number,
  size: number,
): string {
  const clean = safe(font, text);

  if (font.widthOfTextAtSize(clean, size) <= width) {
    return clean;
  }

  let cut = clean;

  while (
    cut.length > 1 &&
    font.widthOfTextAtSize(`${cut}...`, size) > width
  ) {
    cut = cut.slice(0, -1);
  }

  return `${cut}...`;
}

/**
 * Draw the main organization letterhead.
 */
function drawLetterhead(
  page: ReturnType<PDFDocument["addPage"]>,
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
): number {
  let y = PAGE_H - MARGIN;

  const LOGO_SIZE = logo ? 36 : 0;
  const textX = logo ? MARGIN + LOGO_SIZE + 12 : MARGIN;

  // Organization logo
  if (logo) {
    page.drawImage(logo, {
      x: MARGIN,
      y: y - LOGO_SIZE,
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    });
  }

  // Organization name
  const bold = undefined;

  // Draw organization name and system name.
  // Fonts are passed from the main PDF function separately below.
  return y - LOGO_SIZE - 8;
}

/**
 * Draw the report table header.
 */
function drawTableHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  table: ReportTable,
  widths: number[],
  y: number,
  bold: PDFFont,
): number {
  const usable = PAGE_W - MARGIN * 2;

  page.drawRectangle({
    x: MARGIN,
    y: y - HEAD_H + 6,
    width: usable,
    height: HEAD_H,
    color: GREEN,
  });

  let x = MARGIN;

  table.column.forEach((column, i) => {
    const width = widths[i];
    const clean = safe(bold, column.label);

    const heading =
      bold.widthOfTextAtSize(clean, FONT_SIZE) <= width - 8
        ? [clean]
        : (() => {
            const words = clean.split(" ");

            for (let split = 1; split < words.length; split++) {
              const first = words.slice(0, split).join(" ");
              const second = words.slice(split).join(" ");

              if (
                bold.widthOfTextAtSize(first, FONT_SIZE) <= width - 8 &&
                bold.widthOfTextAtSize(second, FONT_SIZE) <= width - 8
              ) {
                return [first, second];
              }
            }

            return [fit(bold, clean, width - 8, FONT_SIZE)];
          })();

    heading.forEach((text, line) => {
      const textWidth = bold.widthOfTextAtSize(text, FONT_SIZE);

      const tx =
        column.align === "right"
          ? x + width - 4 - textWidth
          : column.align === "center"
            ? x + (width - textWidth) / 2
            : x + 4;

      const ty =
        heading.length === 1
          ? y - 11
          : y - 6 - line * 10;

      page.drawText(text, {
        x: tx,
        y: ty,
        size: FONT_SIZE,
        font: bold,
        color: rgb(1, 1, 1),
      });
    });

    x += width;
  });

  return y - HEAD_H;
}

/**
 * Draw a continuation page header.
 */
function drawContinuationHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  font: PDFFont,
  table: ReportTable,
): number {
  let y = PAGE_H - MARGIN;

  if (logo) {
    page.drawImage(logo, {
      x: MARGIN,
      y: y - 18,
      width: 18,
      height: 18,
    });
  }

  const hx = logo ? MARGIN + 24 : MARGIN;

  page.drawText(
    fit(
      font,
      `${ORG_NAME} (${ORG_SHORT}) - ${table.title}`,
      PAGE_W - MARGIN * 2 - 30,
      8.5,
    ),
    {
      x: hx,
      y: y - 12,
      size: 8.5,
      font,
      color: rgb(0.35, 0.35, 0.35),
    },
  );

  return y - 26;
}

/**
 * Render report as landscape A4 PDF.
 */
export async function renderReportPdf(
  table: ReportTable,
  generatedBy: string,
  logoPng?: Uint8Array | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Load logo automatically if caller did not provide one.
  const logoBytes = logoPng === undefined ? await loadLogo() : logoPng;

  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;

  if (logoBytes) {
    try {
      logo = await pdf.embedPng(logoBytes);
    } catch (error) {
      console.error("Unable to embed PDF logo:", error);
    }
  }

  const usable = PAGE_W - MARGIN * 2;

  const totalWeight = table.column.reduce(
    (sum, column) => sum + (column.weight ?? 1),
    0,
  );

  const widths = table.column.map(
    (column) =>
      ((column.weight ?? 1) / totalWeight) * usable,
  );

  const lines = [
    ...table.rows,
    ...(table.totals ? [table.totals] : []),
  ];

  const subtotal = new Set(table.subtotalRows ?? []);

  const pages: ReturnType<typeof pdf.addPage>[] = [];

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  pages.push(page);

  let y = PAGE_H - MARGIN;

  // --------------------------------------------------
  // FIRST PAGE LETTERHEAD
  // --------------------------------------------------

  const LOGO_SIZE = logo ? 36 : 0;
  const textX = logo ? MARGIN + LOGO_SIZE + 12 : MARGIN;

  if (logo) {
    page.drawImage(logo, {
      x: MARGIN,
      y: y - LOGO_SIZE,
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    });
  }

  page.drawText(safe(bold, ORG_NAME), {
    x: textX,
    y: y - 24,
    size: 16,
    font: bold,
    color: GREEN,
  });

  page.drawText(safe(font, SYSTEM_NAME), {
    x: textX,
    y: y - 42,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= Math.max(LOGO_SIZE, 42) + 8;

  // Green separator
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.5,
    color: GREEN,
  });

  y -= 24;

  // --------------------------------------------------
  // REPORT TITLE
  // --------------------------------------------------

  page.drawText(safe(bold, table.title), {
    x: MARGIN,
    y,
    size: 15,
    font: bold,
    color: DARK_TEXT,
  });

  y -= 16;

  page.drawText(fit(font, table.subtitle, usable, 10), {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });

  y -= 18;

  // --------------------------------------------------
  // TABLE HEADER
  // --------------------------------------------------

  y = drawTableHeader(page, table, widths, y, bold);

  // --------------------------------------------------
  // CONTINUATION PAGE
  // --------------------------------------------------

  const addContinuationPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);

    pages.push(page);

    y = drawContinuationHeader(page, logo, font, table);

    y = drawTableHeader(page, table, widths, y, bold);
  };

  // --------------------------------------------------
  // TABLE ROWS
  // --------------------------------------------------

  lines.forEach((row, index) => {
    if (y - ROW_H < MARGIN + 18) {
      addContinuationPage();
    }

    const isTotals =
      Boolean(table.totals) &&
      index === lines.length - 1;

    const isSubtotal = subtotal.has(index);

    const isWeeklyOff = row.some(
      (cell) =>
        String(cell ?? "").trim().toLowerCase() === "weekly off",
    );

    const isHighlighted = isTotals || isSubtotal;

    const f = isHighlighted ? bold : font;

    // Row background priority:
    // Weekly Off = Red
    // Subtotal / Total = Green
    // Alternate rows = Gray

    if (isWeeklyOff && !isTotals && !isSubtotal) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_H + 6,
        width: usable,
        height: ROW_H,
        color: rgb(1, 0.9, 0.9),
      });
    } else if (isHighlighted) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_H + 6,
        width: usable,
        height: ROW_H,
        color: LIGHT_GREEN,
      });
    } else if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_H + 6,
        width: usable,
        height: ROW_H,
        color: LIGHT_GRAY,
      });
    }

    let x = MARGIN;

    row.forEach((cell, i) => {
      const text = fit(f, String(cell ?? ""), widths[i] - 8, FONT_SIZE);

      const textWidth = f.widthOfTextAtSize(text, FONT_SIZE);

      const align = table.column[i]?.align;

      const tx =
        align === "right"
          ? x + widths[i] - 4 - textWidth
          : align === "center"
            ? x + (widths[i] - textWidth) / 2
            : x + 4;

      page.drawText(text, {
        x: tx,
        y: y - 8,
        size: FONT_SIZE,
        font: f,
        color: DARK_TEXT,
      });

      x += widths[i];
    });

    y -= ROW_H;
  });

  // --------------------------------------------------
  // EMPTY TABLE
  // --------------------------------------------------

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

  // --------------------------------------------------
  // NOTES
  // --------------------------------------------------

  for (const note of table.notes ?? []) {
    if (y - 16 < MARGIN + 18) {
      // Continuation header already draws the table headings.
      // Notes do not need another table header.
      page = pdf.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      y = drawContinuationHeader(page, logo, font, table);
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

  // --------------------------------------------------
  // FOOTER
  // --------------------------------------------------

  const stamp =
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by ${generatedBy}`;

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