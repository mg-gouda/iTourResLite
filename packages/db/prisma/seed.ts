/**
 * Seed + legacy data migration (see iTourResLite.md §8).
 * Reads JSON extracted from W25-26 Fulvago.xlsm (packages/db/seed-data/*).
 * Re-runnable: lookups/hotels/users are upserted; bookings + stop sales are replaced.
 */
import { readFileSync } from "node:fs";
import { hashPassword } from "../../shared/src/password";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

function load<T>(file: string): T {
  return JSON.parse(
    readFileSync(new URL(`../seed-data/${file}`, import.meta.url), "utf8"),
  ) as T;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim().toUpperCase();
const stripSuffix = (s: string) => norm(s).replace(/\s*\([^)]*\)\s*$/, "").trim();
const suffixCode = (s: string) => {
  const m = (s ?? "").match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim().toUpperCase() : null;
};

// String value maps (no Prisma enums — fields are String in schema)
const STATUS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  CXL: "CXL",
  PENDING: "Pending",
  SENT: "Sent",
  "NO SHOW": "NoShow",
  BUBBLE: "Bubble",
  "STOP SALE": "StopSale",
};
const ROOMCAT: Record<string, string> = {
  DBL: "DBL",
  SGL: "SGL",
  TPL: "TPL",
  FAMILY: "Family",
  SUITE: "Suite",
  "J. SUITE": "JSuite",
};
const MEAL: Record<string, string> = {
  AI: "AI",
  BB: "BB",
  HB: "HB",
  FB: "FB",
  SAI: "SAI",
  BO: "BO",
};
const PAY: Record<string, string> = {
  VCR: "VCR",
  CASH: "Cash",
  DD: "DD",
  BUBBLE: "Bubble",
  "3RD PARTY": "ThirdParty",
};

const RESORT_NAMES: Record<string, string> = {
  SSH: "Sharm El Sheikh",
  HRG: "Hurghada",
  LXR: "Luxor",
  CAI: "Cairo",
  RMF: "Marsa Alam",
  TCP: "Taba / Coraya",
  MAK: "Makadi Bay",
  SAF: "Safaga",
  SMB: "Soma Bay",
  SAH: "Sahl Hasheesh",
  DHB: "Dahab",
  NWB: "Nuweiba",
};
const MARKET_NAMES: Record<string, string> = {
  WE: "West Market",
  EE: "East European",
  UK: "United Kingdom",
  TUR: "Turkish",
  IT: "Italian",
  FR: "French",
  EGY: "Egyptian",
};
const TO_NAMES: Record<string, string> = {
  PAX: "PAX",
  JMB: "Jumbo",
  MYW: "MyWay",
  TRV: "Travel",
  "REHLA.COM": "Rehla.Com",
  IND: "IND",
};

function toDate(iso: string | null): Date | null {
  return iso ? new Date(iso + "T00:00:00.000Z") : null;
}

