/**
 * A small PDF writer for report exports. Development doc:
 * `docs/development-docs/24-reports.md`, section on exports.
 *
 * Why hand written rather than a library: a report is a title, a few lines
 * under it, and titled tables. That needs text, rules, and page breaks, which
 * is a few hundred lines, not a dependency the plugin bundle carries forever.
 *
 * It uses the two standard fonts every PDF reader has, Helvetica and
 * Helvetica Bold, so nothing is embedded and a file stays a few kilobytes.
 * Their encoding is WinAnsi: Latin letters with accents, the euro sign, and
 * common punctuation. A character outside it (a name in Bengali script, the
 * rupee sign) prints as "?". The CSV export keeps every character, and money
 * is written with its currency code ("INR 1,250.00"), never a symbol.
 */

export type PdfAlign = "left" | "right";

export interface PdfColumn {
  label: string;
  align?: PdfAlign;
  /** Relative width. Default 1. */
  weight?: number;
  /** False keeps the column out of the PDF: a receipt link is for a spreadsheet, not paper. */
  pdf?: boolean;
}

export interface PdfTable {
  title: string;
  /** One line under the title, in grey. */
  note?: string;
  columns: ReadonlyArray<PdfColumn>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
  /** Shown in place of rows when there are none. */
  empty?: string;
}

export interface PdfReport {
  title: string;
  /** Grey lines under the title: mode, period, filters, when it was made. */
  meta: ReadonlyArray<string>;
  tables: ReadonlyArray<PdfTable>;
  /** Bottom left of every page, beside the page number. */
  footer: string;
  /** Landscape for wide lists. Default portrait. */
  landscape?: boolean;
}

/* A4 in points. */
const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const MARGIN = 48;
/** Content stops this far up, leaving room for the footer. */
const BOTTOM = MARGIN + 24;

const ROW_HEIGHT = 18;
const CELL_SIZE = 9;
const CELL_PAD = 4;

/* Helvetica and Helvetica Bold advance widths, 1/1000 em, for " " to "~". */
// prettier-ignore
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// prettier-ignore
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** WinAnsi bytes 0x80 to 0x9F that are not Latin-1. */
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

const ELLIPSIS = 0x85;

/** Text as WinAnsi byte values; "?" for what the encoding cannot show. */
export function toWinAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 63;
    if (code === 9 || code === 10 || code === 13) bytes.push(32);
    else if (code >= 32 && code <= 126) bytes.push(code);
    else if (code >= 160 && code <= 255) bytes.push(code);
    else bytes.push(CP1252[code] ?? 63);
  }
  return bytes;
}

/** Width in points of WinAnsi bytes at a size. Outside ASCII, an average glyph. */
function widthOf(bytes: ReadonlyArray<number>, size: number, bold: boolean): number {
  const table = bold ? BOLD : REGULAR;
  let units = 0;
  for (const byte of bytes) units += byte >= 32 && byte <= 126 ? table[byte - 32] : 556;
  return (units * size) / 1000;
}

export function textWidth(text: string, size: number, bold = false): number {
  return widthOf(toWinAnsi(text), size, bold);
}

/** The bytes cut to fit a width, ending in an ellipsis when cut. */
function fit(text: string, width: number, size: number, bold: boolean): number[] {
  const bytes = toWinAnsi(text);
  if (widthOf(bytes, size, bold) <= width) return bytes;
  const room = width - widthOf([ELLIPSIS], size, bold);
  let end = bytes.length;
  while (end > 0 && widthOf(bytes.slice(0, end), size, bold) > room) end -= 1;
  return [...bytes.slice(0, end), ELLIPSIS];
}

/** A PDF string literal, kept 7-bit: anything else as an octal escape. */
function literal(bytes: ReadonlyArray<number>): string {
  let out = "(";
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return `${out})`;
}

const num = (value: number) => (Math.round(value * 100) / 100).toString();

/** Lays content onto pages, top down, as content stream operators. */
class Layout {
  readonly pages: string[][] = [];
  readonly width: number;
  readonly height: number;
  readonly contentWidth: number;
  private y = 0;

  constructor(landscape: boolean) {
    this.width = landscape ? A4_LONG : A4_SHORT;
    this.height = landscape ? A4_SHORT : A4_LONG;
    this.contentWidth = this.width - MARGIN * 2;
    this.newPage();
  }

  private get ops(): string[] {
    return this.pages[this.pages.length - 1];
  }

  newPage(): void {
    this.pages.push([]);
    this.y = this.height - MARGIN;
  }

  /** Break the page unless `height` more points fit. True when it broke. */
  need(height: number): boolean {
    if (this.y - height >= BOTTOM) return false;
    this.newPage();
    return true;
  }

