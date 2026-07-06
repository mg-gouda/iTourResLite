import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post,
  Res, UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { extname, join } from "path";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "fs";
import type { Response } from "express";
import {
  bookingPaymentSchema, bookingPaymentUpdateSchema,
  bookingCreditNoteSchema, bookingCreditNoteUpdateSchema,
  canEditPayment, type SessionUser,
} from "@itour/shared";
import { BookingFinanceService } from "./booking-finance.service";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

const PROOF_EXT = new Set([".pdf", ".jpeg", ".jpg", ".bmp", ".png"]);
const INLINE_MIME: Record<string, string> = {
  ".pdf": "application/pdf", ".jpeg": "image/jpeg", ".jpg": "image/jpeg",
  ".bmp": "image/bmp", ".png": "image/png",
};

/** Persist an uploaded proof under uploads/<subdir>, returning its path + name. */
function saveProof(file: any, subdir: string): { path: string; name: string } {
  if (!file) throw new BadRequestException("No file provided");
  const ext = extname(file.originalname).toLowerCase();
  if (!PROOF_EXT.has(ext)) throw new BadRequestException(`File type ${ext} not allowed. Accepted: .pdf .jpeg .jpg .bmp .png`);
  const candidates = [
    join(process.cwd(), "uploads", subdir),
    join(__dirname, "..", "..", "..", "uploads", subdir),
    join(__dirname, "..", "..", "..", "..", "apps", "api", "uploads", subdir),
  ];
  let uploadDir = candidates[0];
  for (const dir of candidates) {
    try { mkdirSync(dir, { recursive: true }); uploadDir = dir; break; } catch { /* try next */ }
  }
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const full = join(uploadDir, filename);
  writeFileSync(full, file.buffer);
  return { path: full, name: file.originalname };
}

function serveInline(res: Response, path: string | null, name: string | null) {
  if (!path) { res.status(404).json({ message: "No proof attached" }); return; }
  if (!existsSync(path)) { res.status(404).json({ message: "File not found on disk" }); return; }
  const ext = extname(path).toLowerCase();
  res.setHeader("Content-Type", INLINE_MIME[ext] ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${name ?? path}"`);
  createReadStream(path).pipe(res);
}

@Controller("bookings")
export class BookingFinanceController {
  constructor(private finance: BookingFinanceService) {}

  private assertCanPay(user: SessionUser) {
    if (!canEditPayment(user.role)) {
      throw new ForbiddenException("Only Accountant or Manager can manage payments and credit notes.");
    }
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  @Get(":id/payments")
  @Roles("VIEWER")
  listPayments(@Param("id") id: string) {
    return this.finance.listPayments(id);
  }

  @Post(":id/payments")
  @Roles("ACCOUNTANT")
  createPayment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(bookingPaymentSchema)) dto: any,
    @CurrentUser() user: SessionUser,
  ) {
    this.assertCanPay(user);
    return this.finance.createPayment(id, dto, user);
  }

  @Patch(":id/payments/:paymentId")
  @Roles("ACCOUNTANT")
  updatePayment(
    @Param("id") id: string,
    @Param("paymentId") paymentId: string,
    @Body(new ZodValidationPipe(bookingPaymentUpdateSchema)) dto: any,
    @CurrentUser() user: SessionUser,
  ) {
    this.assertCanPay(user);
    return this.finance.updatePayment(id, paymentId, dto, user);
  }

  @Delete(":id/payments/:paymentId")
  @Roles("ACCOUNTANT")
  deletePayment(@Param("id") id: string, @Param("paymentId") paymentId: string, @CurrentUser() user: SessionUser) {
    this.assertCanPay(user);
    return this.finance.deletePayment(id, paymentId, user);
  }

  @Post(":id/payments/:paymentId/proof")
  @Roles("ACCOUNTANT")
  @UseInterceptors(FileInterceptor("file"))
  async uploadPaymentProof(
    @Param("id") id: string,
    @Param("paymentId") paymentId: string,
    @UploadedFile() file: any,
    @CurrentUser() user: SessionUser,
  ) {
    this.assertCanPay(user);
    const { path, name } = saveProof(file, "payment-proof");
    await this.finance.setPaymentProof(id, paymentId, path, name);
    return { name };
  }

  @Get(":id/payments/:paymentId/proof")
  @Roles("VIEWER")
  async viewPaymentProof(@Param("id") id: string, @Param("paymentId") paymentId: string, @Res() res: Response) {
    const p = await this.finance.findPaymentForProof(id, paymentId);
    serveInline(res, p.proofPath, p.proofName);
  }

  // ── Credit notes ────────────────────────────────────────────────────────

  @Get(":id/credit-notes")
  @Roles("VIEWER")
  listCreditNotes(@Param("id") id: string) {
    return this.finance.listCreditNotes(id);
  }

  @Get(":id/available-credit-notes")
  @Roles("VIEWER")
  availableCreditNotes(@Param("id") id: string) {
    return this.finance.availableCreditNotes(id);
  }

  @Post(":id/credit-notes")
  @Roles("ACCOUNTANT")
  createCreditNote(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(bookingCreditNoteSchema)) dto: any,
    @CurrentUser() user: SessionUser,
  ) {
    this.assertCanPay(user);
    return this.finance.createCreditNote(id, dto, user);
  }

  @Patch(":id/credit-notes/:cnId")
  @Roles("ACCOUNTANT")
  updateCreditNote(
    @Param("id") id: string,
    @Param("cnId") cnId: string,
    @Body(new ZodValidationPipe(bookingCreditNoteUpdateSchema)) dto: any,
    @CurrentUser() user: SessionUser,
  ) {
    this.assertCanPay(user);
    return this.finance.updateCreditNote(id, cnId, dto, user);
  }

  @Delete(":id/credit-notes/:cnId")
  @Roles("ACCOUNTANT")
  deleteCreditNote(@Param("id") id: string, @Param("cnId") cnId: string, @CurrentUser() user: SessionUser) {
    this.assertCanPay(user);
    return this.finance.deleteCreditNote(id, cnId, user);
  }

  @Post(":id/credit-notes/:cnId/proof")
  @Roles("ACCOUNTANT")
  @UseInterceptors(FileInterceptor("file"))
  async uploadCreditNoteProof(
    @Param("id") id: string,
    @Param("cnId") cnId: string,
    @UploadedFile() file: any,
    @CurrentUser() user: SessionUser,
  ) {
    this.assertCanPay(user);
    const { path, name } = saveProof(file, "credit-note");
    await this.finance.setCreditNoteProof(id, cnId, path, name);
    return { name };
  }

  @Get(":id/credit-notes/:cnId/proof")
  @Roles("VIEWER")
  async viewCreditNoteProof(@Param("id") id: string, @Param("cnId") cnId: string, @Res() res: Response) {
    const cn = await this.finance.findCreditNoteForProof(id, cnId);
    serveInline(res, cn.proofPath, cn.proofName);
  }
}