async function main() {
  const lookups = load<Record<string, string[]>>("lookups.json");
  const hotelsJson = load<{ name: string; roomTypes: { name: string; allocation: number }[] }[]>("hotels.json");
  const stopsales = load<{ hotel: string; roomType: string | null; qty: number; fromDate: string | null; toDate: string | null }[]>("stopsales.json");
  const bookings = load<Record<string, any>[]>("bookings.json");

  // ---- Admin-editable lookup tables (6 new) ----
  const bookingStatuses = [
    { code: "Confirmed", label: "Confirmed", sortOrder: 0 },
    { code: "Pending",   label: "Pending",   sortOrder: 1 },
    { code: "Sent",      label: "Sent",       sortOrder: 2 },
    { code: "CXL",       label: "CXL",        sortOrder: 3 },
    { code: "NoShow",    label: "No Show",    sortOrder: 4 },
    { code: "Bubble",    label: "Bubble",     sortOrder: 5 },
    { code: "StopSale",  label: "Stop Sale",  sortOrder: 6 },
  ];
  for (const s of bookingStatuses) {
    await prisma.bookingStatusLookup.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  const roomCategories = [
    { code: "DBL",    label: "DBL",      sortOrder: 0 },
    { code: "SGL",    label: "SGL",      sortOrder: 1 },
    { code: "TPL",    label: "TPL",      sortOrder: 2 },
    { code: "Family", label: "Family",   sortOrder: 3 },
    { code: "Suite",  label: "Suite",    sortOrder: 4 },
    { code: "JSuite", label: "J. Suite", sortOrder: 5 },
  ];
  for (const r of roomCategories) {
    await prisma.roomCategoryLookup.upsert({ where: { code: r.code }, update: {}, create: r });
  }

  const mealBases = [
    { code: "AI",  label: "All Inclusive",    sortOrder: 0 },
    { code: "BB",  label: "Bed & Breakfast",  sortOrder: 1 },
    { code: "HB",  label: "Half Board",       sortOrder: 2 },
    { code: "FB",  label: "Full Board",       sortOrder: 3 },
    { code: "SAI", label: "Soft All Inc",     sortOrder: 4 },
    { code: "BO",  label: "Bed Only",         sortOrder: 5 },
  ];
  for (const m of mealBases) {
    await prisma.mealBasisLookup.upsert({ where: { code: m.code }, update: {}, create: m });
  }

  const payMethods = [
    { code: "VCR",        label: "VCR",       sortOrder: 0 },
    { code: "Cash",       label: "Cash",      sortOrder: 1 },
    { code: "DD",         label: "DD",        sortOrder: 2 },
    { code: "Bubble",     label: "Bubble",    sortOrder: 3 },
    { code: "ThirdParty", label: "3rd Party", sortOrder: 4 },
  ];
  for (const p of payMethods) {
    await prisma.paymentMethodLookup.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  const currencies = [
    { code: "USD", label: "US Dollar",   sortOrder: 0 },
    { code: "EUR", label: "Euro",        sortOrder: 1 },
    { code: "GBP", label: "Pound",       sortOrder: 2 },
    { code: "EGP", label: "Egyptian £",  sortOrder: 3 },
  ];
  for (const c of currencies) {
    await prisma.currencyLookup.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  const spos = [
    { code: "Yes", label: "Yes", sortOrder: 0 },
    { code: "N/A", label: "N/A", sortOrder: 1 },
  ];
  for (const s of spos) {
    await prisma.spoLookup.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  // ---- Users (demo accounts; password = "Passw0rd!") ----
  const pw = await hashPassword("Passw0rd!");
  const users: { email: string; name: string; role: Role }[] = [
    { email: "admin@itour.app",      name: "System Admin",          role: Role.ADMIN },
    { email: "manager@itour.app",    name: "Reservations Manager",  role: Role.MANAGER },
    { email: "agent@itour.app",      name: "Reservations Agent",    role: Role.AGENT },
    { email: "accountant@itour.app", name: "Accountant",            role: Role.ACCOUNTANT },
    { email: "viewer@itour.app",     name: "Viewer",                role: Role.VIEWER },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { ...u, passwordHash: pw },
    });
  }
  const admin = await prisma.user.findUnique({ where: { email: "admin@itour.app" } });

  // ---- Resorts ----
  for (const code of lookups.resort) {
    await prisma.resort.upsert({
      where: { code }, update: {},
      create: { code, name: RESORT_NAMES[code] ?? code },
    });
  }
  const resortByCode = new Map((await prisma.resort.findMany()).map((r) => [r.code, r.id]));

  // ---- Markets (include EGY) ----
  const allMarketCodes = [...new Set([...lookups.market, "EGY"])];
  for (const code of allMarketCodes) {
    await prisma.market.upsert({
      where: { code }, update: {},
      create: { code, name: MARKET_NAMES[code] ?? code },
    });
  }
  const marketByCode = new Map((await prisma.market.findMany()).map((m) => [m.code, m.id]));

  // ---- Tour Operators (include Rehla.Com, IND) ----
  const allToCodes = [...new Set([...lookups.tourOperator, "REHLA.COM", "IND"])];
  for (const code of allToCodes) {
    await prisma.tourOperator.upsert({
      where: { code }, update: {},
      create: { code, name: TO_NAMES[code] ?? code },
    });
  }
  const toByCode = new Map((await prisma.tourOperator.findMany()).map((t) => [t.code, t.id]));

  // ---- Hotels + room types ----
  for (const h of hotelsJson) {
    const code = suffixCode(h.name);
    const resortId = code && resortByCode.has(code) ? resortByCode.get(code)! : null;
    const hotel = await prisma.hotel.upsert({
      where: { name: h.name }, update: { resortId },
      create: { name: h.name, resortId },
    });
    for (const rt of h.roomTypes) {
      await prisma.hotelRoomType.upsert({
        where: { hotelId_name: { hotelId: hotel.id, name: rt.name } },
        update: { allocation: rt.allocation },
        create: { hotelId: hotel.id, name: rt.name, allocation: rt.allocation },
      });
    }
  }

  const allHotels = await prisma.hotel.findMany();
  const hotelByStripped = new Map<string, string>();
  const hotelByExact = new Map<string, string>();
  for (const h of allHotels) {
    hotelByExact.set(norm(h.name), h.id);
    hotelByStripped.set(stripSuffix(h.name), h.id);
  }
  async function resolveOrCreateHotel(name: string): Promise<string> {
    const found = hotelByExact.get(norm(name)) ?? hotelByStripped.get(stripSuffix(name));
    if (found) return found;
    const code = suffixCode(name);
    const resortId = code && resortByCode.has(code) ? resortByCode.get(code)! : null;
    const clean = (name ?? "").trim() || "UNKNOWN HOTEL";
    const created = await prisma.hotel.upsert({ where: { name: clean }, update: {}, create: { name: clean, resortId } });
    hotelByExact.set(norm(created.name), created.id);
    hotelByStripped.set(stripSuffix(created.name), created.id);
    console.warn(`  [unmatched hotel created] ${clean}`);
    return created.id;
  }

  const rtRows = await prisma.hotelRoomType.findMany();
  const rtIndex = new Map<string, string>();
  for (const rt of rtRows) rtIndex.set(`${rt.hotelId}|${norm(rt.name)}`, rt.id);
  async function resolveRoomTypeId(hotelId: string, name: string | null): Promise<string> {
    const key = `${hotelId}|${norm(name)}`;
    if (name && rtIndex.has(key)) return rtIndex.get(key)!;
    const created = await prisma.hotelRoomType.create({
      data: { hotelId, name: (name ?? "UNSPECIFIED").trim() || "UNSPECIFIED", allocation: 0 },
    });
    rtIndex.set(`${hotelId}|${norm(created.name)}`, created.id);
    return created.id;
  }

  // ---- Replace bookings + stop sales ----
  // HARDENING: this section wipes and reseeds bookings + stop-sales. On a
  // populated (live) database that would destroy real data, so it only runs
  // when the bookings table is empty, or when explicitly forced with
  // FORCE_SEED=true. The lookup/hotel/user upserts above are non-destructive
  // and always run.
  const stats = { bookings: 0, skipped: 0, stopsales: 0, ssSkipped: 0 };
  const existingBookings = await prisma.booking.count();
  const force = process.env.FORCE_SEED === "true";
  if (existingBookings > 0 && !force) {
    console.log(`Seed: ${existingBookings} bookings already present — skipping destructive bookings/stop-sales reseed (set FORCE_SEED=true to override).`);
    console.log("Seed complete:", JSON.stringify(stats));
    return;
  }
  await prisma.booking.deleteMany();
  await prisma.stopSale.deleteMany();

  for (const b of bookings) {
    const arr = toDate(b.arrivalDate);
    const dep = toDate(b.departureDate);
    if (!arr || !dep) { stats.skipped++; continue; }
    const hotelId = await resolveOrCreateHotel(b.hotel);

    const resortCode = norm(b.resort);
    const resortId = resortByCode.get(resortCode)
      ?? (await prisma.resort.upsert({ where: { code: resortCode || "UNK" }, update: {}, create: { code: resortCode || "UNK", name: resortCode || "Unknown" } })).id;
    if (resortCode && !resortByCode.has(resortCode)) resortByCode.set(resortCode, resortId);

    const toCode = norm(b.tourOperator) || "UNK";
    let toId = toByCode.get(toCode);
    if (!toId) { toId = (await prisma.tourOperator.upsert({ where: { code: toCode }, update: {}, create: { code: toCode } })).id; toByCode.set(toCode, toId); }

    const mCode = norm(b.market) || "UNK";
    let mId = marketByCode.get(mCode);
    if (!mId) { mId = (await prisma.market.upsert({ where: { code: mCode }, update: {}, create: { code: mCode } })).id; marketByCode.set(mCode, mId); }

    const rtId = await resolveRoomTypeId(hotelId, b.roomType);

    await prisma.booking.create({
      data: {
        bookingDate: toDate(b.bookingDate) ?? arr,
        hotelStatus: STATUS[norm(b.hotelStatus)] ?? "Pending",
        toStatus:    STATUS[norm(b.toStatus)]    ?? "Pending",
        tourOperatorId: toId,
        marketId: mId,
        toBookingRef: String(b.toBookingRef ?? "").trim() || "—",
        sejourRef: b.sejourRef ? String(b.sejourRef) : null,
        fileNumber: b.fileNumber ? String(b.fileNumber) : null,
        resortId,
        hotelId,
        hotelRoomTypeId: rtId,
        arrivalDate: arr,
        departureDate: dep,
        roomCategory: ROOMCAT[norm(b.roomCategory)] ?? "DBL",
        numRooms: Number.isFinite(b.numRooms) ? Math.max(1, Math.trunc(b.numRooms)) : 1,
        adults: int(b.adults), children: int(b.children), infants: int(b.infants),
        mealBasis: MEAL[norm(b.mealBasis)] ?? "AI",
        guestNames: b.guestNames ?? null,
        child1Age: int0(b.child1Age), child1Dob: toDate(b.child1Dob),
        child2Age: int0(b.child2Age), child2Dob: toDate(b.child2Dob),
        bookingCurrency:  b.bookingCurrency ?? null,
        costUsd: dec(b.costUsd), sellingUsd: dec(b.sellingUsd), calculationUsd: b.calculationUsd ?? null,
        costEur: dec(b.costEur), sellingEur: dec(b.sellingEur), calculationEur: b.calculationEur ?? null,
        costEgp: dec(b.costEgp), sellingEgp: dec(b.sellingEgp),
        paymentMethod: PAY[norm(b.paymentMethod)] ?? "Cash",
        paymentOptionDate: toDate(b.paymentOptionDate),
        visaHandling: dec(b.visaHandling),
        arrFlightNo: b.arrFlightNo ?? null, arrFlightTime: b.arrFlightTime ?? null,
        depFlightNo: b.depFlightNo ?? null, depFlightTime: b.depFlightTime ?? null,
        meetAssistVisa: b.meetAssistVisa ?? null,
        remarks: b.remarks ?? null,
        ebdPercent: dec(b.ebdPercent), ebdPaymentDate: toDate(b.ebdPaymentDate),
        guestNameRebooked: b.guestNameRebooked ?? null,
        roomCatsJson: b.roomCatsJson ?? null,
        internalRef: b.internalRef ?? null,
        createdById: admin?.id ?? null,
      },
    });
    stats.bookings++;
  }

  for (const s of stopsales) {
    const from = toDate(s.fromDate);
    const to = toDate(s.toDate) ?? from;
    if (!from) { stats.ssSkipped++; continue; }
    const hotelId = await resolveOrCreateHotel(s.hotel);
    const rtId = s.roomType ? await resolveRoomTypeId(hotelId, s.roomType) : null;
    await prisma.stopSale.create({
      data: { hotelId, hotelRoomTypeId: rtId, qty: Number.isFinite(s.qty) ? s.qty : 0, fromDate: from, toDate: to! },
    });
    stats.stopsales++;
  }

  console.log("Seed complete:", JSON.stringify(stats));
}

const int = (v: any) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
const int0 = (v: any) => (Number.isFinite(v) ? Math.trunc(v) : null);
const dec = (v: any) => (Number.isFinite(v) ? Number(v) : 0);

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
