import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  deriveBooking, ACCOUNTANT_EDITABLE_FIELDS,
  type BookingQueryDto, type BookingWriteDto, type SessionUser,
} from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";

const DECIMAL_FIELDS = ["costUsd", "sellingUsd", "costEur", "sellingEur", "visaHandling", "ebdPercent"] as const;

const INCLUDE = {
  hotel: { select: { id: true, name: true } },
  hotelRoomType: { select: { id: true, name: true, allocation: true } },
  tourOperator: { select: { id: true, code: true, name: true } },
  market: { select: { id: true, code: true, name: true } },
  resort: { select: { id: true, code: true, name: true } },
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

  async create(dto: BookingWriteDto, user: SessionUser) {
    const created = await this.prisma.booking.create({
      data: { ...(dto as any), createdById: user.id },
      include: INCLUDE,
    });
    await this.audit.log({ userId: user.id, action: "CREATE", entity: "Booking", entityId: created.id, after: dto });
    return this.serialize(created);
  }

  async update(id: string, dto: Partial<BookingWriteDto>, user: SessionUser) {
    const existing = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException("Booking not found");

    // Field-level gating: ACCOUNTANT may touch financial fields only (§3).
    if (user.role === "ACCOUNTANT") {
      const allowed = new Set<string>(ACCOUNTANT_EDITABLE_FIELDS);
      const illegal = Object.keys(dto).filter((k) => !allowed.has(k));
      if (illegal.length) throw new ForbiddenException(`Accountant cannot edit: ${illegal.join(", ")}`);
    }

    const updated = await this.prisma.booking.update({ where: { id }, data: dto as any, include: INCLUDE });
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
