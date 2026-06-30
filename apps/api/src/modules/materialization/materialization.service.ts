import { Injectable, NotFoundException } from "@nestjs/common";
import type { MaterializationGrid, MaterializationRow } from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { computeCells } from "./materialization.calc";

// Statuses excluded from "Sold" (improved rule — confirmed with business).
const EXCLUDED = ["CXL", "NoShow"] as const;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (cur.getTime() <= end) {
    out.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

@Injectable()
export class MaterializationService {
  constructor(private prisma: PrismaService) {}

  async grid(hotelId: string, from: Date, to: Date): Promise<MaterializationGrid> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { roomTypes: { where: { active: true }, orderBy: { name: "asc" } } },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");

    const days = eachDay(from, to);
    const toEnd = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59));

    const [bookings, stopSales] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          hotelId,
          deletedAt: null,
          hotelStatus: { notIn: EXCLUDED as any },
          arrivalDate: { lte: toEnd },
          departureDate: { gt: from },
        },
        select: { hotelRoomTypeId: true, numRooms: true, arrivalDate: true, departureDate: true },
      }),
      this.prisma.stopSale.findMany({
        where: { hotelId, fromDate: { lte: toEnd }, toDate: { gt: from } },
        select: { hotelRoomTypeId: true, qty: true, fromDate: true, toDate: true },
      }),
    ]);

    const dayTimes = days.map((d) => d.getTime());
    const rows: MaterializationRow[] = [];
    for (const rt of hotel.roomTypes) {
      const rtBookings = bookings
        .filter((b) => b.hotelRoomTypeId === rt.id)
        .map((b) => ({ arr: b.arrivalDate.getTime(), dep: b.departureDate.getTime(), rooms: b.numRooms }));
      // Stop sales for this room type OR hotel-wide (null room type).
      const rtStops = stopSales
        .filter((s) => s.hotelRoomTypeId === rt.id || s.hotelRoomTypeId == null)
        .map((s) => ({ from: s.fromDate.getTime(), to: s.toDate.getTime(), qty: s.qty }));

      const r = computeCells(rt.allocation, rtBookings, rtStops, dayTimes);

      // Hide empty room types (no allocation and nothing happening).
      if (r.totalAlloc === 0 && r.totalSold === 0 && r.totalSS === 0) continue;

      rows.push({ roomTypeId: rt.id, roomTypeName: rt.name, ...r });
    }

    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      from: ymd(from),
      to: ymd(to),
      days: days.map(ymd),
      rows,
    };
  }
}
