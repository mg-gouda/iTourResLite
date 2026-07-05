import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileInterceptor } from "@nestjs/platform-express";
import { extname, join } from "path";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "fs";
import * as nodemailer from "nodemailer";
import type { Response } from "express";
import { nights, bookingQuerySchema, bookingUpdateSchema, bookingWriteSchema, canEditPayment, type SessionUser } from "@itour/shared";
import { BookingsService } from "./bookings.service";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";

const ALLOWED_EXT = new Set([".eml", ".doc", ".docx", ".pdf", ".jpg", ".jpeg", ".png", ".msg"]);
const PAYMENT_PROOF_EXT = new Set([".pdf", ".jpeg", ".jpg", ".bmp", ".png"]);
// Content types for serving the payment proof inline (open in a new window).
const INLINE_MIME: Record<string, string> = {
  ".pdf": "application/pdf", ".jpeg": "image/jpeg", ".jpg": "image/jpeg",
  ".bmp": "image/bmp", ".png": "image/png",
};

@Controller("bookings")
export class BookingsController {
  constructor(private bookings: BookingsService, private prisma: PrismaService) {}

  @Get()
  list(@Query(new ZodValidationPipe(bookingQuerySchema)) q: any) {
    return this.bookings.list(q);
  }

  @Get("by-ref/:ref")
  byRef(@Param("ref") ref: string) {
    return this.bookings.byRef(ref);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.bookings.get(id);
  }

  @Post("parse-email")
  @Roles("AGENT")
  @UseInterceptors(FileInterceptor("file"))
  async parseEmail(@UploadedFile() file: any) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new BadRequestException("AI parser not configured — set GEMINI_API_KEY in environment.");
    if (!file?.buffer) throw new BadRequestException("Email file is required (.eml or .msg).");

    const ext = extname(file.originalname).toLowerCase();
    if (ext !== ".eml" && ext !== ".msg") throw new BadRequestException("Only .eml and .msg files are supported.");

    const emailText = ext === ".eml"
      ? file.buffer.toString("utf-8")
      : extractMsgText(file.buffer);