  down(height: number): void {
    this.y -= height;
  }

  /** Jump to a height on the current page, for the footer. */
  at(y: number): void {
    this.y = y;
  }

  text(value: string, x: number, size: number, options: { bold?: boolean; grey?: boolean; width?: number; align?: PdfAlign } = {}): void {
    const bold = options.bold === true;
    const width = options.width ?? this.contentWidth;
    const bytes = fit(value, width, size, bold);
    const left = options.align === "right" ? x + width - widthOf(bytes, size, bold) : x;
    this.ops.push(
      `${options.grey ? "0.42 0.44 0.48" : "0.07 0.09 0.13"} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${num(left)} ${num(this.y)} Td ${literal(bytes)} Tj ET`
    );
  }

  rule(weight: number, grey: number): void {
    this.ops.push(`${grey} G ${weight} w ${num(MARGIN)} ${num(this.y)} m ${num(MARGIN + this.contentWidth)} ${num(this.y)} l S`);
  }

  band(height: number): void {
    this.ops.push(`0.95 0.96 0.97 rg ${num(MARGIN)} ${num(this.y)} ${num(this.contentWidth)} ${num(height)} re f`);
  }
}

function drawTable(layout: Layout, table: PdfTable): void {
  const shown = table.columns.map((column, index) => ({ column, index })).filter(({ column }) => column.pdf !== false);
  const total = shown.reduce((sum, { column }) => sum + (column.weight ?? 1), 0);
  let x = MARGIN;
  const cells = shown.map(({ column, index }) => {
    const width = ((column.weight ?? 1) / total) * layout.contentWidth;
    const cell = { column, index, left: x + CELL_PAD, width: width - CELL_PAD * 2 };
    x += width;
    return cell;
  });

  const header = () => {
    layout.down(ROW_HEIGHT);
    layout.band(ROW_HEIGHT);
    layout.down(-6);
    for (const cell of cells) layout.text(cell.column.label, cell.left, 8, { bold: true, grey: true, width: cell.width, align: cell.column.align });
    layout.down(6);
  };

  // A title is never left alone at the foot of a page: it keeps its header and a row.
  layout.need(28 + (table.note ? 14 : 0) + ROW_HEIGHT * 2);
  layout.down(22);
  layout.text(table.title, MARGIN, 12, { bold: true });
  if (table.note) {
    layout.down(14);
    layout.text(table.note, MARGIN, 9, { grey: true });
  }
  layout.down(6);
  header();

  if (table.rows.length === 0) {
    layout.down(ROW_HEIGHT - 6);
    layout.text(table.empty ?? "Nothing to show.", MARGIN + CELL_PAD, CELL_SIZE, { grey: true });
    layout.down(6);
    layout.rule(0.5, 0.88);
    return;
  }

  for (const row of table.rows) {
    // A table that runs onto a new page repeats its header there.
    if (layout.need(ROW_HEIGHT)) header();
    layout.down(ROW_HEIGHT - 6);
    for (const cell of cells) layout.text(row[cell.index] ?? "", cell.left, CELL_SIZE, { width: cell.width, align: cell.column.align });
    layout.down(6);
    layout.rule(0.5, 0.88);
  }
}

/** The report as a PDF file. Every character is 7-bit, so the string is the bytes. */
export function renderPdf(report: PdfReport): string {
  const landscape = report.landscape === true;
  const layout = new Layout(landscape);

  layout.down(18);
  layout.text(report.title, MARGIN, 18, { bold: true });
  layout.down(4);
  for (const line of report.meta) {
    layout.down(14);
    layout.text(line, MARGIN, 10, { grey: true });
  }
  layout.down(8);
  layout.rule(1, 0.8);

  for (const table of report.tables) drawTable(layout, table);

  const count = layout.pages.length;
  const streams = layout.pages.map((ops, index) => {
    const footer = new Layout(landscape);
    footer.at(MARGIN - 8);
    footer.text(report.footer, MARGIN, 8, { grey: true, width: footer.contentWidth - 80 });
    footer.text(`Page ${index + 1} of ${count}`, MARGIN, 8, { grey: true, align: "right" });
    return [...ops, ...footer.pages[0]].join("\n");
  });

  // Objects: 1 catalog, 2 page tree, 3 and 4 fonts, 5 info, then a page and its stream per page.
  const objects: string[] = [];
  const pageIds = streams.map((_, index) => 6 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${count} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = `<< /Title ${literal(toWinAnsi(report.title))} /Producer (MemberFrame) >>`;
  streams.forEach((stream, index) => {
    const id = pageIds[index];
    objects[id] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${layout.width} ${layout.height}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objects[id + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let file = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = file.length;
    file += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = file.length;
  file += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) file += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return file;
}
