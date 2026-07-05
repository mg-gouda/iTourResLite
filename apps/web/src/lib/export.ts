// Shared PDF + Excel export for reports and the bookings list.
// Both formats embed the company logo (from Company Settings → SystemConfig
// `companyLogo`, a base64 data URL) when it is a raster image (PNG/JPEG).
// Libraries (jspdf, jspdf-autotable, exceljs) are dynamically imported so they
// stay out of the initial bundle and only load on the user's first export.

import { get } from "@/lib/api";

export interface ExportSpec {
  /** Report title shown in the header of the exported file. */
  title: string;
  /** Base file name, without extension (e.g. "booking-finance"). */
  filename: string;
  /** Column header labels. */
  columns: string[];
  /** Row cells, aligned to `columns`. */
  rows: (string | number)[][];
  /** Per-column alignment; defaults to "left". */
  aligns?: ("left" | "right")[];
}

interface CompanyInfo {
  companyName: string;
  companyLogo: string | null; // data URL or null
}

let cachedCompany: CompanyInfo | null = null;
async function companyInfo(): Promise<CompanyInfo> {
  if (cachedCompany) return cachedCompany;
  try {
    const cfg = await get<Record<string, string>>("/system-config");
    cachedCompany = {
      companyName: cfg?.companyName || "iTourResLite",
      companyLogo: cfg?.companyLogo || null,
    };
  } catch {
    cachedCompany = { companyName: "iTourResLite", companyLogo: null };
  }
  return cachedCompany;
}

// jsPDF/ExcelJS addImage only support raster formats — skip SVG data URLs.
function rasterKind(dataUrl: string | null): "PNG" | "JPEG" | null {
  if (!dataUrl) return null;
  if (/^data:image\/png/i.test(dataUrl)) return "PNG";
  if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  return null;
}

function imgSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportToPdf(spec: ExportSpec): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { companyName, companyLogo } = await companyInfo();

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const kind = rasterKind(companyLogo);
  if (kind && companyLogo) {
    try {
      const { w, h } = await imgSize(companyLogo);
      const dispH = 14;
      const dispW = Math.min(50, (w / h) * dispH);
      doc.addImage(companyLogo, kind, 12, 8, dispW, dispH);
    } catch {
      /* ignore a broken logo — export still proceeds */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName, pageW - 12, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(spec.title, pageW - 12, 21, { align: "right" });

  const columnStyles: Record<number, { halign: "left" | "right" }> = {};
  (spec.aligns ?? []).forEach((a, i) => {
    if (a === "right") columnStyles[i] = { halign: "right" };
  });

  autoTable(doc, {
    head: [spec.columns],
    body: spec.rows.map((r) => r.map((c) => (c == null ? "" : String(c)))),
    startY: 28,
    margin: { left: 12, right: 12 },
    styles: { fontSize: 7, cellPadding: 1.4, overflow: "linebreak" },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [243, 246, 251] },
    columnStyles,
  });

  doc.save(`${spec.filename}.pdf`);
}

export async function exportToExcel(spec: ExportSpec): Promise<void> {
  const mod: any = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const { companyName, companyLogo } = await companyInfo();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  const ncols = spec.columns.length;

  let r = 1;
  const kind = rasterKind(companyLogo);
  if (kind && companyLogo) {
    const raw = companyLogo.substring(companyLogo.indexOf(",") + 1);
    const imageId = wb.addImage({ base64: raw, extension: kind === "PNG" ? "png" : "jpeg" });
    ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 130, height: 48 } });
    ws.getRow(1).height = 38;
    r = 3;
  }

  // Title row (company + report name)
  ws.mergeCells(r, 1, r, Math.max(1, ncols));
  const titleCell = ws.getCell(r, 1);
  titleCell.value = `${companyName} — ${spec.title}`;
  titleCell.font = { bold: true, size: 14 };
  r += 2;

  // Header row
  const headerRow = ws.getRow(r);
  spec.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: spec.aligns?.[i] === "right" ? "right" : "left" };
  });
  headerRow.commit();
  r += 1;

  // Data rows
  spec.rows.forEach((row) => {
    const excelRow = ws.getRow(r);
    row.forEach((v, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = v as any;
      if (spec.aligns?.[i] === "right") cell.alignment = { horizontal: "right" };
    });
    excelRow.commit();
    r += 1;
  });

  // Column widths from content length
  spec.columns.forEach((c, i) => {
    let max = c.length;
    for (const row of spec.rows) {
      const s = row[i] == null ? "" : String(row[i]);
      if (s.length > max) max = s.length;
    }
    ws.getColumn(i + 1).width = Math.min(42, Math.max(10, max + 2));
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${spec.filename}.xlsx`,
  );
}

/** Convenience: a small reusable pair of export handlers for a report page. */
export function makeExporters(build: () => ExportSpec) {
  return {
    pdf: () => exportToPdf(build()),
    excel: () => exportToExcel(build()),
  };
}
