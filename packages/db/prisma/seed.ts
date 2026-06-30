/**
 * Seed + legacy data migration (see iTourResLite.md §8).
 * Reads JSON extracted from W25-26 Fulvago.xlsm (packages/db/seed-data/*).
 * Re-runnable: lookups/hotels/users are upserted; bookings + stop sales are replaced.
 */
import { readFileSync } from "node:fs";
import { hashPassword } from "@itour/shared";
import {
  PrismaClient,
  BookingStatus,
  RoomCategory,
  MealBasis,
  PaymentMethod,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();

function load<T>(file: string): T {
  return JSON.parse(
    readFileSync(new URL(`../seed-data/${file}`, import.meta.url), "utf8"),
  ) as T;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim().toUpperCase();
// Drop a trailing "(XXX)" resort-code suffix for fuzzy hotel matching.
const stripSuffix = (s: string) => norm(s).replace(/\s*\([^)]*\)\s*$/, "").trim();
const suffixCode = (s: string) => {
  const m = (s ?? "").match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim().toUpperCase() : null;
};

const STATUS: Record<string, BookingStatus> = {
  CONFIRMED: BookingStatus.Confirmed,
  CXL: BookingStatus.CXL,
  PENDING: BookingStatus.Pending,
  SENT: BookingStatus.Sent,
  "NO SHOW": BookingStatus.NoShow,
  BUBBLE: BookingStatus.Bubble,
  "STOP SALE": BookingStatus.StopSale,
};
const ROOMCAT: Record<string, RoomCategory> = {
  DBL: RoomCategory.DBL,
  SGL: RoomCategory.SGL,
  TPL: RoomCategory.TPL,
  FAMILY: RoomCategory.Family,
  SUITE: RoomCategory.Suite,
  "J. SUITE": RoomCategory.JSuite,
};
const MEAL: Record<string, MealBasis> = {
  AI: MealBasis.AI,
  BB: MealBasis.BB,
  HB: MealBasis.HB,
  FB: MealBasis.FB,
  SAI: MealBasis.SAI,
  BO: MealBasis.BO,
};
const PAY: Record<string, PaymentMethod> = {
  VCR: PaymentMethod.VCR,
  CASH: PaymentMethod.Cash,
  DD: PaymentMethod.DD,
  BUBBLE: PaymentMethod.Bubble,
  "3RD PARTY": PaymentMethod.ThirdParty,
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
};
const TO_NAMES: Record<string, string> = {
  PAX: "PAX",
  JMB: "Jumbo",
  MYW: "MyWay",
  TRV: "Travel",
};

function toDate(iso: string | null): Date | null {
  return iso ? new Date(iso + "T00:00:00.000Z") : null;
}

async function main() {
  const lookups = load<Record<string, string[]>>("lookups.json");
  const hotelsJson = load<{ name: string; roomTypes: { name: string; allocation: number }[] }[]>("hotels.json");
  const stopsales = load<{ hotel: string; roomType: string | null; qty: number; fromDate: string | null; toDate: string | null }[]>("stopsales.json");
  const bookings = load<Record<string, any>[]>("bookings.json");

  // ---- Users (demo accounts; password = "Passw0rd!") ----
  const pw = await hashPassword("Passw0rd!");
  const users: { email: string; name: string; role: Role }[] = [
    { email: "admin@itour.app", name: "System Admin", role: Role.ADMIN },
    { email: "manager@itour.app", name: "Reservations Manager", role: Role.MANAGER },
    { email: "agent@itour.app", name: "Reservations Agent", role: Role.AGENT },
    { email: "accountant@itour.app", name: "Accountant", role: Role.ACCOUNTANT },
    { email: "viewer@itour.app", name: "Viewer", role: Role.VIEWER },
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

  // ---- Markets ----
  for (const code of lookups.market) {
    await prisma.market.upsert({
      where: { code }, update: {},
      create: { code, name: MARKET_NAMES[code] ?? code },
    });
  }
  const marketByCode = new Map((await prisma.market.findMany()).map((m) => [m.code, m.id]));

  // ---- Tour Operators ----
  for (const code of lookups.tourOperator) {
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

  // Fuzzy hotel index (suffix-stripped, normalized)
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
    // Create-on-miss so no booking is dropped; flag via console for manual merge.
    const code = suffixCode(name);
    const resortId = code && resortByCode.has(code) ? resortByCode.get(code)! : null;
    const clean = (name ?? "").trim() || "UNKNOWN HOTEL";
    const created = await prisma.hotel.upsert({ where: { name: clean }, update: {}, create: { name: clean, resortId } });
    hotelByExact.set(norm(created.name), created.id);
    hotelByStripped.set(stripSuffix(created.name), created.id);
    console.warn(`  [unmatched hotel created] ${clean}`);
    return created.id;
  }

  // Room-type index per hotel
  const rtRows = await prisma.hotelRoomType.findMany();
  const rtIndex = new Map<string, string>(); // `${hotelId}|${NORMNAME}` -> rtId
  for (const rt of rtRows) rtIndex.set(`${rt.hotelId}|${norm(rt.name)}`, rt.id);
  async function resolveRoomTypeId(hotelId: string, name: string | null): Promise<string> {
    const key = `${hotelId}|${norm(name)}`;
    if (name && rtIndex.has(key)) return rtIndex.get(key)!;
    // Create-on-miss so no booking is dropped (alloc 0).
    const created = await prisma.hotelRoomType.create({
      data: { hotelId, name: (name ?? "UNSPECIFIED").trim() || "UNSPECIFIED", allocation: 0 },
    });
    rtIndex.set(`${hotelId}|${norm(created.name)}`, created.id);
    return created.id;
  }

  // ---- Replace bookings + stop sales ----
  await prisma.booking.deleteMany();
  await prisma.stopSale.deleteMany();

  const stats = { bookings: 0, skipped: 0, stopsales: 0, ssSkipped: 0 };

  for (const b of bookings) {
    const arr = toDate(b.arrivalDate);
    const dep = toDate(b.departureDate);
    if (!arr || !dep) { stats.skipped++; continue; }
    const hotelId = await resolveOrCreateHotel(b.hotel);

    const resortCode = norm(b.resort);
    const resortId = marketByCode.size && resortByCode.get(resortCode)
      ? resortByCode.get(resortCode)!
      : (await prisma.resort.upsert({ where: { code: resortCode || "UNK" }, update: {}, create: { code: resortCode || "UNK", name: resortCode || "Unknown" } })).id;
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
        hotelStatus: STATUS[norm(b.hotelStatus)] ?? BookingStatus.Pending,
        toStatus: STATUS[norm(b.toStatus)] ?? BookingStatus.Pending,
        tourOperatorId: toId,
        marketId: mId,
        toBookingRef: String(b.toBookingRef ?? "").trim() || "—",
        sejourRef: b.sejourRef ? String(b.sejourRef) : null,
        resortId,
        hotelId,
        hotelRoomTypeId: rtId,
        arrivalDate: arr,
        departureDate: dep,
        roomCategory: ROOMCAT[norm(b.roomCategory)] ?? RoomCategory.DBL,
        numRooms: Number.isFinite(b.numRooms) ? Math.max(1, Math.trunc(b.numRooms)) : 1,
        adults: int(b.adults), children: int(b.children), infants: int(b.infants),
        mealBasis: MEAL[norm(b.mealBasis)] ?? MealBasis.AI,
        guestNames: b.guestNames ?? null,
        child1Age: int0(b.child1Age), child1Dob: toDate(b.child1Dob),
        child2Age: int0(b.child2Age), child2Dob: toDate(b.child2Dob),
        costUsd: dec(b.costUsd), sellingUsd: dec(b.sellingUsd),
        costEur: dec(b.costEur), sellingEur: dec(b.sellingEur),
        paymentMethod: PAY[norm(b.paymentMethod)] ?? PaymentMethod.Cash,
        paymentOptionDate: toDate(b.paymentOptionDate),
        accountingRemarks: b.accountingRemarks ?? null,
        visaHandling: dec(b.visaHandling),
        arrFlightNo: b.arrFlightNo ?? null, arrFlightTime: b.arrFlightTime ?? null,
        depFlightNo: b.depFlightNo ?? null, depFlightTime: b.depFlightTime ?? null,
        meetAssistVisa: b.meetAssistVisa ?? null,
        remarks: b.remarks ?? null,
        ebdPercent: dec(b.ebdPercent), ebdPaymentDate: toDate(b.ebdPaymentDate),
        guestNameRebooked: b.guestNameRebooked ?? null,
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
