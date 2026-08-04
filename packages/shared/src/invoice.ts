/**
 * Operator invoicing — the facts shared by the Jumbo Invoices report (which
 * issues the invoice numbers) and the SOA Statement report (which lists them).
 */

/** The operator these invoices are issued to (JUMBOLINE ACCOMMODATIONS & SERVICES S.L.U.). */
export const JUMBO_OPERATOR_CODE = "JMB";

/** Only Confirmed bookings are invoiced. */
export const JUMBO_INVOICE_STATUS = "Confirmed";

/** Payment terms: an operator invoice falls due 45 days after arrival. */
export const INVOICE_DUE_DAYS = 45;

/**
 * Due date of the invoice for a stay arriving on `arrival` — arrival + 45 days.
 * Computed in UTC so the stored date-only value never shifts a day across the
 * server's timezone (arrival dates are stored as UTC midnight).
 */
export function invoiceDueDate(arrival: Date | string): Date {
  const a = new Date(arrival);
  return new Date(Date.UTC(
    a.getUTCFullYear(),
    a.getUTCMonth(),
    a.getUTCDate() + INVOICE_DUE_DAYS,
  ));
}

/**
 * The booking's selling total in its own currency — the figure printed as
 * "Total" on the Fulvago invoice, so the statement reconciles with the PDFs.
 * GBP shares the USD selling column (see the booking form's currency handling);
 * a missing currency is inferred from whichever selling figure is populated.
 */
export function invoiceAmount(b: {
  bookingCurrency?: string | null;
  sellingUsd: number | string;
  sellingEur: number | string;
  sellingEgp?: number | string | null;
}): { currency: string; amount: number } {
  const num = (v: number | string | null | undefined) => {
    const x = typeof v === "string" ? parseFloat(v) : Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
  };
  const currency = b.bookingCurrency
    || (num(b.sellingEur) ? "EUR" : num(b.sellingEgp) ? "EGP" : "USD");
  const amount = currency === "EUR" ? num(b.sellingEur)
    : currency === "EGP" ? num(b.sellingEgp) : num(b.sellingUsd);
  return { currency, amount };
}
