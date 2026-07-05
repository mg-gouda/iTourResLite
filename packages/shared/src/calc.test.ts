import { describe, it, expect } from "vitest";
import { nights, plUsd, plEur, ebdAmountUsd, ebdAmountEur, deriveBooking } from "./calc";
import { formatMoney, formatPercent } from "./format";

describe("booking calculators (legacy workbook values)", () => {
  it("nights = departure - arrival (whole days)", () => {
    // Workbook row 1: arr serial 45937, dep 45946 → NTS 9
    expect(nights("2025-10-01", "2025-10-10")).toBe(9);
    expect(nights("2025-10-01", "2025-10-01")).toBe(0);
  });

  it("P/L USD = selling - cost", () => {
    expect(plUsd(1000, 1200)).toBe(200);
    expect(plUsd(0, 0)).toBe(0);
  });

  it("P/L EUR folds in Visa & Handling: (selling - cost) + visa", () => {
    // Workbook row 1: costEur 1071, sellingEur 837, visa 0 → P/L EUR -234
    expect(plEur(1071, 837, 0)).toBe(-234);
    expect(plEur(1000, 1200, 50)).toBe(250);
  });

  it("coerces Prisma Decimal objects (server-side), not just numbers/strings", () => {
    // Regression: Prisma returns Decimal *objects* on the API. `n()` used to
    // fall through to `Number.isFinite(object) === false` → every P/L was 0.
    const decimal = (s: string) => ({ toString: () => s, valueOf: () => s });
    expect(plUsd(decimal("1455"), decimal("1516.6"))).toBe(61.6);
    expect(plEur(decimal("1455"), decimal("1516.6"), decimal("0"))).toBe(61.6);
  });

  it("EBD amounts = percent (fraction) * cost", () => {
    expect(ebdAmountUsd(0.05, 1000)).toBe(50);
    expect(ebdAmountEur(0.27, 940.24)).toBe(253.86);
  });

  it("deriveBooking aggregates all derived fields", () => {
    const d = deriveBooking({
      arrivalDate: "2025-10-01", departureDate: "2025-10-10",
      costUsd: 0, sellingUsd: 0, costEur: 1071, sellingEur: 837,
      visaHandling: 0, ebdPercent: 0.05,
    });
    expect(d).toEqual({ nights: 9, plUsd: 0, plEur: -234, ebdAmountUsd: 0, ebdAmountEur: 53.55 });
  });
});

describe("formatters", () => {
  it("money: symbol + thousands, negatives in parentheses", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(-234, "EUR")).toBe("(€234.00)");
  });
  it("percent: fraction → one decimal", () => {
    expect(formatPercent(0.05)).toBe("5.0%");
    expect(formatPercent(0.27)).toBe("27.0%");
  });
});