    if (!emailText.trim()) throw new BadRequestException("Could not extract text from this email file.");

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an intelligent hotel booking assistant for an Egyptian travel company. Parse the following operator email.

FIRST determine the email type, then extract the relevant fields.

Return ONLY valid JSON (no markdown, no explanation):
{
  "emailType": "booking" or "cancellation" — CRITICAL: check Subject line and body for words like CANCELLATION, CANCELLED, cancel, Status changed to Cancelled. If any cancellation signal found → "cancellation". Otherwise → "booking".",
  "toBookingRef": "the operator's booking/reservation reference number (the main reference, e.g. 17670350)",
  "tourOperatorName": "company name — check Subject line first, then From/Sender, signature, body. ALIASES: 'Jumbonline'/'Jumbo online' → 'Jumbo'; 'Paximum'/'PAXITL' → 'Paximum'.",
  "marketCode": "2-letter ISO country code. Infer from operator if not explicit: Jumbo/Jumbonline/TUI/DERTOUR/FTI → 'DE'. Paximum/PAXITL → 'TR'. French → 'FR'. UK → 'GB'. Italian → 'IT'.",
  "destinationCity": "Egyptian destination city right below or near the hotel name (e.g. 'Sharm El Sheikh', 'Hurghada', 'Marsa Alam')",
  "hotelName": "full hotel name",
  "roomTypeName": "room type description",
  "arrivalDate": "YYYY-MM-DD",
  "departureDate": "YYYY-MM-DD",
  "numRooms": 1,
  "roomCategory": "one of: SGL DBL TRPL QUAD TWN SUITE",
  "adults": 2,
  "children": 0,
  "infants": 0,
  "mealBasis": "one of: AI BB HB FB RO BED",
  "guestNames": [{"title": "Mr", "name": "Full Name"}],
  "sellingAmount": 0,
  "currency": "one of: USD EUR EGP GBP",
  "arrFlightNo": "arrival flight number",
  "depFlightNo": "departure flight number",
  "remarks": "special requests or notes"
}

RULES:
- emailType is MANDATORY — always include it.
- For cancellations: toBookingRef is the most important field (needed to find the booking). Extract hotel/dates too if present but they are secondary.
- The selling amount is ALWAYS the operator's selling price, never cost.
- For destinationCity: return the full city name as written.

EMAIL:
${emailText}`;

    let raw: string;
    try {
      const result = await model.generateContent(prompt);
      raw = result.response.text();
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.includes("429") || msg.includes("RATE_LIMIT")) throw new BadRequestException("AI service busy — try again in a moment.");
      throw new BadRequestException("AI parsing failed — please try again.");
    }

    let parsed: any;
    try {
      let cleaned = raw.trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      parsed = JSON.parse(cleaned.trim());
    } catch {
      throw new BadRequestException("AI returned an unreadable response — please try again.");
    }

    const emailType: string = (parsed.emailType ?? "booking").toLowerCase();

    // ── CANCELLATION flow ──────────────────────────────────────────────────────
    if (emailType === "cancellation") {
      const ref = parsed.toBookingRef;
      if (!ref) {
        return { _action: "cancellation_no_ref", message: "Cancellation email detected but no booking reference found." };
      }
      const existing = await this.prisma.booking.findFirst({
        where: { toBookingRef: String(ref), deletedAt: null },
        select: { id: true, toBookingRef: true, toStatus: true, internalRef: true, hotelStatus: true },
      });
      if (!existing) {
        return { _action: "cancellation_not_found", toBookingRef: ref, message: `Cancellation received for ref ${ref} — no matching booking found.` };
      }
      await this.prisma.booking.update({
        where: { id: existing.id },
        data: { toStatus: "CXL" },
      });
      return {
        _action: "cancelled",
        bookingId: existing.id,
        toBookingRef: existing.toBookingRef,
        internalRef: (existing as any).internalRef ?? null,
        prevToStatus: existing.toStatus,
        message: `Booking ${(existing as any).internalRef ?? existing.toBookingRef} has been marked as Cancelled.`,
      };
    }

    // ── DUPLICATE CHECK ────────────────────────────────────────────────────────
    if (parsed.toBookingRef) {
      const dup = await this.prisma.booking.findFirst({
        where: { toBookingRef: String(parsed.toBookingRef), deletedAt: null },
        select: { id: true, toBookingRef: true, internalRef: true, hotelStatus: true, toStatus: true },
      });
      if (dup) {
        return {
          _action: "duplicate",
          bookingId: dup.id,
          toBookingRef: dup.toBookingRef,
          internalRef: (dup as any).internalRef ?? null,
          hotelStatus: dup.hotelStatus,
          toStatus: dup.toStatus,
          message: `Booking ref ${dup.toBookingRef} already exists in the system.`,
        };
      }
    }

    // ── NEW BOOKING — DB match ─────────────────────────────────────────────────
    if (parsed.destinationCity && !parsed.resortId) {
      const resort = await this.matchResort(parsed.destinationCity);
      if (resort) parsed.resortId = resort.id;
    }

    if (parsed.hotelName) {
      const hotel = await this.matchHotel(parsed.hotelName);
      if (hotel) {
        parsed.hotelId = hotel.id;
        parsed.hotelName = hotel.name;
        if (hotel.resortId) parsed.resortId = hotel.resortId;
        if (parsed.roomTypeName) {
          const rt = await this.matchRoomType(hotel.id, parsed.roomTypeName);
          if (rt) {
            parsed.hotelRoomTypeId = rt.id;
            parsed.roomTypeName = rt.name;
          }
        }
      }
    }

    parsed._action = "booking";
    return parsed;
  }

  private words(s: string): string[] {
    return s.toLowerCase().split(/[\s\-–,.()/]+/).filter((w) => w.length >= 3);
  }

  private score(queryWords: string[], candidate: string): number {
    const cw = new Set(this.words(candidate));
    return queryWords.filter((w) => cw.has(w)).length;
  }

  private async matchResort(city: string) {
    const exact = await this.prisma.resort.findFirst({
      where: { name: { contains: city, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (exact) return exact;
    const qw = this.words(city);
    if (!qw.length) return null;
    const candidates = await this.prisma.resort.findMany({
      where: { OR: qw.map((w) => ({ name: { contains: w, mode: "insensitive" } })) },
      select: { id: true, name: true },
    });
    const scored = candidates.map((r) => ({ r, s: this.score(qw, r.name ?? "") })).sort((a, b) => b.s - a.s);
    return scored[0]?.s >= 1 ? scored[0].r : null;
  }

  private async matchHotel(name: string) {
    const qw = this.words(name);
    if (!qw.length) return null;

    // 1. Fast path: exact contains (handles most cases)
    const exact = await this.prisma.hotel.findFirst({
      where: { name: { contains: name, mode: "insensitive" }, active: true },
      select: { id: true, name: true, resortId: true },
    });
    if (exact) return exact;

    // 2. Scored fallback: pull candidates containing any significant word, pick best overlap
    const candidates = await this.prisma.hotel.findMany({
      where: {
        active: true,
        OR: qw.map((w) => ({ name: { contains: w, mode: "insensitive" } })),
      },
      select: { id: true, name: true, resortId: true },
    });
    if (!candidates.length) return null;
    const scored = candidates.map((h) => ({ h, s: this.score(qw, h.name) }));
    scored.sort((a, b) => b.s - a.s);
    // require at least 2 words matching, or single match only if only one candidate
    const best = scored[0];
    if (best.s >= 2 || (candidates.length === 1 && best.s >= 1)) return best.h;
    return null;
  }

  private async matchRoomType(hotelId: string, name: string) {
    const qw = this.words(name);
    if (!qw.length) return null;

    const exact = await this.prisma.hotelRoomType.findFirst({
      where: { hotelId, name: { contains: name, mode: "insensitive" }, active: true },
      select: { id: true, name: true },
    });
    if (exact) return exact;

    const candidates = await this.prisma.hotelRoomType.findMany({
      where: {
        hotelId,
        active: true,
        OR: qw.map((w) => ({ name: { contains: w, mode: "insensitive" } })),
      },
      select: { id: true, name: true },
    });
    if (!candidates.length) return null;
    const scored = candidates.map((r) => ({ r, s: this.score(qw, r.name) }));
    scored.sort((a, b) => b.s - a.s);
    const best = scored[0];
    if (best.s >= 1) return best.r;
    return null;
  }

  @Post()
  @Roles("AGENT") // AGENT+ (Accountant excluded from create; can only edit financial fields).
  create(@Body(new ZodValidationPipe(bookingWriteSchema)) dto: any, @CurrentUser() user: SessionUser) {
    return this.bookings.create(dto, user);
  }

  @Patch(":id")
  @Roles("ACCOUNTANT") // ACCOUNTANT allowed but field-gated in service; AGENT+ full.
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(bookingUpdateSchema)) dto: any,
    @CurrentUser() user: SessionUser,
  ) {
    return this.bookings.update(id, dto, user);
  }

  @Delete(":id")
  @Roles("MANAGER")
  remove(@Param("id") id: string, @CurrentUser() user: SessionUser) {
    return this.bookings.remove(id, user);
  }

  // Compose the hotel booking email (subject / from / to / html / text /
  // attachments). Shared by both "send via SMTP" and "download as .eml".
  private async composeHotelMail(id: string): Promise<{ options: nodemailer.SendMailOptions; cfg: Record<string, string>; filename: string }> {
    const b = await this.prisma.booking.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        hotel: { select: { name: true, email: true } },
        hotelRoomType: true,
        guestNameList: { orderBy: { sortOrder: "asc" } },
      },
    });
    const nts = nights(b.arrivalDate, b.departureDate);
    const fmt = (d: Date) => {
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${String(d.getDate()).padStart(2,"0")}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
    };
    const arr = fmt(b.arrivalDate);
    const dep = fmt(b.departureDate);
    const allGuests = (b as any).guestNameList as { title: string; name: string; type: string }[];
    const rebookGuests = allGuests.filter((g) => g.type === "REBOOK");
    const hotelGuests  = allGuests.filter((g) => g.type === "HOTEL");
    const effectiveGuests = rebookGuests.length ? rebookGuests : hotelGuests;
    const guests = effectiveGuests.length
      ? effectiveGuests.map((g) => `${g.title} ${g.name}`).join(", ")
      : (b.guestNames ?? "—");

    // Friendlier status wording for the hotel-facing email.
    const STATUS_LABEL: Record<string, string> = { Confirmed: "New Booking", CXL: "Cancelled" };
    const displayStatus = STATUS_LABEL[b.hotelStatus] ?? b.hotelStatus;
    const isCancellation = b.hotelStatus === "CXL";
    const introLine = isCancellation
      ? "Regret to ask you to cancel the below booking."
      : "Kindly reserve and confirm the following booking according to current valid rate.";
    const subject = `${displayStatus} @ ${b.hotel.name} - ${(b as any).internalRef ?? b.toBookingRef}`;
    const hotelEmail = (b.hotel as any).email as string | null;
    const spoPath    = (b as any).spoDocumentPath as string | null;
    const spoName    = (b as any).spoDocumentName as string | null;
    const hasSpo     = !!(spoPath && existsSync(spoPath));

    // Read all config in one query
    const cfgRows = await this.prisma.systemConfig.findMany();
    const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value]));
    const companyName = cfg.companyName ?? "Fulvago Travel";

    // HTML email — inline styles for email client compatibility
    const cell = (label: string, value: string) =>
      `<tr>` +
      `<td style="padding:10px 16px;background:#f3f6fb;font-weight:600;font-size:13px;border-bottom:1px solid #dde3ed;white-space:nowrap;vertical-align:top;color:#374151">${label}</td>` +
      `<td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #dde3ed;vertical-align:top;color:#111827">${value}</td>` +
      `</tr>`;

