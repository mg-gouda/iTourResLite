// Pure materialization math (iTourResLite.md §5.2, improved rules). Unit-tested.
// Times are epoch ms at UTC midnight. Caller pre-filters bookings by status.
import type { MaterializationCell } from "@itour/shared";

export interface DayBooking { arr: number; dep: number; rooms: number }
export interface DayStop { from: number; to: number; qty: number }

export function computeCells(
  allocation: number,
  bookings: DayBooking[],
  stops: DayStop[],
  dayTimes: number[],
): { cells: MaterializationCell[]; totalAlloc: number; totalSold: number; totalSS: number; matPercent: number | null } {
  const cells: MaterializationCell[] = [];
  let totalAlloc = 0, totalSold = 0, totalSS = 0;

  for (const t of dayTimes) {
    let sold = 0;
    for (const b of bookings) if (b.arr <= t && b.dep > t) sold += b.rooms;

    let ssPos = 0, fullStop = false;
    for (const s of stops) {
      if (s.from <= t && s.to > t) {
        if (s.qty < 0) fullStop = true; // legacy sentinel: full hotel/room-type stop
        else ssPos += s.qty;
      }
    }
    const ss = fullStop ? allocation : ssPos;
    const avail = allocation - sold; // Avail = Alloc − Sold; SS shown separately
    cells.push({ date: new Date(t).toISOString().slice(0, 10), alloc: allocation, sold, ss, avail });
    totalAlloc += allocation; totalSold += sold; totalSS += ss;
  }

  return {
    cells,
    totalAlloc, totalSold, totalSS,
    matPercent: totalAlloc > 0 ? Math.round((totalSold / totalAlloc) * 10000) / 100 : null,
  };
}
