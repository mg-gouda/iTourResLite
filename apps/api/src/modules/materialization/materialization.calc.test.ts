import { describe, it, expect } from "vitest";
import { computeCells } from "./materialization.calc";

const day = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

describe("materialization computeCells (improved rules)", () => {
  const days = [day("2026-01-01"), day("2026-01-02"), day("2026-01-03")];

  it("Sold counts rooms in-house: arrival <= day < departure", () => {
    // Booking occupies Jan 1 and Jan 2 (dep Jan 3 excluded).
    const r = computeCells(10, [{ arr: day("2026-01-01"), dep: day("2026-01-03"), rooms: 2 }], [], days);
    expect(r.cells.map((c) => c.sold)).toEqual([2, 2, 0]);
  });

  it("Avail = Alloc - Sold (SS shown separately, not subtracted)", () => {
    const r = computeCells(
      10,
      [{ arr: day("2026-01-01"), dep: day("2026-01-02"), rooms: 3 }],
      [{ from: day("2026-01-01"), to: day("2026-01-02"), qty: 2 }],
      days,
    );
    expect(r.cells[0]).toMatchObject({ alloc: 10, sold: 3, ss: 2, avail: 7 });
  });

  it("negative stop-sale qty = full stop (ss = allocation, avail = alloc - sold)", () => {
    const r = computeCells(8, [], [{ from: day("2026-01-01"), to: day("2026-01-02"), qty: -1 }], days);
    expect(r.cells[0]).toMatchObject({ ss: 8, avail: 8 });
  });

  it("Mat% = totalSold / totalAlloc * 100", () => {
    const r = computeCells(10, [{ arr: day("2026-01-01"), dep: day("2026-01-04"), rooms: 5 }], [], days);
    // sold each day = 5, three days → 15 / 30 = 50%
    expect(r.totalSold).toBe(15);
    expect(r.totalAlloc).toBe(30);
    expect(r.matPercent).toBe(50);
  });

  it("Mat% null when allocation is 0", () => {
    const r = computeCells(0, [], [], days);
    expect(r.matPercent).toBeNull();
  });

  it("over-allotment yields negative availability", () => {
    const r = computeCells(2, [{ arr: day("2026-01-01"), dep: day("2026-01-02"), rooms: 5 }], [], days);
    expect(r.cells[0].avail).toBe(-3);
  });
});
