/**
 * Derived-field calculators (iTourResLite.md §5.1). Single source of truth —
 * imported by the API (authoritative recompute) and the web client (live preview).
 * All money inputs accepted as number | string (Prisma Decimal serializes to string).
 */
const n = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  // Prisma Decimal serializes to a string over JSON (web client) but stays a
  // Decimal *object* server-side. `Number()` coerces every case (number,
  // string, Decimal); the old `: v` fell through for Decimal objects, and
  // `Number.isFinite(object)` is false, so all server-side P/L collapsed to 0.
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Whole nights = departure − arrival (date-only). */
export function nights(arrival: Date | string, departure: Date | string): number {
  const a = new Date(arrival), d = new Date(departure);
  const ms = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.max(0, Math.round(ms / 86_400_000));
}

export const plUsd = (costUsd: number | string, sellingUsd: number | string): number =>
  round2(n(sellingUsd) - n(costUsd));

/** EUR profit folds in Visa & Handling (legacy =(AC−AB)+AH). */
export const plEur = (
  costEur: number | string,
  sellingEur: number | string,
  visaHandling: number | string,
): number => round2(n(sellingEur) - n(costEur) + n(visaHandling));

export const plEgp = (costEgp: number | string, sellingEgp: number | string): number =>
  round2(n(sellingEgp) - n(costEgp));

export const ebdAmountUsd = (ebdPercent: number | string, costUsd: number | string): number =>
  round2(n(ebdPercent) * n(costUsd));

export const ebdAmountEur = (ebdPercent: number | string, costEur: number | string): number =>
  round2(n(ebdPercent) * n(costEur));

export const ebdAmountEgp = (ebdPercent: number | string, costEgp: number | string): number =>
  round2(n(ebdPercent) * n(costEgp));

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * The booking's single "own currency" P/L, used to decide profit/loss when a
 * booking carries figures in more than one currency. Picks the P/L of
 * `bookingCurrency` (GBP folded into USD, matching the cost-field mapping); if
 * that currency has no figures, falls back to whichever currency does.
 * Returns the P/L number, or `null` when the booking has no financial figures.
 */
export function effectivePl(b: {
  bookingCurrency?: string | null;
  costUsd: number | string; sellingUsd: number | string;
  costEur: number | string; sellingEur: number | string;
  costEgp: number | string; sellingEgp: number | string;
  visaHandling: number | string;
}): number | null {
  const byCur: Record<"USD" | "EUR" | "EGP", { pl: number; has: boolean }> = {
    USD: { pl: plUsd(b.costUsd, b.sellingUsd), has: n(b.costUsd) !== 0 || n(b.sellingUsd) !== 0 },
    EUR: { pl: plEur(b.costEur, b.sellingEur, b.visaHandling), has: n(b.costEur) !== 0 || n(b.sellingEur) !== 0 },
    EGP: { pl: plEgp(b.costEgp, b.sellingEgp), has: n(b.costEgp) !== 0 || n(b.sellingEgp) !== 0 },
  };
  const cur = (b.bookingCurrency ?? "").toUpperCase();
  const primary = cur === "GBP" ? "USD" : (["USD", "EUR", "EGP"] as const).find((c) => c === cur);
  if (primary && byCur[primary].has) return byCur[primary].pl;
  const fallback = (["USD", "EUR", "EGP"] as const).find((c) => byCur[c].has);
  if (fallback) return byCur[fallback].pl;
  if (primary) return byCur[primary].pl; // currency chosen but zero figures → 0
  return null;
}

export interface DerivedBookingFields {
  nights: number;
  plUsd: number;
  plEur: number;
  plEgp: number;
  ebdAmountUsd: number;
  ebdAmountEur: number;
  ebdAmountEgp: number;
}

export function deriveBooking(b: {
  arrivalDate: Date | string;
  departureDate: Date | string;
  costUsd: number | string;
  sellingUsd: number | string;
  costEur: number | string;
  sellingEur: number | string;
  costEgp?: number | string;
  sellingEgp?: number | string;
  visaHandling: number | string;
  ebdPercent: number | string;
}): DerivedBookingFields {
  return {
    nights: nights(b.arrivalDate, b.departureDate),
    plUsd: plUsd(b.costUsd, b.sellingUsd),
    plEur: plEur(b.costEur, b.sellingEur, b.visaHandling),
    plEgp: plEgp(b.costEgp ?? 0, b.sellingEgp ?? 0),
    ebdAmountUsd: ebdAmountUsd(b.ebdPercent, b.costUsd),
    ebdAmountEur: ebdAmountEur(b.ebdPercent, b.costEur),
    ebdAmountEgp: ebdAmountEgp(b.ebdPercent, b.costEgp ?? 0),
  };
}
