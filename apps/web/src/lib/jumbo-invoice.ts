"use client";

// "Fulvago Travel Accommodation invoice" — the form issued to Jumboline, drawn
// as a real (vector) PDF with jsPDF so each booking downloads as its own file.
// Layout mirrors the manually-produced reference in Docs/.
// jsPDF is imported dynamically so it stays out of the initial bundle.

import { FULVAGO_LOGO_DATA_URI } from "./invoice-logo";
import { safeFileName, zipSync, type ZipEntry } from "./zip";

export interface JumboInvoice {
  invoiceNo: string;      // {yyyy}0000
  agencyRef: string;      // operator booking reference
  clientName: string;     // lead guest as recorded, e.g. "Mr CHRISTOPHE PERUFFO"
  requestDate: string;    // ISO yyyy-mm-dd — booking date entered on the system
  checkIn: string;        // ISO yyyy-mm-dd
  checkOut: string;       // ISO yyyy-mm-dd
  nights: number;
  roomOccupancy: string;  // e.g. "DBL" or "2 x DBL"
  roomType: string;       // e.g. "Comfort room"
  pax: number;
  currency: string;       // USD / EUR / EGP / GBP
  amount: number;         // selling total, booking currency
  issuedBy: string;       // name of the user generating the invoice
  issueDate: string;      // ISO yyyy-mm-dd — the day the invoice is generated
}

/**
 * Today in the browser's own timezone. Deliberately not
 * `toISOString().slice(0, 10)` (used elsewhere for form defaults): that yields
 * the UTC day, which would date an invoice generated late at night in Egypt to
 * the previous day.
 */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The bill-to party is fixed: these invoices exist only for this operator.
const BILL_TO = [
  "Invoice to:  (07009) Palma de Mallorca - Spain.",
  "JUMBOLINE ACCOMMODATIONS & SERVICES S.L.U.,",
  "VAT 856619968",
  "Address Gran Via Asima, 4 , Poligono Son Castello,",
  "(07009) Palma de Mallorca - Spain.",
];

const SELLER = [
  "Fulvago Travel",
  "VAT 200-265-075",
  "Address office no. 1303,",
  "El-Kawther, infront of Hurghada airport,",
  "Hurghada, Red Sea,",
  "Egypt",
];

// m/d/yyyy with no leading zeros — matches the reference form ("7/8/2026").
function slashDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : "—";
}

function amount2(n: number): string {
  const [int, dec] = (Number.isFinite(n) ? n : 0).toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
}

const PAGE_W = 210;   // A4 portrait, mm
const MARGIN = 10;
const TABLE_W = PAGE_W - MARGIN * 2;

// Column widths (mm) — must sum to TABLE_W. `maxLines` is 1 for values that
// must never wrap (dates, counts); those shrink to fit instead.
const COLS: { header: string[]; width: number; maxLines: number }[] = [
  { header: ["Agency reference"],  width: 23, maxLines: 2 },
  { header: ["Client Name"],       width: 29, maxLines: 2 },
  { header: ["Request", "date"],   width: 18, maxLines: 1 },
  { header: ["Check in"],          width: 18, maxLines: 1 },
  { header: ["Check out"],         width: 18, maxLines: 1 },
  { header: ["Nights"],            width: 9,  maxLines: 1 },
  { header: ["Room", "Occupancy"], width: 20, maxLines: 2 },
  { header: ["Room Type"],         width: 21, maxLines: 2 },
  { header: ["Pax"],               width: 8,  maxLines: 1 },
  { header: ["Amount"],            width: 26, maxLines: 1 },
];

type Doc = import("jspdf").jsPDF;

/**
 * Centre `text` in a cell, shrinking the font until it fits within `maxLines`.
 * A value with no break opportunity (a date) can still overflow the cell width
 * after splitting, so the width of the widest line is checked too — otherwise
 * "7/22/2026" spills into the neighbouring column.
 */
