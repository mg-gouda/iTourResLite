// Display formatters (iTourResLite.md §5.1). Negatives in parentheses.
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Format any ISO date string or Date as dd-mmm-yy (e.g. "30-Jun-25"). Safe against timezone shift. */
export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const s = typeof v === "string" ? v : v.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s.slice(0, 10);
  return `${m[3]}-${MONTHS_SHORT[parseInt(m[2], 10) - 1]}-${m[1].slice(2)}`;
}

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", EGP: "E£" };

export function formatMoney(value: number | string, currency = "USD"): string {
  const v = typeof value === "string" ? parseFloat(value) : value;
  const x = Number.isFinite(v) ? v : 0;
  const body = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = `${SYMBOL[currency] ?? currency}${body}`;
  return x < 0 ? `(${s})` : s;
}

/** EBD % stored as fraction; display as percent with one decimal (0.05 → "5.0%"). */
export function formatPercent(fraction: number | string): string {
  const v = typeof fraction === "string" ? parseFloat(fraction) : fraction;
  const x = Number.isFinite(v) ? v : 0;
  return `${(x * 100).toFixed(1)}%`;
}
