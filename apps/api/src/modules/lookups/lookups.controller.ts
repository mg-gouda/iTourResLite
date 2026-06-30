import { Controller, Get, Query } from "@nestjs/common";
import {
  BOOKING_STATUSES, ROOM_CATEGORIES, MEAL_BASES, PAYMENT_METHODS, CURRENCIES,
  STATUS_LABEL, ROOMCAT_LABEL, PAYMENT_LABEL,
} from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("lookups")
export class LookupsController {
  constructor(private prisma: PrismaService) {}

  // All select options in one round-trip (used to hydrate the booking form).
  @Get()
  async all() {
    const [tourOperators, markets, resorts] = await Promise.all([
      this.prisma.tourOperator.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      this.prisma.market.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      this.prisma.resort.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    ]);
    return {
      tourOperators,
      markets,
      resorts,
      enums: {
        bookingStatus: BOOKING_STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] })),
        roomCategory: ROOM_CATEGORIES.map((v) => ({ value: v, label: ROOMCAT_LABEL[v] })),
        mealBasis: MEAL_BASES.map((v) => ({ value: v, label: v })),
        paymentMethod: PAYMENT_METHODS.map((v) => ({ value: v, label: PAYMENT_LABEL[v] })),
        currency: CURRENCIES.map((v) => ({ value: v, label: v })),
      },
    };
  }

  // Async combo-box search for hotels (Tech Rule 1: debounced, paginated).
  @Get("hotels")
  async hotels(@Query("q") q = "", @Query("take") take = "20") {
    const rows = await this.prisma.hotel.findMany({
      where: { active: true, name: { contains: q, mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: Math.min(50, Math.max(1, Number(take) || 20)),
      select: { id: true, name: true, resortId: true },
    });
    return { data: rows };
  }
}