function fitCentered(doc: Doc, text: string, x: number, w: number, yMid: number, size: number, maxLines = 2) {
  const avail = w - 3;
  let fontSize = size;
  let lines: string[] = [];
  for (;;) {
    doc.setFontSize(fontSize);
    // splitTextToSize hard-breaks a word that is wider than the cell, which
    // would chop a surname (or a date) mid-token — shrink until the longest
    // word fits on its own, then split on real word boundaries.
    const longestWord = text.split(/\s+/).reduce((m, word) => Math.max(m, doc.getTextWidth(word)), 0);
    lines = doc.splitTextToSize(text, avail);
    if ((lines.length <= maxLines && longestWord <= avail) || fontSize <= 5.5) break;
    fontSize -= 0.25;
  }
  lines = lines.slice(0, maxLines);
  const lh = fontSize * 0.42;
  const top = yMid - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => doc.text(ln, x + w / 2, top + i * lh, { align: "center", baseline: "middle" }));
  doc.setFontSize(size);
}

/** Underline the text just drawn at (x, y) with the given width. */
function underline(doc: Doc, x: number, y: number, w: number) {
  doc.setLineWidth(0.25);
  doc.line(x, y + 1.1, x + w, y + 1.1);
}

function drawInvoice(doc: Doc, d: JumboInvoice) {
  doc.setDrawColor(0);
  doc.setTextColor(0);

  // Logo — the reference JPEG is 350×64.
  const logoW = 92;
  doc.addImage(FULVAGO_LOGO_DATA_URI, "JPEG", 18, 14, logoW, logoW * (64 / 350));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  SELLER.forEach((line, i) => doc.text(line, 14, 41 + i * 4.6));
  BILL_TO.forEach((line, i) => doc.text(line, 104, 71 + i * 4.6));

  // Invoice Number / Arrival date box.
  const boxX = 14, boxY = 99, labelW = 34, valueW = 40, rowH = 6;
  doc.setLineWidth(0.3);
  [
    ["Invoice Number", d.invoiceNo],
    ["Arrival date", slashDate(d.checkIn)],
  ].forEach(([label, value], i) => {
    const y = boxY + i * rowH;
    doc.rect(boxX, y, labelW, rowH);
    doc.rect(boxX + labelW, y, valueW, rowH);
    doc.setFont("helvetica", "bold");
    doc.text(label, boxX + 2, y + rowH / 2, { baseline: "middle" });
    doc.text(value, boxX + labelW + valueW / 2, y + rowH / 2, { align: "center", baseline: "middle" });
  });

  // Centred, underlined document title.
  const title = "Fulvago Travel Accommodation invoice";
  const titleY = boxY + rowH * 2 + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(title, PAGE_W / 2, titleY, { align: "center" });
  underline(doc, PAGE_W / 2 - doc.getTextWidth(title) / 2, titleY, doc.getTextWidth(title));

  // ── Items table ───────────────────────────────────────────────────────────
  const headY = titleY + 5;
  const headH = 9;
  const bodyH = 16;

  doc.setFontSize(6.2);
  let x = MARGIN;
  COLS.forEach((col) => {
    doc.rect(x, headY, col.width, headH);
    const lh = 2.6;
    const top = headY + headH / 2 - ((col.header.length - 1) * lh) / 2;
    col.header.forEach((ln, i) =>
      doc.text(ln, x + col.width / 2, top + i * lh, { align: "center", baseline: "middle" }));
    x += col.width;
  });

  const cells = [
    d.agencyRef,
    d.clientName,
    slashDate(d.requestDate),
    slashDate(d.checkIn),
    slashDate(d.checkOut),
    String(d.nights),
    d.roomOccupancy,
    d.roomType,
    String(d.pax),
  ];

  const bodyY = headY + headH;
  const midY = bodyY + bodyH / 2;
  doc.setFont("helvetica", "bold");
  x = MARGIN;
  cells.forEach((text, i) => {
    doc.rect(x, bodyY, COLS[i].width, bodyH);
    fitCentered(doc, text, x, COLS[i].width, midY, 9, COLS[i].maxLines);
    x += COLS[i].width;
  });

  // Amount cell: currency on the left, figure right-aligned (as in the form).
  // The figure's budget excludes the currency so a large amount cannot run into it.
  const amtW = COLS[COLS.length - 1].width;
  doc.rect(x, bodyY, amtW, bodyH);
  doc.setFontSize(9);
  doc.text(d.currency, x + 2.5, midY, { baseline: "middle" });
  const curTextW = doc.getTextWidth(d.currency);
  fitRight(doc, amount2(d.amount), x + amtW - 2.5, midY, 9, amtW - curTextW - 6);

  // ── Total box, right-aligned under the table ──────────────────────────────
  const totalY = bodyY + bodyH + 5;
  const curW = 14, valW = 26, totalH = 6;
  const totalX = MARGIN + TABLE_W - curW - valW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Total:", totalX - 3, totalY + totalH / 2, { align: "right", baseline: "middle" });
  doc.rect(totalX, totalY, curW, totalH);
  doc.rect(totalX + curW, totalY, valW, totalH);
  doc.text(d.currency, totalX + curW / 2, totalY + totalH / 2, { align: "center", baseline: "middle" });
  fitRight(doc, amount2(d.amount), totalX + curW + valW - 2.5, totalY + totalH / 2, 9, valW - 5);

  // ── Issued by / Issue date ────────────────────────────────────────────────
  const issuedX = MARGIN + TABLE_W - 60;
  let issuedY = totalY + totalH + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Issued by:", issuedX, issuedY);
  underline(doc, issuedX, issuedY, doc.getTextWidth("Issued by:"));
  doc.setFont("helvetica", "normal");
  doc.text(d.issuedBy || "—", issuedX + 22, issuedY);

  issuedY += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Issue date:", issuedX, issuedY);
  underline(doc, issuedX, issuedY, doc.getTextWidth("Issue date:"));
  const issueDate = slashDate(d.issueDate);
  doc.text(issueDate, issuedX + 22, issuedY);
  underline(doc, issuedX + 22, issuedY, doc.getTextWidth(issueDate));
}

