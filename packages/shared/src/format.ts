// Display formatters (iTourResLite.md §5.1). Negatives in parentheses.
import type { Currency } from "./enums";

const SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£", EGP: "E£" };

export function formatMoney(value: number | string, currency: Currency = "USD"): string {
  const v = typeof value === "string" ? parseFloat(value) : value;
  const x = Number.isFinite(v) ? v : 0;
  const body = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = `${SYMBOL[currency]}${body}`;
  return x < 0 ? `(${s})` : s;
}

/** EBD % stored as fraction; display as percent with one decimal (0.05 → "5.0%"). */
export function formatPercent(fraction: number | string): string {
  const v = typeof fraction === "string" ? parseFloat(fraction) : fraction;
  const x = Number.isFinite(v) ? v : 0;
  return `${(x * 100).toFixed(1)}%`;
}
