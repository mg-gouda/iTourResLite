import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type LookupModel =
  | "bookingStatusLookup"
  | "roomCategoryLookup"
  | "mealBasisLookup"
  | "paymentMethodLookup"
  | "currencyLookup"
  | "spoLookup";

@Controller("lookups")
export class LookupsController {
  constructor(private prisma: PrismaService) {}

  // All select options in one round-trip (hydrates booking form + filters).
  @Get()
  async all() {
    const [
      tourOperators, markets, resorts,
      bookingStatuses, roomCategories, mealBases, paymentMethods, currencies, spos,
    ] = await Promise.all([
      this.prisma.tourOperator.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      this.prisma.market.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      this.prisma.resort.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      this.prisma.bookingStatusLookup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      this.prisma.roomCategoryLookup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      this.prisma.mealBasisLookup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      this.prisma.paymentMethodLookup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      this.prisma.currencyLookup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      this.prisma.spoLookup.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    ]);

    const toOpt = (rows: { code: string; label?: string | null }[]) =>
      rows.map((r) => ({ value: r.code, label: r.label ?? r.code }));

    return {
      tourOperators,
      markets,
      resorts,
      bookingStatuses: toOpt(bookingStatuses),
      roomCategories:  toOpt(roomCategories),
      mealBases:       toOpt(mealBases),
      paymentMethods:  toOpt(paymentMethods),
      currencies:      toOpt(currencies),
      spos:            toOpt(spos),
    };
  }

  // Async combo-box search for hotels (debounced, paginated).
  @Get("hotels")
  async hotels(@Query("q") q = "", @Query("take") take = "20", @Query("resortId") resortId?: string) {
    const where: any = { active: true, name: { contains: q, mode: "insensitive" } };
    if (resortId) where.resortId = resortId;
    const rows = await this.prisma.hotel.findMany({
      where,
      orderBy: { name: "asc" },
      take: Math.min(50, Math.max(1, Number(take) || 20)),
      select: { id: true, name: true, resortId: true },
    });
    return { data: rows };
  }
}
