"use client";

// SOA Statement — the raw statement grid sent to Jumbo, exported exactly as the
// accounting workflow expects it: header row 1 with an autofilter, data from
// row 2, no logo or title banner (unlike the branded `lib/export.ts` reports).
// ExcelJS is imported dynamically so it stays out of the initial bundle.

export interface SoaRow {
  supplierInvoiceNo: string;  // jumboInvoiceNo — blank until issued
  roomType: string;           // printed under the source file's "Supplier Confirmation No" header
  clientRefNo: string;        // operator (Jumbo) booking reference
  amount: number;             // selling total in the booking currency
  currency: string;
  invoiceDate: string;        // ISO yyyy-mm-dd — the arrival date
  invoiceDueDate: string;     // ISO yyyy-mm-dd — arrival + 45 days, stored on the booking
}

/** Column headers, in the order of the statement supplied by accounting. */
export const SOA_COLUMNS = [
  "Supplier Invoice No",
  "Supplier Confirmation No",
  "Client Ref No",
  "Invoice Amount",
  "Tax Amount",
  "Tax Rate",
  "Tax Type",
  "Currency",
  "Invoice Date",
  "Invoice Due Date",
  "Invoice Type",
] as const;

/** Tax is always nil for this operator — the columns exist for the recipient's system. */
export const SOA_TAX_AMOUNT = 0;
export const SOA_TAX_RATE = 0;
export const SOA_TAX_TYPE = "VAT";

/**
 * An ISO yyyy-mm-dd as a UTC-midnight Date. ExcelJS converts a Date straight
 * from its UTC epoch (`25569 + t/86400000`), so a UTC-midnight value lands on
 * exactly that calendar day in the sheet regardless of the browser's timezone.
 */
function utcDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

/** dd.mm.yyyy — the date stamped into the report name ("… TILL 31.09.2026"). */
export function dotDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/**
 * Report name for the current filters. The date is the end of the due-date
 * range, falling back to the arrival range when only that is set.
 */
export function soaReportName(dueTo: string, arrivalTo: string): string {
  const stamp = dotDate(dueTo) || dotDate(arrivalTo);
  return stamp ? `SOA INVOICES DUE DATE TILL ${stamp}` : "SOA Statement";
}

function downloadBlob(blob: Blob, filename: string) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportSoaStatementExcel(rows: SoaRow[], reportName: string): Promise<void> {
  const mod: any = await import("exceljs");
  const ExcelJS = mod.default ?? mod;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SOA Statement");

  const header = ws.getRow(1);
  SOA_COLUMNS.forEach((label, i) => {
    const cell = header.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  header.commit();

  rows.forEach((r, idx) => {
    const row = ws.getRow(idx + 2);
    row.getCell(1).value = r.supplierInvoiceNo || "";
    row.getCell(2).value = r.roomType || "";
    row.getCell(3).value = r.clientRefNo || "";
    row.getCell(4).value = r.amount;
    row.getCell(5).value = SOA_TAX_AMOUNT;
    row.getCell(6).value = SOA_TAX_RATE;
    row.getCell(7).value = SOA_TAX_TYPE;
    row.getCell(8).value = r.currency || "";
    const invoiceDate = utcDate(r.invoiceDate);
    if (invoiceDate) {
      row.getCell(9).value = invoiceDate;
      row.getCell(9).numFmt = "dd/mm/yyyy";
    }
    const dueDate = utcDate(r.invoiceDueDate);
    if (dueDate) {
      row.getCell(10).value = dueDate;
      row.getCell(10).numFmt = "yyyy-mm-dd";
    }
    // "Invoice Type" (column 11) is intentionally blank — kept so the sheet
    // matches the layout the recipient's system imports.
    row.commit();
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: SOA_COLUMNS.length } };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Column widths from the widest cell in each column.
  const widthOf = (r: SoaRow, col: number): number => {
    switch (col) {
      case 1: return r.supplierInvoiceNo.length;
      case 2: return r.roomType.length;
      case 3: return r.clientRefNo.length;
      case 4: return String(r.amount).length;
      case 8: return r.currency.length;
      case 9: case 10: return 10;
      default: return 5;
    }
  };
  SOA_COLUMNS.forEach((label, i) => {
    const max = rows.reduce((m, r) => Math.max(m, widthOf(r, i + 1)), label.length);
    ws.getColumn(i + 1).width = Math.min(42, Math.max(10, max + 2));
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${reportName}.xlsx`,
  );
}