/** Right-align text at `xRight`, shrinking to fit `maxW`. */
function fitRight(doc: Doc, text: string, xRight: number, yMid: number, size: number, maxW: number) {
  let fontSize = size;
  doc.setFontSize(fontSize);
  while (doc.getTextWidth(text) > maxW && fontSize > 5.5) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  doc.text(text, xRight, yMid, { align: "right", baseline: "middle" });
  doc.setFontSize(size);
}

/** Render one invoice as a standalone PDF. */
export async function buildJumboInvoicePdf(d: JumboInvoice): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawInvoice(doc, d);
  return new Uint8Array(doc.output("arraybuffer"));
}

/** File name for a single invoice: "{InvoiceNumber} INV {OperatorRef}.pdf". */
export function jumboInvoiceFileName(d: JumboInvoice): string {
  return `${safeFileName(`${d.invoiceNo} INV ${d.agencyRef}`)}.pdf`;
}

/**
 * Render every selected invoice as its own PDF and return them zipped.
 * Names inside the archive follow `jumboInvoiceFileName`; a duplicate name
 * (same booking listed twice) gets a numeric suffix so nothing is overwritten.
 */
export async function buildJumboInvoicesZip(invoices: JumboInvoice[]): Promise<Blob> {
  const used = new Map<string, number>();
  const entries: ZipEntry[] = [];
  for (const inv of invoices) {
    const base = jumboInvoiceFileName(inv);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    entries.push({
      name: seen ? base.replace(/\.pdf$/, ` (${seen + 1}).pdf`) : base,
      data: await buildJumboInvoicePdf(inv),
    });
  }
  return zipSync(entries);
}
