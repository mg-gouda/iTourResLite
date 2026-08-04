import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  deriveBooking, plUsd, plEur, plEgp, round2, ACCOUNTANT_EDITABLE_FIELDS,
  invoiceDueDate, JUMBO_OPERATOR_CODE,
  type BookingQueryDto, type BookingWriteDto, type SessionUser, type RateChangeEntry,
} from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";

const DECIMAL_FIELDS = ["costUsd", "sellingUsd", "costEur", "sellingEur", "costEgp", "sellingEgp", "visaHandling", "ebdPercent"] as const;

const INCLUDE = {
  hotel: { select: { id: true, name: true } },
  hotelRoomType: { select: { id: true, name: true, allocation: true } },
  tourOperator: { select: { id: true, code: true, name: true } },
  market: { select: { id: true, code: true, name: true } },
  resort: { select: { id: true, code: true, name: true } },
  guestNameList: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private serialize(b: any) {
    const out: any = { ...b };
    for (const f of DECIMAL_FIELDS) out[f] = b[f] == null ? 0 : Number(b[f]);
    Object.assign(out, deriveBooking(out));
    return out;
  }

  async list(q: BookingQueryDto) {
    const where: Prisma.BookingWhereInput = { deletedAt: null };
    if (q.ref) where.toBookingRef = { contains: q.ref, mode: "insensitive" };
    if (q.hotelId) where.hotelId = q.hotelId;
    if (q.tourOperatorId) where.tourOperatorId = q.tourOperatorId;
    if (q.marketId) where.marketId = q.marketId;
    if (q.resortId) where.resortId = q.resortId;
    if (q.status) where.hotelStatus = q.status;
    if (q.hasSpo !== undefined) (where as any).hasSpo = q.hasSpo === "true";
    if (q.currency) where.bookingCurrency = q.currency;
    if (q.from || q.to) {
      where.arrivalDate = {};
      if (q.from) (where.arrivalDate as any).gte = q.from;
      if (q.to) (where.arrivalDate as any).lte = q.to;
    }

    const sortable = new Set(["bookingDate", "arrivalDate", "departureDate", "toBookingRef", "createdAt"]);
    const orderBy: Prisma.BookingOrderByWithRelationInput =
      q.sort && sortable.has(q.sort) ? { [q.sort]: q.dir } : { arrivalDate: q.dir };

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, include: INCLUDE, orderBy,
        skip: (q.page - 1) * q.pageSize, take: q.pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.serialize(r)),
      page: q.page, pageSize: q.pageSize, total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  }

  async get(id: string) {
    const b = await this.prisma.booking.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    if (!b) throw new NotFoundException("Booking not found");
    return this.serialize(b);
  }

  async byRef(ref: string) {
    const b = await this.prisma.booking.findFirst({
      where: { toBookingRef: { equals: ref, mode: "insensitive" }, deletedAt: null },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    if (!b) throw new NotFoundException("No booking with that reference");
    return this.serialize(b);
  }

  private async generateInternalRef(): Promise<string> {
    let ref: string;
    do {
      ref = String(Math.floor(1000000 + Math.random() * 9000000));
    } while (await this.prisma.booking.findFirst({ where: { internalRef: ref }, select: { id: true } }));
    return ref;
  }

  private async saveGuestNames(bookingId: string, guestList: any[]) {
    await this.prisma.guestName.deleteMany({ where: { bookingId } });
    if (guestList?.length) {
      await this.prisma.guestName.createMany({
        data: guestList.map((g: any, i: number) => ({
          bookingId, title: g.title ?? "Mr", name: g.name, type: g.type ?? "HOTEL", room: g.room ?? 1, sortOrder: i,
        })),
      });
    }
  }

  private async assertNoStopSaleConflict(
    hotelId: string,
    hotelRoomTypeId: string | null | undefined,
    arrivalDate: Date,
    departureDate: Date,
  ) {
    const conflicts = await this.prisma.stopSale.findMany({
      where: {
        hotelId,
        OR: [
          ...(hotelRoomTypeId ? [{ hotelRoomTypeId }] : []),
          { hotelRoomTypeId: null },
        ],
        fromDate: { lt: departureDate },
        toDate:   { gt: arrivalDate },
      },
      include: { hotelRoomType: { select: { name: true } } },
    });
    if (!conflicts.length) return;
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const fmtD = (d: Date) => `${String(d.getDate()).padStart(2,"0")}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
    throw new ConflictException({
      message: `Stop sale conflict: ${conflicts.length} active stop sale${conflicts.length > 1 ? "s" : ""} overlap with this booking.`,
      details: {
        conflicts: conflicts.map((c) => ({
          id: c.id,
          fromDate: fmtD(c.fromDate),
          toDate:   fmtD(c.toDate),
          qty: c.qty,
          roomTypeName: (c as any).hotelRoomType?.name ?? null,
        })),
      },
    });
  }

  /**
   * Invoice due date for a booking — arrival + 45 days, but only for the Jumbo
   * operator (the SOA Statement covers JMB alone); every other operator keeps
   * it null. Derived server-side, never accepted from the client.
   */
  private async invoiceDueFor(tourOperatorId: string, arrivalDate: Date): Promise<Date | null> {
    const op = await this.prisma.tourOperator.findUnique({
      where: { id: tourOperatorId },
      select: { code: true },
    });
    return op?.code === JUMBO_OPERATOR_CODE ? invoiceDueDate(arrivalDate) : null;
  }

  async create(dto: BookingWriteDto, user: SessionUser) {
    const { guestList, overrideStopSale, ...bookingData } = dto as any;
    if (!overrideStopSale) {
      await this.assertNoStopSaleConflict(dto.hotelId, dto.hotelRoomTypeId as any, dto.arrivalDate, dto.departureDate);
    }
    // bookingPaid + paidDate are derived from the payments ledger (recomputed by
    // the finance endpoints). A brand-new booking has no payments yet.
    delete bookingData.paidDate;
    bookingData.bookingPaid = false;
    bookingData.paidDate = null;
    bookingData.invoiceDueDate = await this.invoiceDueFor(dto.tourOperatorId, dto.arrivalDate);
    const internalRef = await this.generateInternalRef();
    const created = await this.prisma.booking.create({
      data: { ...bookingData, internalRef, createdById: user.id },
      include: INCLUDE,
    });
    if (guestList?.length) await this.saveGuestNames(created.id, guestList);
    await this.audit.log({ userId: user.id, action: "CREATE", entity: "Booking", entityId: created.id, after: dto });
    return this.serialize(await this.prisma.booking.findFirstOrThrow({ where: { id: created.id }, include: INCLUDE }));
  }

  async update(id: string, dto: Partial<BookingWriteDto>, user: SessionUser) {
    const existing = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException("Booking not found");

    if (user.role === "ACCOUNTANT") {
      const allowed = new Set<string>(ACCOUNTANT_EDITABLE_FIELDS);
      const illegal = Object.keys(dto).filter((k) => !allowed.has(k) && k !== "guestList" && k !== "overrideStopSale");
      if (illegal.length) throw new ForbiddenException(`Accountant cannot edit: ${illegal.join(", ")}`);
    }

    const { guestList, overrideStopSale, ...bookingData } = dto as any;

    // bookingPaid + paidDate are derived from the payments ledger and recomputed
    // by the finance endpoints — never accept them from a booking write.
    delete bookingData.paidDate;
    delete bookingData.bookingPaid;

    // Only re-check if hotel/roomType/dates are being changed
    const hotelId        = (bookingData.hotelId         ?? existing.hotelId)        as string;
    const roomTypeId     = (bookingData.hotelRoomTypeId  ?? existing.hotelRoomTypeId) as string | null;
    const arrivalDate    = (bookingData.arrivalDate      ?? existing.arrivalDate)    as Date;
    const departureDate  = (bookingData.departureDate    ?? existing.departureDate)  as Date;
    const datesOrHotelChanged =
      bookingData.hotelId || bookingData.hotelRoomTypeId ||
      bookingData.arrivalDate || bookingData.departureDate;
    if (!overrideStopSale && datesOrHotelChanged) {
      await this.assertNoStopSaleConflict(hotelId, roomTypeId, arrivalDate, departureDate);
    }

    // Recompute the invoice due date on every edit: it follows the arrival date
    // and the operator, and either can change here. Recomputing unconditionally
    // also backfills a legacy row the first time it is touched.
    const operatorId = (bookingData.tourOperatorId ?? existing.tourOperatorId) as string;
    bookingData.invoiceDueDate = await this.invoiceDueFor(operatorId, arrivalDate);

    // Capture rate history when cost decreases in booking currency
    const currency = (bookingData.bookingCurrency ?? existing.bookingCurrency ?? "EUR") as string;
    const costFieldMap: Record<string, string> = { USD: "costUsd", GBP: "costUsd", EUR: "costEur", EGP: "costEgp" };
    const cf = costFieldMap[currency] ?? "costEur";
    const oldCostVal = Number((existing as any)[cf]);
    const newCostVal = (bookingData as any)[cf] != null ? Number((bookingData as any)[cf]) : oldCostVal;
    if (newCostVal < oldCostVal) {
      const oldCostUsd = Number(existing.costUsd);
      const oldCostEur = Number(existing.costEur);
      const oldCostEgp = Number(existing.costEgp);
      const oldSellingUsd = Number(existing.sellingUsd);
      const oldSellingEur = Number(existing.sellingEur);
      const oldSellingEgp = Number(existing.sellingEgp);
      const entry: RateChangeEntry = {
        changedAt: new Date().toISOString(),
        currency,
        oldCostUsd, oldCostEur, oldCostEgp,
        oldSellingUsd, oldSellingEur, oldSellingEgp,
        oldCalcUsd: (existing as any).calculationUsd ?? undefined,
        oldCalcEur: (existing as any).calculationEur ?? undefined,
        oldCalcEgp: (existing as any).calculationEgp ?? undefined,
        oldPlUsd: round2(plUsd(oldCostUsd, oldSellingUsd)),
        oldPlEur: round2(plEur(oldCostEur, oldSellingEur, Number(existing.visaHandling))),
        oldPlEgp: round2(plEgp(oldCostEgp, oldSellingEgp)),
      };
      const existingHistory: RateChangeEntry[] = (() => {
        try { return JSON.parse((existing as any).rateHistoryJson ?? "[]"); } catch { return []; }
      })();
      (bookingData as any).rateHistoryJson = JSON.stringify([...existingHistory, entry]);
    }

    const updated = await this.prisma.booking.update({ where: { id }, data: bookingData as any, include: INCLUDE });
    if ("guestList" in dto) await this.saveGuestNames(id, guestList ?? []);
    await this.audit.log({ userId: user.id, action: "UPDATE", entity: "Booking", entityId: id, before: existing, after: dto });
    return this.serialize(updated);
  }

  async remove(id: string, user: SessionUser) {
    const existing = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException("Booking not found");
    await this.prisma.booking.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ userId: user.id, action: "DELETE", entity: "Booking", entityId: id, before: existing });
    return { ok: true };
  }
}
