"use client";

// Renderer for the "Fulvago Travel Accommodation invoice" form issued to
// Jumboline — the layout of the manually-produced Docs/*.pdf reference. One
// invoice per booking, all of them in a single print document (one page each)
// so the whole batch saves as one PDF.

import { FULVAGO_LOGO_DATA_URI } from "./invoice-logo";

export interface JumboInvoice {
  invoiceNo: string;      // {yyyy}0000
  agencyRef: string;      // operator booking reference
  clientName: string;     // lead guest, e.g. "Mr CHRISTOPHE PERUFFO"
  requestDate: string;    // ISO yyyy-mm-dd — booking date
  checkIn: string;        // ISO yyyy-mm-dd
  checkOut: string;       // ISO yyyy-mm-dd
  nights: number;
  roomOccupancy: string;  // e.g. "DBL" or "2 x DBL"
  roomType: string;       // e.g. "Comfort room"
  pax: number;
  currency: string;       // USD / EUR / EGP / GBP
  amount: number;         // selling total, booking currency
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// m/d/yyyy with no leading zeros — matches the reference form ("7/8/2026").
function slashDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : "—";
}

function amount2(n: number): string {
  const [int, dec] = (Number.isFinite(n) ? n : 0).toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
}

function renderPage(d: JumboInvoice): string {
  return `
  <div class="page">
    <img class="logo" src="${FULVAGO_LOGO_DATA_URI}" alt="Fulvago Travel" />

    <div class="seller">
      <div>Fulvago Travel</div>
      <div>VAT 200-265-075</div>
      <div>Address office no. 1303,</div>
      <div>El-Kawther, infront of Hurghada airport,</div>
      <div>Hurghada, Red Sea,</div>
      <div>Egypt</div>
    </div>

    <div class="billto">
      <div>Invoice to:&nbsp; (07009) Palma de Mallorca - Spain.</div>
      <div>JUMBOLINE ACCOMMODATIONS &amp; SERVICES S.L.U.,</div>
      <div>VAT 856619968</div>
      <div>Address Gran Via Asima, 4 , Poligono Son Castello,</div>
      <div>(07009) Palma de Mallorca - Spain.</div>
    </div>

    <table class="refbox">
      <tr><th>Invoice Number</th><td>${esc(d.invoiceNo)}</td></tr>
      <tr><th>Arrival date</th><td>${slashDate(d.checkIn)}</td></tr>
    </table>

    <div class="doctitle">Fulvago Travel Accommodation invoice</div>

    <table class="items">
      <thead>
        <tr>
          <th class="w-ref">Agency reference</th>
          <th class="w-client">Client Name</th>
          <th>Request date</th>
          <th>Check in</th>
          <th>Check out</th>
          <th class="w-nights">Nights</th>
          <th>Room Occupancy</th>
          <th>Room Type</th>
          <th class="w-pax">Pax</th>
          <th class="w-amount" colspan="2">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="strong">${esc(d.agencyRef)}</td>
          <td class="strong">${esc(d.clientName)}</td>
          <td class="strong">${slashDate(d.requestDate)}</td>
          <td class="strong">${slashDate(d.checkIn)}</td>
          <td class="strong">${slashDate(d.checkOut)}</td>
          <td class="strong">${d.nights}</td>
          <td class="strong">${esc(d.roomOccupancy)}</td>
          <td class="strong">${esc(d.roomType)}</td>
          <td class="strong">${d.pax}</td>
          <td class="cur">${esc(d.currency)}</td>
          <td class="amt">${amount2(d.amount)}</td>
        </tr>
      </tbody>
    </table>

    <table class="totalbox">
      <tr>
        <td class="lbl">Total:</td>
        <td class="cur">${esc(d.currency)}</td>
        <td class="amt">${amount2(d.amount)}</td>
      </tr>
    </table>

    <div class="issued">
      <div><span class="u">Issued by:</span></div>
      <div><span class="u">Issue date:</span> <span class="issue-date">${slashDate(d.checkIn)}</span></div>
    </div>
  </div>`;
}

/** Build one print-ready document holding every invoice, one per page. */
export function buildJumboInvoicesHtml(invoices: JumboInvoice[]): string {
  const title = invoices.length === 1
    ? `${invoices[0].invoiceNo} INV ${invoices[0].agencyRef}`
    : `Jumbo Invoices (${invoices.length})`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Calibri, Arial, Helvetica, sans-serif;
    color: #000;
    font-size: 11px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: 210mm; padding: 12mm 10mm; page-break-after: always; position: relative; }
  .page:last-child { page-break-after: auto; }
  .logo { height: 62px; width: auto; display: block; margin: 4mm 0 6mm 8mm; }
  .seller { line-height: 1.5; margin-left: 4mm; }
  .billto { line-height: 1.5; margin: 5mm 0 0 95mm; }
  table.refbox { border-collapse: collapse; margin: 6mm 0 0 4mm; }
  table.refbox th, table.refbox td { border: 1px solid #000; padding: 2px 6px; font-size: 11px; }
  table.refbox th { text-align: left; font-weight: 700; width: 34mm; }
  table.refbox td { text-align: center; font-weight: 700; width: 40mm; }
  .doctitle { text-align: center; font-weight: 700; text-decoration: underline; margin: 7mm 0 3mm; }
  table.items { border-collapse: collapse; width: 100%; }
  table.items th, table.items td { border: 1px solid #000; padding: 4px 5px; text-align: center; vertical-align: middle; }
  table.items thead th { font-size: 8px; font-weight: 700; }
  table.items tbody td { height: 16mm; font-size: 11px; }
  table.items tbody td.strong { font-weight: 700; }
  table.items td.cur, table.items td.amt { font-weight: 700; }
  table.items td.cur { border-right: none; text-align: center; }
  table.items td.amt { border-left: none; text-align: right; padding-right: 8px; }
  table.items th.w-ref { width: 13%; }
  table.items th.w-client { width: 18%; }
  table.items th.w-nights { width: 5%; }
  table.items th.w-pax { width: 5%; }
  table.items th.w-amount { width: 13%; }
  table.totalbox { border-collapse: collapse; margin: 4mm 0 0 auto; }
  table.totalbox td { border: 1px solid #000; padding: 2px 6px; font-weight: 700; }
  table.totalbox td.lbl { border: none; text-align: right; width: 26mm; }
  table.totalbox td.cur { text-align: center; width: 14mm; }
  table.totalbox td.amt { text-align: right; width: 26mm; }
  .issued { margin: 5mm 0 0 auto; width: 60mm; line-height: 1.9; font-weight: 700; }
  .issued .u { text-decoration: underline; }
  .issued .issue-date { text-decoration: underline; margin-left: 8mm; }
  @page { size: A4; margin: 8mm; }
  @media print { .page { width: auto; padding: 0; } }
</style>
</head>
<body>
${invoices.map(renderPage).join("\n")}
</body>
</html>`;
}

/**
 * Open the whole batch in one window and trigger the print dialog (Save as PDF).
 * Returns true when the window opened, false when the popup was blocked.
 */
export function openJumboInvoices(invoices: JumboInvoice[]): boolean {
  if (!invoices.length) return true;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(buildJumboInvoicesHtml(invoices));
  w.document.close();
  const trigger = () => { try { w.focus(); w.print(); } catch { /* window closed */ } };
  if (w.document.readyState === "complete") setTimeout(trigger, 400);
  else w.addEventListener("load", () => setTimeout(trigger, 400));
  return true;
}