    const tableRows =
      cell("Hotel", b.hotel.name) +
      cell("Room Type", b.hotelRoomType.name) +
      cell("No. of Rooms", String(b.numRooms)) +
      cell("Room Occupancy", b.roomCategory) +
      cell("Arrival Date", arr) +
      cell("Departure Date", dep) +
      cell("Nights", String(nts)) +
      cell("Meal Basis", b.mealBasis) +
      cell("Guest Names", guests) +
      ((b as any).hotelRemarks ? cell("Special Requests", (b as any).hotelRemarks) : "");

    const html =
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
      `<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827">` +
      `<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10)">` +
      `<div style="background:#1e3a5f;padding:24px 32px">` +
      `<p style="margin:0;font-size:18px;font-weight:700;color:#fff;letter-spacing:0.3px">${companyName}</p>` +
      `<p style="margin:6px 0 0;font-size:11px;color:#93c5fd;letter-spacing:1px;text-transform:uppercase">Hotel Reservation</p>` +
      `</div>` +
      `<div style="padding:32px">` +
      `<p style="margin:0 0 6px;font-size:14px">Dear Partner,</p>` +
      `<p style="margin:0 0 6px;font-size:14px">Greetings from <strong>${companyName}</strong>.</p>` +
      `<p style="margin:0 0 6px;font-size:14px">First of all let me seize this opportunity to thank you for your co-operation &amp; support is always expected.</p>` +
      `<p style="margin:0 0 24px;font-size:14px">${introLine}</p>` +
      `<table style="width:auto;margin:0;border-collapse:collapse;border:1px solid #dde3ed;border-radius:6px;overflow:hidden"><tbody>${tableRows}</tbody></table>` +
      (hasSpo ? `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;font-style:italic">&#128206; Please find the SPO document &ldquo;${spoName}&rdquo; attached to this email.</p>` : ``) +
      `<p style="margin:32px 0 4px;font-size:14px">Thanks &amp; Best regards,</p>` +
      `<p style="margin:0;font-size:14px;font-weight:700">${companyName}</p>` +
      `</div></div></body></html>`;

