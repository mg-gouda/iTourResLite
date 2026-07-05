import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  plUsd, plEur, plEgp, nights, round2,
  type DashboardQueryDto, type BreakdownQueryDto,
  type DashboardOverview, type BreakdownRow, type RebookingStats, type RateChangeEntry,
} from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private where(q: DashboardQueryDto): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = { deletedAt: null };
    if (q.status) where.hotelStatus = q.status;
    if (q.hotelId) where.hotelId = q.hotelId;
    if (q.tourOperatorId) where.tourOperatorId = q.tourOperatorId;
    if (q.marketId) where.marketId = q.marketId;
    if (q.resortId) where.resortId = q.resortId;
    if (q.from || q.to) {
      where.arrivalDate = {};
      if (q.from) (where.arrivalDate as any).gte = q.from;
      if (q.to) (where.arrivalDate as any).lte = q.to;
    }
    return where;
  }

  async overview(q: DashboardQueryDto): Promise<DashboardOverview> {
    const rows = await this.prisma.booking.findMany({
      where: this.where(q),
      select: {
        numRooms: true, arrivalDate: true, departureDate: true, hotelStatus: true,
        costUsd: true, sellingUsd: true, costEur: true, sellingEur: true, visaHandling: true,
      },
    });

    let totalRooms = 0, totalRoomNights = 0, pUsd = 0, pEur = 0, sUsd = 0, sEur = 0;
    const byStatus = new Map<string, number>();
    for (const b of rows) {
      totalRooms += b.numRooms;
      totalRoomNights += b.numRooms * nights(b.arrivalDate, b.departureDate);
      pUsd += plUsd(b.costUsd as any, b.sellingUsd as any);
      pEur += plEur(b.costEur as any, b.sellingEur as any, b.visaHandling as any);
      sUsd += Number(b.sellingUsd);
      sEur += Number(b.sellingEur);
      byStatus.set(b.hotelStatus, (byStatus.get(b.hotelStatus) ?? 0) + 1);
    }

    return {
      totalBookings: rows.length,
      totalRooms,
      totalRoomNights,
      plUsd: round2(pUsd),
      plEur: round2(pEur),
      sellingUsd: round2(sUsd),
      sellingEur: round2(sEur),
      avgMaterialization: null,
      byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    };
  }

  // Profit by period (monthly buckets on arrival date).
  async pl(q: DashboardQueryDto) {
    const rows = await this.prisma.booking.findMany({
      where: this.where(q),
      select: {
        arrivalDate: true,
        costUsd: true, sellingUsd: true, costEur: true, sellingEur: true, visaHandling: true,
        costEgp: true, sellingEgp: true,
      },
    });
    const buckets = new Map<string, { plUsd: number; plEur: number; plEgp: number; sellingEur: number; bookings: number }>();
    for (const b of rows) {
      const key = b.arrivalDate.toISOString().slice(0, 7); // yyyy-mm
      const cur = buckets.get(key) ?? { plUsd: 0, plEur: 0, plEgp: 0, sellingEur: 0, bookings: 0 };
      cur.plUsd += plUsd(b.costUsd as any, b.sellingUsd as any);
      cur.plEur += plEur(b.costEur as any, b.sellingEur as any, b.visaHandling as any);
      cur.plEgp += plEgp(b.costEgp as any, b.sellingEgp as any);
      cur.sellingEur += Number(b.sellingEur);
      cur.bookings += 1;
      buckets.set(key, cur);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => ({ period, plUsd: round2(v.plUsd), plEur: round2(v.plEur), plEgp: round2(v.plEgp), sellingEur: round2(v.sellingEur), bookings: v.bookings }));
  }

  async breakdowns(q: BreakdownQueryDto): Promise<BreakdownRow[]> {
    const rel = {
      tourOperator: { sel: { tourOperator: { select: { id: true, code: true, name: true } } }, pick: (b: any) => b.tourOperator },
      market: { sel: { market: { select: { id: true, code: true, name: true } } }, pick: (b: any) => b.market },
      resort: { sel: { resort: { select: { id: true, code: true, name: true } } }, pick: (b: any) => b.resort },
      hotel: { sel: { hotel: { select: { id: true, name: true } } }, pick: (b: any) => b.hotel },
    }[q.groupBy];

    const rows = await this.prisma.booking.findMany({
      where: this.where(q),
      select: {
        numRooms: true, costUsd: true, sellingUsd: true, costEur: true, sellingEur: true, visaHandling: true,
        ...rel.sel,
      } as any,
    });

    const agg = new Map<string, BreakdownRow>();
    for (const b of rows as any[]) {
      const ent = rel.pick(b);
      const key = ent?.id ?? "—";
      const label = ent ? (ent.name ?? ent.code ?? ent.id) : "—";
      const cur = agg.get(key) ?? { key, label, bookings: 0, rooms: 0, sellingEur: 0, plEur: 0, plUsd: 0 };
      cur.bookings += 1;
      cur.rooms += b.numRooms;
      cur.sellingEur += Number(b.sellingEur);
      cur.plEur += plEur(b.costEur, b.sellingEur, b.visaHandling);
      cur.plUsd += plUsd(b.costUsd, b.sellingUsd);
      agg.set(key, cur);
    }
    return [...agg.values()]
      .map((r) => ({ ...r, sellingEur: round2(r.sellingEur), plEur: round2(r.plEur), plUsd: round2(r.plUsd) }))
      .sort((a, b) => b.sellingEur - a.sellingEur);
  }

  async rebookingStats(): Promise<RebookingStats> {
    const rows = await this.prisma.booking.findMany({
      where: { deletedAt: null, NOT: { rateHistoryJson: null } },
      select: { costUsd: true, costEur: true, costEgp: true, bookingCurrency: true, rateHistoryJson: true },
    });

    let bookingCount = 0;
    let gainEur = 0, gainUsd = 0, gainEgp = 0;

    for (const b of rows) {
      let history: RateChangeEntry[];
      try { history = JSON.parse(b.rateHistoryJson!); } catch { continue; }
      if (!history.length) continue;
      const first = history[0];
      // Gain = original cost - current cost (positive means we pay less → more profit)
      const gEur = round2(first.oldCostEur - Number(b.costEur));
      const gUsd = round2(first.oldCostUsd - Number(b.costUsd));
      const gEgp = round2(first.oldCostEgp - Number(b.costEgp));
      if (gEur > 0 || gUsd > 0 || gEgp > 0) bookingCount++;
      gainEur += gEur > 0 ? gEur : 0;
      gainUsd += gUsd > 0 ? gUsd : 0;
      gainEgp += gEgp > 0 ? gEgp : 0;
    }

    return { bookingCount, gainEur: round2(gainEur), gainUsd: round2(gainUsd), gainEgp: round2(gainEgp) };
  }
}
