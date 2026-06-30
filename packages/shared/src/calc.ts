/**
 * Derived-field calculators (iTourResLite.md §5.1). Single source of truth —
 * imported by the API (authoritative recompute) and the web client (live preview).
 * All money inputs accepted as number | string (Prisma Decimal serializes to string).
 */
const n = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const x = typeof v === "string" ? parseFloat(v) : v;
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

export const ebdAmountUsd = (ebdPercent: number | string, costUsd: number | string): number =>
  round2(n(ebdPercent) * n(costUsd));

export const ebdAmountEur = (ebdPercent: number | string, costEur: number | string): number =>
  round2(n(ebdPercent) * n(costEur));

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export interface DerivedBookingFields {
  nights: number;
  plUsd: number;
  plEur: number;
  ebdAmountUsd: number;
  ebdAmountEur: number;
}

export function deriveBooking(b: {
  arrivalDate: Date | string;
  departureDate: Date | string;
  costUsd: number | string;
  sellingUsd: number | string;
  costEur: number | string;
  sellingEur: number | string;
  visaHandling: number | string;
  ebdPercent: number | string;
}): DerivedBookingFields {
  return {
    nights: nights(b.arrivalDate, b.departureDate),
    plUsd: plUsd(b.costUsd, b.sellingUsd),
    plEur: plEur(b.costEur, b.sellingEur, b.visaHandling),
    ebdAmountUsd: ebdAmountUsd(b.ebdPercent, b.costUsd),
    ebdAmountEur: ebdAmountEur(b.ebdPercent, b.costEur),
  };
}
