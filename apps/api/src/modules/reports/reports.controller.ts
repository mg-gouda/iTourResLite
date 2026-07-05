import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { zBookingStatus } from "@itour/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";

const dateRange = z.object({
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
  hotelId:        z.string().optional(),
  tourOperatorId: z.string().optional(),
  marketId:       z.string().optional(),
  resortId:       z.string().optional(),
  status:         zBookingStatus.optional(),
  paid:           z.enum(["paid", "unpaid"]).optional(),
});
type DateRange = z.infer<typeof dateRange>;


@Controller("reports")
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  private baseWhere(q: DateRange, dateField: "arrivalDate" | "departureDate" | "paymentOptionDate" = "arrivalDate") {
    const where: any = { deletedAt: null };
    if (q.hotelId)        where.hotelId = q.hotelId;
    if (q.tourOperatorId) where.tourOperatorId = q.tourOperatorId;
    if (q.marketId)       where.marketId = q.marketId;
    if (q.resortId)       where.resortId = q.resortId;
    if (q.status)         where.hotelStatus = q.status;
    if (q.from || q.to) {
      where[dateField] = {};
      if (q.from) where[dateField].gte = q.from;
      if (q.to)   where[dateField].lte = q.to;
    }
    return where;
  }

  /** Hotel Arrival List — all bookings arriving in date range */
  @Get("hotel-arrivals")
  hotelArrivals(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    return this.prisma.booking.findMany({
      where: this.baseWhere(q, "arrivalDate"),
      orderBy: [{ arrivalDate: "asc" }, { hotel: { name: "asc" } }],
      select: {
        id: true, toBookingRef: true, arrivalDate: true, departureDate: true,
        numRooms: true, adults: true, children: true, infants: true,
        roomCategory: true, mealBasis: true, guestNames: true,
        arrFlightNo: true, arrFlightTime: true,
        hotelStatus: true, meetAssistVisa: true,
        hotel:        { select: { id: true, name: true } },
        hotelRoomType:{ select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true, name: true } },
        market:       { select: { id: true, code: true, name: true } },
        resort:       { select: { id: true, code: true, name: true } },
      },
    });
  }

  /** Arrival Transfers — arrivals with flight details */
  @Get("arrival-transfers")
  arrivalTransfers(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    return this.prisma.booking.findMany({
      where: { ...this.baseWhere(q, "arrivalDate"), NOT: { hotelStatus: { in: ["CXL", "NoShow"] } } },
      orderBy: [{ arrivalDate: "asc" }, { arrFlightTime: "asc" }],
      select: {
        id: true, toBookingRef: true, arrivalDate: true,
        arrFlightNo: true, arrFlightTime: true,
        adults: true, children: true, infants: true,
        guestNames: true, meetAssistVisa: true,
        hotel: { select: { id: true, name: true } },
        hotelRoomType: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true } },
      },
    });
  }

  /** Departure Transfers — departures with flight details */
  @Get("departure-transfers")
  departureTransfers(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    return this.prisma.booking.findMany({
      where: { ...this.baseWhere(q, "departureDate"), NOT: { hotelStatus: { in: ["CXL", "NoShow"] } } },
      orderBy: [{ departureDate: "asc" }, { depFlightTime: "asc" }],
      select: {
        id: true, toBookingRef: true, departureDate: true,
        depFlightNo: true, depFlightTime: true,
        adults: true, children: true, infants: true,
        guestNames: true,
        hotel: { select: { id: true, name: true } },
        hotelRoomType: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true } },
      },
    });
  }

  /** Booking Finance Report — cost/sell/P&L per booking */
  @Get("booking-finance")
  bookingFinance(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    return this.prisma.booking.findMany({
      where: this.baseWhere(q, "arrivalDate"),
      orderBy: { arrivalDate: "asc" },
      select: {
        id: true, toBookingRef: true, arrivalDate: true, departureDate: true,
        hotelStatus: true, numRooms: true, bookingCurrency: true,
        costUsd: true, sellingUsd: true,
        costEur: true, sellingEur: true, visaHandling: true,
        costEgp: true, sellingEgp: true,
        ebdPercent: true, ebdPaymentDate: true,
        paymentMethod: true, paymentOptionDate: true,
        hotel: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Hotel Payment Report — cost & payment status per booking, filtered by the
   * server-captured paid date. Filters: paid-date range, hotel, paid/unpaid,
   * hotel booking status.
   */
  @Get("hotel-payment")
  hotelPayment(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    const where: any = { deletedAt: null };
    if (q.hotelId)        where.hotelId = q.hotelId;
    if (q.tourOperatorId) where.tourOperatorId = q.tourOperatorId;
    if (q.marketId)       where.marketId = q.marketId;
    if (q.resortId)       where.resortId = q.resortId;
    if (q.status)         where.hotelStatus = q.status;
    if (q.paid === "paid")   where.bookingPaid = true;
    if (q.paid === "unpaid") where.bookingPaid = false;
    // Payment-date range only constrains paid bookings (unpaid have no paidDate).
    if ((q.from || q.to) && q.paid !== "unpaid") {
      where.paidDate = {};
      if (q.from) where.paidDate.gte = q.from;
      if (q.to)   where.paidDate.lte = q.to;
    }
    return this.prisma.booking.findMany({
      where,
      orderBy: [{ paidDate: "desc" }, { arrivalDate: "asc" }],
      select: {
        id: true, toBookingRef: true, hotelStatus: true, bookingCurrency: true,
        costUsd: true, costEur: true, costEgp: true,
        paymentOptionDate: true, bookingPaid: true, paidDate: true,
        paymentProofName: true,
        hotel: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /** Payment Option Report — bookings with upcoming payment option dates */
  @Get("payment-options")
  paymentOptions(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    const where = this.baseWhere(q, "paymentOptionDate");
    // Merge not:null without overwriting date range already set by baseWhere
    where.paymentOptionDate = { ...(where.paymentOptionDate ?? {}), not: null };
    return this.prisma.booking.findMany({
      where,
      orderBy: { paymentOptionDate: "asc" },
      select: {
        id: true, toBookingRef: true, arrivalDate: true, departureDate: true,
        hotelStatus: true, numRooms: true, bookingCurrency: true,
        paymentMethod: true, paymentOptionDate: true,
        costUsd: true, sellingUsd: true, costEur: true, sellingEur: true,
        costEgp: true, sellingEgp: true,
        hotel: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true } },
      },
    });
  }

  /** EBD List — bookings with EBD% > 0 */
  @Get("ebd-list")
  ebdList(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    return this.prisma.booking.findMany({
      where: {
        ...this.baseWhere(q, "arrivalDate"),
        ebdPercent: { gt: 0 },
      },
      orderBy: { arrivalDate: "asc" },
      select: {
        id: true, toBookingRef: true, arrivalDate: true, departureDate: true,
        hotelStatus: true, numRooms: true, roomCategory: true, mealBasis: true,
        costUsd: true, sellingUsd: true,
        costEur: true, sellingEur: true,
        costEgp: true, sellingEgp: true,
        ebdPercent: true, ebdPaymentDate: true,
        hotel: { select: { id: true, name: true } },
        hotelRoomType: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true } },
      },
    });
  }
}