    // Plain text fallback
    const plainBody =
      `Dear Partner,\r\n\r\nGreetings from ${companyName}.\r\n\r\n` +
      `${introLine}\r\n\r\n` +
      [
        `Hotel:          ${b.hotel.name}`,
        `Room Type:      ${b.hotelRoomType.name}`,
        `No. of Rooms:   ${b.numRooms}`,
        `Room Occupancy: ${b.roomCategory}`,
        `Arrival:        ${arr}`,
        `Departure:      ${dep}`,
        `Nights:         ${nts}`,
        `Meal Basis:     ${b.mealBasis}`,
        `Guest Names:    ${guests}`,
        ...((b as any).hotelRemarks ? [`Special Req.:   ${(b as any).hotelRemarks}`] : []),
      ].join("\r\n") +
      (hasSpo ? `\r\n\r\n[Attached: ${spoName}]` : ``) +
      `\r\n\r\nThanks & Best regards,\r\n${companyName}`;

    const fromField = cfg.smtpFromName
      ? `"${cfg.smtpFromName}" <${cfg.smtpFrom}>`
      : (cfg.smtpFrom ?? "reservations@example.com");

    const ref = String((b as any).internalRef ?? b.toBookingRef ?? "booking").replace(/[^\w.-]+/g, "_");
    return {
      options: {
        from: fromField,
        to: hotelEmail ?? "",
        subject,
        html,
        text: plainBody,
        attachments: hasSpo ? [{ filename: spoName ?? "spo-document", path: spoPath! }] : [],
      },
      cfg,
      filename: `Hotel-Booking-${ref}.eml`,
    };
  }

  // Kept for backward compatibility: still sends via SMTP if configured.
  @Post(":id/send-hotel-email")
  @Roles("AGENT")
  async sendHotelEmail(@Param("id") id: string) {
    const { options, cfg } = await this.composeHotelMail(id);
    if (!cfg.smtpHost) {
      throw new BadRequestException("Email not configured. Go to System Parameters → Email Settings and fill in the SMTP details.");
    }
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: Number(cfg.smtpPort ?? 587),
      secure: cfg.smtpSecure === "true",
      auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass ?? "" } : undefined,
    });
    try {
      await transporter.sendMail(options);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      // Surface a readable hint for the most common misconfigurations
      if (msg.includes("wrong version number") || msg.includes("SSL")) {
        throw new BadRequestException("SMTP connection failed: SSL/TLS mismatch. If using port 587 uncheck SSL/TLS; for port 465 check it.");
      }
      if (msg.includes("ECONNREFUSED")) {
        throw new BadRequestException(`SMTP connection refused — check host/port in Email Settings.`);
      }
      if (msg.includes("Invalid login") || msg.includes("auth") || msg.includes("535")) {
        throw new BadRequestException("SMTP authentication failed — check username and password in Email Settings.");
      }
      throw new BadRequestException(`Email send failed: ${msg}`);
    }
    return { sent: true };
  }

  // New "send to hotel" mechanism: download the composed message as a .eml
  // file (opens in Outlook / Apple Mail / Thunderbird) instead of sending.
  @Get(":id/hotel-email.eml")
  @Roles("AGENT")
  async downloadHotelEmail(@Param("id") id: string, @Res() res: Response) {
    const { options, filename } = await this.composeHotelMail(id);
    // X-Unsent:1 tells Outlook / desktop mail clients to open the .eml in
    // compose/edit mode (editable body, add/change recipient, then Send)
    // instead of read-only "received message" mode.
    (options as any).headers = { ...(options as any).headers, "X-Unsent": "1" };
    // Build a standards-compliant RFC-822 message from the same mail options.
    const MailComposer = require("nodemailer/lib/mail-composer");
    const raw: Buffer = await new Promise((resolve, reject) => {
      new MailComposer(options).compile().build((err: Error | null, message: Buffer) => {
        if (err) reject(err); else resolve(message);
      });
    });
    res.setHeader("Content-Type", "message/rfc822");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(raw);
  }

  @Post(":id/upload-spo")
  @Roles("AGENT")
  @UseInterceptors(FileInterceptor("file"))
  async uploadSpo(@Param("id") id: string, @UploadedFile() file: any) {
    if (!file) throw new Error("No file provided");
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw new Error(`File type ${ext} not allowed`);
    // Resolve and create upload dir lazily (no module-level I/O)
    const candidates = [
      join(process.cwd(), "uploads", "spo"),                        // cwd = apps/api when run via pnpm dev
      join(__dirname, "..", "..", "..", "uploads", "spo"),          // ts-node-dev: __dirname = src/modules/bookings
      join(__dirname, "..", "..", "..", "..", "apps", "api", "uploads", "spo"), // monorepo root cwd fallback
    ];
    let uploadDir = candidates[0];
    for (const dir of candidates) {
      try { mkdirSync(dir, { recursive: true }); uploadDir = dir; break; } catch { /* try next */ }
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    writeFileSync(join(uploadDir, filename), file.buffer);
    await this.prisma.booking.update({
      where: { id },
      data: { spoDocumentPath: join(uploadDir, filename), spoDocumentName: file.originalname },
    });
    return { name: file.originalname };
  }

  @Get(":id/spo-document")
  @Roles("VIEWER")
  async downloadSpo(@Param("id") id: string, @Res() res: Response) {
    const b = await this.prisma.booking.findFirstOrThrow({ where: { id, deletedAt: null }, select: { spoDocumentPath: true, spoDocumentName: true } });
    if (!b.spoDocumentPath) { res.status(404).json({ message: "No SPO document" }); return; }
    if (!existsSync(b.spoDocumentPath)) { res.status(404).json({ message: "File not found on disk" }); return; }
    res.setHeader("Content-Disposition", `attachment; filename="${b.spoDocumentName ?? b.spoDocumentPath}"`);
    createReadStream(b.spoDocumentPath).pipe(res);
  }

  // ── Payment proof (Accountant/Manager) — parallels the SPO document flow ──
  @Post(":id/upload-payment-proof")
  @Roles("ACCOUNTANT") // rank guard; exact Accountant/Manager/Admin gate below
  @UseInterceptors(FileInterceptor("file"))
  async uploadPaymentProof(@Param("id") id: string, @UploadedFile() file: any, @CurrentUser() user: SessionUser) {
    if (!canEditPayment(user.role)) throw new BadRequestException("Only Accountant or Manager can upload payment proof.");
    if (!file) throw new BadRequestException("No file provided");
    const ext = extname(file.originalname).toLowerCase();
    if (!PAYMENT_PROOF_EXT.has(ext)) throw new BadRequestException(`File type ${ext} not allowed. Accepted: .pdf .jpeg .jpg .bmp .png`);
    const candidates = [
      join(process.cwd(), "uploads", "payment-proof"),
      join(__dirname, "..", "..", "..", "uploads", "payment-proof"),
      join(__dirname, "..", "..", "..", "..", "apps", "api", "uploads", "payment-proof"),
    ];
    let uploadDir = candidates[0];
    for (const dir of candidates) {
      try { mkdirSync(dir, { recursive: true }); uploadDir = dir; break; } catch { /* try next */ }
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    writeFileSync(join(uploadDir, filename), file.buffer);
    await this.prisma.booking.update({
      where: { id },
      data: { paymentProofPath: join(uploadDir, filename), paymentProofName: file.originalname },
    });
    return { name: file.originalname };
  }

  // Served inline (not as an attachment) so the report's icon button can open
  // the proof directly in a new browser tab.
  @Get(":id/payment-proof")
  @Roles("VIEWER")
  async viewPaymentProof(@Param("id") id: string, @Res() res: Response) {
    const b = await this.prisma.booking.findFirstOrThrow({ where: { id, deletedAt: null }, select: { paymentProofPath: true, paymentProofName: true } });
    if (!b.paymentProofPath) { res.status(404).json({ message: "No payment proof" }); return; }
    if (!existsSync(b.paymentProofPath)) { res.status(404).json({ message: "File not found on disk" }); return; }
    const ext = extname(b.paymentProofPath).toLowerCase();
    res.setHeader("Content-Type", INLINE_MIME[ext] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${b.paymentProofName ?? b.paymentProofPath}"`);
    createReadStream(b.paymentProofPath).pipe(res);
  }
}

// Extract readable text from an Outlook .msg binary (Compound Document File).
// Scans ASCII runs and UTF-16LE blocks — no CFB parser needed.
function extractMsgText(buf: Buffer): string {
  const segments = new Set<string>();

  // Pass 1: ASCII printable runs ≥ 8 chars
  let run = "";
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 32 && b < 127) run += String.fromCharCode(b);
    else if ((b === 9 || b === 10 || b === 13) && run.length) run += " ";
    else { if (run.trim().length >= 8) segments.add(run.trim()); run = ""; }
  }
  if (run.trim().length >= 8) segments.add(run.trim());

  // Pass 2: UTF-16LE runs (body/subject stored as UTF-16LE in MSG)
  let u16 = "";
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const cp = buf.readUInt16LE(i);
    if (cp >= 32 && cp < 127) u16 += String.fromCharCode(cp);
    else if ((cp === 9 || cp === 10 || cp === 13) && u16.length) u16 += " ";
    else { if (u16.trim().length >= 8) segments.add(u16.trim()); u16 = ""; }
  }
  if (u16.trim().length >= 8) segments.add(u16.trim());

  // Drop MAPI stream names, Exchange paths, SMTP noise, base64 blobs, pure-hex / pure-digit noise
  const filtered = [...segments].filter(s =>
    !/exchangelabs/i.test(s) &&
    !/^EX:\//i.test(s) &&
    !/__substg/i.test(s) &&
    !/^[A-Za-z0-9+/=]{40,}$/.test(s) &&
    !/^[0-9a-fA-F]{8,}$/.test(s) &&
    !/^[0-9]{6,}$/.test(s) &&
    !/^(Received|DKIM-Signature|Authentication-Results|ARC-|X-MS-|Return-Path|Content-Type|MIME-Version):/i.test(s),
  );

  // Sort: subject/operator/city/booking keywords to the top
  const BOOKING_RE = /subject|from:|jumbonline|jumbo|hotel|sharm|hurghada|arrival|departure|check.?in|reservation|room|pax|passenger|guest|EUR|USD|EGP|GBP|nights|booking|ref|confirm|operator/i;
  filtered.sort((a, b) => {
    const aHit = BOOKING_RE.test(a) ? 0 : 1;
    const bHit = BOOKING_RE.test(b) ? 0 : 1;
    return aHit - bHit;
  });

  return filtered.join("\n").slice(0, 25000);
}
