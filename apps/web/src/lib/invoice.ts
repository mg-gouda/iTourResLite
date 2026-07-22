"use client";

import { formatMoney } from "@itour/shared";

// Fulvago Travel logo (350×64 JPEG) inlined so the printed invoice is fully
// self-contained — no network fetch inside the popup print window.
import { FULVAGO_LOGO_DATA_URI } from "./invoice-logo";

export interface InvoiceLine {
  hotelName: string;
  roomTypeLabel: string;     // e.g. "Single Room"
  roomCategoryLabel: string; // occupancy, e.g. "Single"
  mealBasisLabel: string;    // e.g. "Soft All Inc"
  nationality: string;       // market name + alias, e.g. "Egyptian (EGY)"
  arrivalDate: string;       // ISO yyyy-mm-dd
  departureDate: string;     // ISO yyyy-mm-dd
  nights: number;
  qty: number;               // rooms represented by this line
  amount: number;            // line amount (selling), booking currency
  roomLabel?: string;        // e.g. "Room 1" (multi-room, all-in-one invoice)
}

export interface InvoiceData {
  invoiceNo: string;
  currency: string;          // USD / EUR / EGP / GBP
  issueDate: string;         // ISO yyyy-mm-dd
  dueDate: string;           // ISO yyyy-mm-dd
  billToName: string;        // lead guest (title + name)
  guestNames: string[];      // all guest names (lead first)
  lines: InvoiceLine[];
  discountPercent: number;   // 0..1 (0 = no discount row)
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// dd-mm-yy (matches the sample's "20-06-26")
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}-${m[2]}-${m[1].slice(2)}` : "—";
}

// dd/mm/yyyy (matches the sample's "22/06/2026")
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

function buildDescription(l: InvoiceLine): string {
  const room = [l.roomTypeLabel, l.roomCategoryLabel && l.roomCategoryLabel !== l.roomTypeLabel ? `(${l.roomCategoryLabel})` : ""]
    .filter(Boolean).join(" ");
  const nightsTxt = `${l.nights}x night${l.nights === 1 ? "" : "s"}`;
  const parts = [
    l.roomLabel ? `${l.roomLabel}:` : "",
    room || "Accommodation",
    l.mealBasisLabel ? `on ${l.mealBasisLabel} Basis` : "",
    l.hotelName ? `at ${l.hotelName}` : "",
  ].filter(Boolean).join(" ");
  return `${parts}, ${nightsTxt}`;
}

function renderLine(l: InvoiceLine, money: (n: number) => string): string {
  const qty = l.qty > 0 ? l.qty : 1;
  const unitPrice = l.amount / qty;
  const subLines = [
    `Arrival Date: ${longDate(l.arrivalDate)}`,
    `Departure Date: ${longDate(l.departureDate)}`,
    l.nationality ? `Nationality: ${l.nationality}` : "",
  ].filter(Boolean);
  return `
        <tr>
          <td>
            <div class="desc-main">${esc(buildDescription(l))}</div>
            ${subLines.map((s) => `<div class="desc-sub">${esc(s)}</div>`).join("")}
          </td>
          <td class="num">${qty}</td>
          <td class="num">${money(unitPrice)}</td>
          <td class="num">Inc.</td>
          <td class="num">${money(l.amount)}</td>
        </tr>`;
}

/** Build the standalone invoice HTML document (self-contained, print-ready). */
export function buildInvoiceHtml(d: InvoiceData): string {
  const cur = d.currency || "USD";
  const lines = d.lines.length ? d.lines : [];
  const money = (n: number) => formatMoney(n, cur);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const totalQty = lines.reduce((s, l) => s + (l.qty > 0 ? l.qty : 1), 0);
  const discountAmount = subtotal * (d.discountPercent || 0);
  const total = subtotal - discountAmount;
  const amountDue = total;

  const guests = d.guestNames.filter(Boolean);
  const billToBlock = guests.length
    ? guests.map((g, i) => `<div class="${i === 0 ? "billto-name" : "billto-extra"}">${esc(g)}</div>`).join("")
    : `<div class="billto-name">${esc(d.billToName || "—")}</div>`;

  const discountRow = d.discountPercent
    ? `<tr><td class="lbl">Discounts:</td><td class="pct">${(d.discountPercent * 100).toFixed(0)}%</td><td class="val">${money(discountAmount)}</td></tr>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(d.invoiceNo)} ${esc(cur)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-size: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 36px; position: relative; min-height: 100vh; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; }
  .head h1 { font-size: 30px; font-weight: 800; letter-spacing: .5px; margin: 0; }
  .head img { height: 34px; width: auto; }
  .meta { display: grid; grid-template-columns: 130px 1fr; row-gap: 3px; margin-bottom: 26px; }
  .meta .k { color: #333; }
  .meta .v { font-weight: 600; }
  .meta .invno { color: #8B0000; font-weight: 700; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 34px; }
  .seller { line-height: 1.55; }
  .seller .name { font-weight: 600; }
  .billto { min-width: 240px; }
  .billto .title { color: #333; margin-bottom: 4px; }
  .billto-name { font-weight: 600; }
  .billto-extra { color: #333; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead th {
    text-align: left; font-weight: 600; border-bottom: 2px solid #111;
    padding: 6px 8px; font-size: 12px;
  }
  table.items thead th.num, table.items tbody td.num { text-align: right; }
  table.items tbody td { padding: 10px 8px; vertical-align: top; }
  .desc-sub { color: #333; margin-top: 2px; }
  .items-foot td { border-top: 1px solid #bbb; border-bottom: 1px solid #bbb; padding: 8px; }
  .summary { width: 300px; margin-left: auto; margin-top: 40px; }
  .summary table { width: 100%; border-collapse: collapse; }
  .summary td { padding: 6px 8px; border-bottom: 1px solid #ccc; }
  .summary td.lbl { color: #222; }
  .summary td.pct { text-align: left; color: #333; width: 60px; }
  .summary td.val { text-align: right; }
  .summary tr.total td { font-weight: 700; border-bottom: none; }
  .foot { position: absolute; bottom: 24px; right: 36px; color: #555; font-size: 11px; }
  @page { size: A4; margin: 12mm; }
  @media print { .page { padding: 0; min-height: auto; } .foot { position: fixed; } }
</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <h1>INVOICE</h1>
      <img src="${FULVAGO_LOGO_DATA_URI}" alt="Fulvago Travel" />
    </div>

    <div class="meta">
      <div class="k">Invoice Number:</div><div class="v invno">${esc(d.invoiceNo)}</div>
      <div class="k">Issue Date:</div><div class="v">${shortDate(d.issueDate)}</div>
      <div class="k">Due Date:</div><div class="v">${shortDate(d.dueDate)}</div>
    </div>

    <div class="parties">
      <div class="seller">
        <div class="name">Fulvago Travel</div>
        <div>Suite 1303, 4th Floor</div>
        <div>Metro St., El Kawthar,</div>
        <div>Hurghada</div>
        <div>Red Sea,</div>
        <div>Egypt.</div>
      </div>
      <div class="billto">
        <div class="title">Bill To</div>
        ${billToBlock}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">QTY</th>
          <th class="num">Unit Price</th>
          <th class="num">Tax</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((l) => renderLine(l, money)).join("")}
        <tr class="items-foot">
          <td></td>
          <td class="num">${totalQty}</td>
          <td class="num"></td>
          <td class="num">Inc.</td>
          <td class="num">${money(subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      <table>
        <tr><td class="lbl">Subtotal:</td><td class="pct"></td><td class="val">${money(subtotal)}</td></tr>
        ${discountRow}
        <tr><td class="lbl">Total:</td><td class="pct"></td><td class="val">${money(total)}</td></tr>
        <tr class="total"><td class="lbl">Amount Due:</td><td class="pct"></td><td class="val">${money(amountDue)}</td></tr>
      </table>
    </div>

    <div class="foot">Page 1 of 1</div>
  </div>
</body>
</html>`;
}

/**
 * Open one or more invoices and trigger the browser print dialog (Save as PDF).
 * Each InvoiceData opens in its own window so the user can save separate PDFs.
 * Returns the number of windows that were blocked (0 = all opened).
 */
export function openInvoices(invoices: InvoiceData[]): number {
  let blocked = 0;
  invoices.forEach((d) => {
    const html = buildInvoiceHtml(d);
    const w = window.open("", "_blank");
    if (!w) { blocked++; return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    const trigger = () => { try { w.focus(); w.print(); } catch { /* window closed */ } };
    if (w.document.readyState === "complete") setTimeout(trigger, 300);
    else w.addEventListener("load", () => setTimeout(trigger, 300));
  });
  return blocked;
}

/** Convenience wrapper for a single invoice. */
export function openInvoice(d: InvoiceData): boolean {
  return openInvoices([d]) === 0;
}
