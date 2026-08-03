import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { zBookingStatus, computePaidTotals, round2, nights } from "@itour/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";

const dateRange = z.object({
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
  arrivalFrom: z.coerce.date().optional(),
  arrivalTo:   z.coerce.date().optional(),
  hotelId:        z.string().optional(),
  tourOperatorId: z.union([z.string(), z.array(z.string())]).optional(),
  marketId:       z.string().optional(),
  resortId:       z.string().optional(),
  status:         zBookingStatus.optional(),
  paid:           z.enum(["paid", "partial", "unpaid"]).optional(),
  creditNote:     z.enum(["any", "remaining"]).optional(),
});
type DateRange = z.infer<typeof dateRange>;

/**
 * Operator filter — accepts a single id or a list (multi-select). Returns a
 * Prisma equality for one id, an `in` clause for several, or undefined when
 * the list is empty so the caller drops the filter entirely.
 */
function operatorFilter(v: string | string[]): string | { in: string[] } | undefined {
  const ids = (Array.isArray(v) ? v : [v]).filter(Boolean);
  if (ids.length === 0) return undefined;
  return ids.length === 1 ? ids[0] : { in: ids };
}

/** Jumbo Invoices — arrival-date range only; operator + status are fixed. */
const jumboRange = z.object({
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
});
type JumboRange = z.infer<typeof jumboRange>;

/** The operator these invoices are issued to (JUMBOLINE ACCOMMODATIONS & SERVICES S.L.U.). */
const JUMBO_OPERATOR_CODE = "JMB";
/** Only Confirmed bookings are invoiced. */
const JUMBO_STATUS = "Confirmed";
/**
 * First number of the sequence for a given year; every other year starts at 1.
 * 2026 continues the manually-issued run, which reached 0145.
 */
const JUMBO_SEQ_SEED: Record<number, number> = { 2026: 146 };
const jumboSeqKey = (year: number) => `jumboInvoiceSeq:${year}`;


