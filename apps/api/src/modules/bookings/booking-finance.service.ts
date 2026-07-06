import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  computePaidTotals, round2,
  type BookingPaymentDto, type BookingPaymentUpdateDto,
  type BookingCreditNoteDto, type BookingCreditNoteUpdateDto,
  type SessionUser,
} from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";

const num = (v: any) => (v == null ? 0 : Number(v));

@Injectable()
export class BookingFinanceService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private serializePayment(p: any) {
    return { ...p, amount: num(p.amount) };
  }

  private serializeCreditNote(cn: any) {
    const redeemed = round2((cn.redemptions ?? []).reduce((s: number, r: any) => s + num(r.amount), 0));
    const amount = num(cn.amount);
    const { redemptions, ...rest } = cn;
    return { ...rest, amount, redeemed, remaining: round2(amount - redeemed) };
  }

  private async getBookingOrThrow(bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundException("Booking not found");
    return booking;
  }

  /** Recompute bookingPaid/paidDate from the payment ledger. Idempotent. */
  async recomputePaid(bookingId: string) {
    const b = await this.prisma.booking.findFirst({
      where: { id: bookingId },
      select: {
        bookingCurrency: true, costUsd: true, costEur: true, costEgp: true,
        payments: { select: { amount: true, currency: true, paidDate: true } },
      },
    });
    if (!b) return null;
    const totals = computePaidTotals(b as any, b.payments as any);
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        bookingPaid: totals.isPaid,
        paidDate: totals.isPaid && totals.lastPaidDate ? new Date(totals.lastPaidDate) : null,
      },
    });
    return totals;
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  async listPayments(bookingId: string) {
    await this.getBookingOrThrow(bookingId);
    const rows = await this.prisma.bookingPayment.findMany({
      where: { bookingId },
      orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
      include: { creditNote: { select: { id: true, reference: true, noteDate: true } } },
    });
    const totals = await this.recomputePaid(bookingId);
    return { payments: rows.map((p) => this.serializePayment(p)), totals };
  }

  /** Validate that `amount` in `currency` can be drawn from credit note `creditNoteId`. */
  private async assertRedeemable(
    booking: { hotelId: string },
    creditNoteId: string,
    amount: number,
    currency: string,
    excludePaymentId?: string,
  ) {
    const cn = await this.prisma.bookingCreditNote.findUnique({
      where: { id: creditNoteId },
      include: { redemptions: { select: { id: true, amount: true } } },
    });
    if (!cn) throw new BadRequestException("Credit note not found");
    if (cn.hotelId !== booking.hotelId) throw new BadRequestException("Credit note belongs to a different hotel");
    if (cn.currency !== currency) throw new BadRequestException(`Credit note is in ${cn.currency}; the payment must be in the same currency`);
    const used = cn.redemptions
      .filter((r) => r.id !== excludePaymentId)
      .reduce((s, r) => s + num(r.amount), 0);
    const remaining = round2(num(cn.amount) - used);
    if (round2(amount) > remaining) {
      throw new BadRequestException(`Only ${remaining} ${cn.currency} remaining on this credit note`);
    }
  }

  async createPayment(bookingId: string, dto: BookingPaymentDto, user: SessionUser) {
    const booking = await this.getBookingOrThrow(bookingId);
    const isRedemption = dto.source === "CREDIT_NOTE";
    if (isRedemption) {
      await this.assertRedeemable(booking, dto.creditNoteId!, dto.amount, dto.currency);
    }
    const created = await this.prisma.bookingPayment.create({
      data: {
        bookingId,
        amount: dto.amount,
        currency: dto.currency,
        paidDate: dto.paidDate,
        method: dto.method ?? null,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        source: dto.source,
        creditNoteId: isRedemption ? dto.creditNoteId! : null,
        createdById: user.id,
      },
    });
    await this.recomputePaid(bookingId);
    await this.audit.log({ userId: user.id, action: "CREATE", entity: "BookingPayment", entityId: created.id, after: dto });
    return this.serializePayment(created);
  }

  async updatePayment(bookingId: string, paymentId: string, dto: BookingPaymentUpdateDto, user: SessionUser) {
    const existing = await this.prisma.bookingPayment.findFirst({ where: { id: paymentId, bookingId } });
    if (!existing) throw new NotFoundException("Payment not found");
    // Re-validate redemption headroom if this is a credit-note payment and the amount/currency moves.
    if (existing.source === "CREDIT_NOTE" && existing.creditNoteId && (dto.amount !== undefined || dto.currency !== undefined)) {
      const booking = await this.getBookingOrThrow(bookingId);
      await this.assertRedeemable(
        booking, existing.creditNoteId,
        dto.amount ?? num(existing.amount),
        dto.currency ?? existing.currency,
        existing.id,
      );
    }
    const updated = await this.prisma.bookingPayment.update({
      where: { id: paymentId },
      data: {
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.paidDate !== undefined ? { paidDate: dto.paidDate } : {}),
        ...(dto.method !== undefined ? { method: dto.method } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
    await this.recomputePaid(bookingId);
    await this.audit.log({ userId: user.id, action: "UPDATE", entity: "BookingPayment", entityId: paymentId, before: existing, after: dto });
    return this.serializePayment(updated);
  }

  async deletePayment(bookingId: string, paymentId: string, user: SessionUser) {
    const existing = await this.prisma.bookingPayment.findFirst({ where: { id: paymentId, bookingId } });
    if (!existing) throw new NotFoundException("Payment not found");
    await this.prisma.bookingPayment.delete({ where: { id: paymentId } });
    await this.recomputePaid(bookingId);
    await this.audit.log({ userId: user.id, action: "DELETE", entity: "BookingPayment", entityId: paymentId, before: existing });
    return { ok: true };
  }

  async findPaymentForProof(bookingId: string, paymentId: string) {
    const p = await this.prisma.bookingPayment.findFirst({ where: { id: paymentId, bookingId } });
    if (!p) throw new NotFoundException("Payment not found");
    return p;
  }

  async setPaymentProof(bookingId: string, paymentId: string, proofPath: string, proofName: string) {
    await this.findPaymentForProof(bookingId, paymentId);
    await this.prisma.bookingPayment.update({ where: { id: paymentId }, data: { proofPath, proofName } });
  }

  // ── Credit notes ────────────────────────────────────────────────────────

  async listCreditNotes(bookingId: string) {
    await this.getBookingOrThrow(bookingId);
    const rows = await this.prisma.bookingCreditNote.findMany({
      where: { bookingId },
      orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
      include: { redemptions: { select: { id: true, amount: true } } },
    });
    return { creditNotes: rows.map((cn) => this.serializeCreditNote(cn)) };
  }

  /** Credit notes held at this booking's hotel that still have value to redeem. */
  async availableCreditNotes(bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    const rows = await this.prisma.bookingCreditNote.findMany({
      where: { hotelId: booking.hotelId, booking: { deletedAt: null } },
      orderBy: [{ noteDate: "desc" }],
      include: {
        redemptions: { select: { id: true, amount: true } },
        booking: { select: { toBookingRef: true, internalRef: true } },
      },
    });
    return {
      creditNotes: rows
        .map((cn) => this.serializeCreditNote(cn))
        .filter((cn) => cn.remaining > 0),
    };
  }

  async createCreditNote(bookingId: string, dto: BookingCreditNoteDto, user: SessionUser) {
    const booking = await this.getBookingOrThrow(bookingId);
    const created = await this.prisma.bookingCreditNote.create({
      data: {
        bookingId,
        hotelId: dto.hotelId || booking.hotelId,
        amount: dto.amount,
        currency: dto.currency,
        noteDate: dto.noteDate,
        reference: dto.reference ?? null,
        remarks: dto.remarks ?? null,
        createdById: user.id,
      },
      include: { redemptions: { select: { id: true, amount: true } } },
    });
    await this.audit.log({ userId: user.id, action: "CREATE", entity: "BookingCreditNote", entityId: created.id, after: dto });
    return this.serializeCreditNote(created);
  }

  async updateCreditNote(bookingId: string, cnId: string, dto: BookingCreditNoteUpdateDto, user: SessionUser) {
    const existing = await this.prisma.bookingCreditNote.findFirst({
      where: { id: cnId, bookingId },
      include: { redemptions: { select: { amount: true } } },
    });
    if (!existing) throw new NotFoundException("Credit note not found");
    const redeemed = round2(existing.redemptions.reduce((s, r) => s + num(r.amount), 0));
    if (redeemed > 0) {
      if (dto.currency && dto.currency !== existing.currency) {
        throw new BadRequestException("Cannot change currency of a credit note that has been redeemed");
      }
      if (dto.amount !== undefined && round2(dto.amount) < redeemed) {
        throw new BadRequestException(`Amount cannot be below the ${redeemed} ${existing.currency} already redeemed`);
      }
    }
    const updated = await this.prisma.bookingCreditNote.update({
      where: { id: cnId },
      data: {
        ...(dto.hotelId !== undefined && dto.hotelId ? { hotelId: dto.hotelId } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.noteDate !== undefined ? { noteDate: dto.noteDate } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      include: { redemptions: { select: { id: true, amount: true } } },
    });
    await this.audit.log({ userId: user.id, action: "UPDATE", entity: "BookingCreditNote", entityId: cnId, before: existing, after: dto });
    return this.serializeCreditNote(updated);
  }

  async deleteCreditNote(bookingId: string, cnId: string, user: SessionUser) {
    const existing = await this.prisma.bookingCreditNote.findFirst({
      where: { id: cnId, bookingId },
      include: { redemptions: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException("Credit note not found");
    if (existing.redemptions.length) {
      throw new BadRequestException("This credit note has been redeemed by one or more payments; remove those payments first");
    }
    await this.prisma.bookingCreditNote.delete({ where: { id: cnId } });
    await this.audit.log({ userId: user.id, action: "DELETE", entity: "BookingCreditNote", entityId: cnId, before: existing });
    return { ok: true };
  }

  async findCreditNoteForProof(bookingId: string, cnId: string) {
    const cn = await this.prisma.bookingCreditNote.findFirst({ where: { id: cnId, bookingId } });
    if (!cn) throw new NotFoundException("Credit note not found");
    return cn;
  }

  async setCreditNoteProof(bookingId: string, cnId: string, proofPath: string, proofName: string) {
    await this.findCreditNoteForProof(bookingId, cnId);
    await this.prisma.bookingCreditNote.update({ where: { id: cnId }, data: { proofPath, proofName } });
  }
}