@Controller("reports")
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  private baseWhere(q: DateRange, dateField: "arrivalDate" | "departureDate" | "paymentOptionDate" = "arrivalDate") {
    const where: any = { deletedAt: null };
    if (q.hotelId)        where.hotelId = q.hotelId;
    if (q.tourOperatorId) where.tourOperatorId = operatorFilter(q.tourOperatorId);
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
   * Invoices Review — one row per booking with operator, refs, stay dates, guest
   * and per-currency cost/selling. Filters: arrival-date range, operator, status.
   */
  @Get("invoices-review")
  invoicesReview(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    return this.prisma.booking.findMany({
      where: this.baseWhere(q, "arrivalDate"),
      orderBy: [{ arrivalDate: "asc" }, { tourOperator: { code: "asc" } }, { toBookingRef: "asc" }],
      select: {
        id: true, toBookingRef: true, bookingDate: true, arrivalDate: true, departureDate: true,
        hotelStatus: true, guestNames: true, bookingCurrency: true,
        costUsd: true, sellingUsd: true, costEur: true, sellingEur: true, costEgp: true, sellingEgp: true,
        guestNameList: { orderBy: { sortOrder: "asc" }, select: { title: true, name: true, type: true, room: true } },
        hotel: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Jumbo Invoices — Confirmed bookings for the Jumbo operator in an arrival-date
   * range, shaped for the "Fulvago Travel Accommodation invoice" form (one
   * invoice page per booking). Read-only: `jumboInvoiceNo` is null until issued.
   */
  private jumboRows(q: JumboRange) {
    const where: any = {
      deletedAt: null,
      hotelStatus: JUMBO_STATUS,
      tourOperator: { code: JUMBO_OPERATOR_CODE },
    };
    if (q.from || q.to) {
      where.arrivalDate = {};
      if (q.from) where.arrivalDate.gte = q.from;
      if (q.to)   where.arrivalDate.lte = q.to;
    }
    return this.prisma.booking.findMany({
      where,
      orderBy: [{ arrivalDate: "asc" }, { toBookingRef: "asc" }],
      select: {
        id: true, toBookingRef: true, jumboInvoiceNo: true,
        bookingDate: true, arrivalDate: true, departureDate: true,
        hotelStatus: true, numRooms: true, roomCategory: true, roomCatsJson: true,
        adults: true, children: true, infants: true,
        bookingCurrency: true, sellingUsd: true, sellingEur: true, sellingEgp: true,
        guestNames: true,
        guestNameList: { orderBy: { sortOrder: "asc" }, select: { title: true, name: true, type: true, room: true } },
        hotel:         { select: { id: true, name: true } },
        hotelRoomType: { select: { id: true, name: true } },
        tourOperator:  { select: { id: true, code: true, name: true } },
      },
    });
  }

  @Get("jumbo-invoices")
  jumboInvoices(@Query(new ZodValidationPipe(jumboRange)) q: JumboRange) {
    return this.jumboRows(q);
  }

  /**
   * Issue the invoice numbers for a range and return the same rows with
   * `jumboInvoiceNo` filled in. A booking keeps the number it was first given,
   * so re-generating a range reprints identical invoices; only bookings without
   * a number consume from the counter. The counter is per arrival year
   * ({yyyy}0000, restarting at 0001 each year) and is advanced inside the same
   * transaction that stamps the bookings.
   */
  @Post("jumbo-invoices/issue")
  async issueJumboInvoices(@Body(new ZodValidationPipe(jumboRange)) q: JumboRange) {
    const rows = await this.jumboRows(q);
    const pending = rows.filter((r) => !r.jumboInvoiceNo);
    if (!pending.length) return rows;

    // Group the unnumbered bookings by arrival year — each year has its own counter.
    const byYear = new Map<number, typeof pending>();
    for (const b of pending) {
      const year = b.arrivalDate.getUTCFullYear();
      const list = byYear.get(year);
      if (list) list.push(b);
      else byYear.set(year, [b]);
    }

    const issued = new Map<string, string>();
    await this.prisma.$transaction(async (tx) => {
      for (const [year, list] of byYear) {
        const key = jumboSeqKey(year);
        const cfg = await tx.systemConfig.findUnique({ where: { key } });
        const stored = cfg ? Number(cfg.value) : NaN;
        let next = Number.isFinite(stored) && stored > 0 ? stored : (JUMBO_SEQ_SEED[year] ?? 1);
        for (const b of list) {
          const no = `${year}${String(next).padStart(4, "0")}`;
          await tx.booking.update({ where: { id: b.id }, data: { jumboInvoiceNo: no } });
          issued.set(b.id, no);
          next++;
        }
        await tx.systemConfig.upsert({
          where: { key }, update: { value: String(next) }, create: { key, value: String(next) },
        });
      }
    });

    return rows.map((r) => (r.jumboInvoiceNo ? r : { ...r, jumboInvoiceNo: issued.get(r.id) ?? null }));
  }

  /**
   * Hotel Payment Report — cost & payment status per booking, filtered by the
   * server-captured paid date. Filters: paid-date range, hotel, paid/unpaid,
   * hotel booking status.
   */
  @Get("hotel-payment")
  async hotelPayment(@Query(new ZodValidationPipe(dateRange)) q: DateRange) {
    const where: any = { deletedAt: null };
    if (q.hotelId)        where.hotelId = q.hotelId;
    if (q.tourOperatorId) where.tourOperatorId = operatorFilter(q.tourOperatorId);
    if (q.marketId)       where.marketId = q.marketId;
    if (q.resortId)       where.resortId = q.resortId;
    if (q.status)         where.hotelStatus = q.status;
    // Payment status: paid = fully settled; partial = some payments but not full;
    // unpaid = no payments at all. bookingPaid is the derived fully-paid flag.
    if (q.paid === "paid")    where.bookingPaid = true;
    if (q.paid === "partial") { where.bookingPaid = false; where.payments = { some: {} }; }
    if (q.paid === "unpaid")  { where.bookingPaid = false; where.payments = { none: {} }; }
    // Credit-note presence: both variants require at least one credit note; the
    // "remaining" narrowing (still-unredeemed value) is applied after roll-up.
    if (q.creditNote) where.creditNotes = { some: {} };
    // Arrival-date range narrows by the stay's arrival, independent of paid date.
    if (q.arrivalFrom || q.arrivalTo) {
      where.arrivalDate = {};
      if (q.arrivalFrom) where.arrivalDate.gte = q.arrivalFrom;
      if (q.arrivalTo)   where.arrivalDate.lte = q.arrivalTo;
    }
    // Payment-date range only constrains fully-paid bookings (partial/unpaid have
    // no paidDate yet — a deposit alone doesn't set it).
    if ((q.from || q.to) && q.paid !== "unpaid" && q.paid !== "partial") {
      where.paidDate = {};
      if (q.from) where.paidDate.gte = q.from;
      if (q.to)   where.paidDate.lte = q.to;
    }
    const rows = await this.prisma.booking.findMany({
      where,
      orderBy: [{ paidDate: "desc" }, { arrivalDate: "asc" }],
      select: {
        id: true, toBookingRef: true, hotelStatus: true, bookingCurrency: true,
        arrivalDate: true, departureDate: true,
        costUsd: true, costEur: true, costEgp: true,
        paymentOptionDate: true, bookingPaid: true, paidDate: true,
        paymentProofName: true,
        payments: { select: { id: true, amount: true, currency: true, paidDate: true, source: true } },
        creditNotes: {
          select: {
            id: true, amount: true, currency: true, noteDate: true, reference: true,
            redemptions: { select: { amount: true } },
          },
        },
        hotel: { select: { id: true, name: true } },
        tourOperator: { select: { id: true, code: true, name: true } },
      },
    });

    // Roll up each booking's payment ledger + credit-note holdings for display.
    const mapped = rows.map((b) => {
      const totals = computePaidTotals(b as any, b.payments as any);
      const creditNotes = b.creditNotes.map((cn) => {
        const redeemed = round2(cn.redemptions.reduce((s, r) => s + Number(r.amount), 0));
        const amount = Number(cn.amount);
        return {
          id: cn.id, amount, currency: cn.currency, noteDate: cn.noteDate,
          reference: cn.reference, redeemed, remaining: round2(amount - redeemed),
        };
      });
      const creditNoteRemaining = round2(creditNotes.reduce((s, cn) => s + cn.remaining, 0));
      const { payments, creditNotes: _cn, ...rest } = b as any;
      return {
        ...rest,
        nights: nights(b.arrivalDate, b.departureDate),
        paidCurrency: totals.currency,
        paidTotal: totals.paid,
        balance: totals.balance,
        paymentCount: b.payments.length,
        creditNotes,
        creditNoteRemaining,
      };
    });

    // "Remaining" credit-note filter can only be applied post-roll-up, since
    // remaining value (amount − redemptions) isn't a stored column.
    return q.creditNote === "remaining"
      ? mapped.filter((r) => r.creditNoteRemaining > 0)
      : mapped;
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
