import { z } from "zod";
import {
  zBookingStatus, zRoomCategory, zMealBasis, zPaymentMethod, zRole,
} from "./enums";

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

// ---- Booking ----
const money = z.coerce.number().finite();
const optDate = z.coerce.date().optional().nullable();

export const bookingObject = z.object({
  bookingDate: z.coerce.date(),
  hotelStatus: zBookingStatus,
  toStatus: zBookingStatus,
  tourOperatorId: z.string().min(1),
  marketId: z.string().min(1),
  toBookingRef: z.string().min(1),
  sejourRef: z.string().optional().nullable(),
  resortId: z.string().min(1),
  hotelId: z.string().min(1),
  hotelRoomTypeId: z.string().min(1),
  arrivalDate: z.coerce.date(),
  departureDate: z.coerce.date(),
  roomCategory: zRoomCategory,
  numRooms: z.coerce.number().int().min(1),
  adults: z.coerce.number().int().min(0).default(0),
  children: z.coerce.number().int().min(0).default(0),
  infants: z.coerce.number().int().min(0).default(0),
  mealBasis: zMealBasis,
  guestNames: z.string().optional().nullable(),
  child1Age: z.coerce.number().int().optional().nullable(),
  child1Dob: optDate,
  child2Age: z.coerce.number().int().optional().nullable(),
  child2Dob: optDate,
  costUsd: money.default(0),
  sellingUsd: money.default(0),
  costEur: money.default(0),
  sellingEur: money.default(0),
  paymentMethod: zPaymentMethod,
  paymentOptionDate: optDate,
  accountingRemarks: z.string().optional().nullable(),
  visaHandling: money.default(0),
  arrFlightNo: z.string().optional().nullable(),
  arrFlightTime: z.string().optional().nullable(),
  depFlightNo: z.string().optional().nullable(),
  depFlightTime: z.string().optional().nullable(),
  meetAssistVisa: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  ebdPercent: money.default(0), // fraction 0.05 = 5%
  ebdPaymentDate: optDate,
  guestNameRebooked: z.string().optional().nullable(),
});

export const bookingWriteSchema = bookingObject.refine((b) => b.departureDate > b.arrivalDate, {
  message: "Departure must be after arrival",
  path: ["departureDate"],
});
export type BookingWriteDto = z.infer<typeof bookingObject>;

// PATCH: every field optional (drop the cross-field refine; per-field validation).
export const bookingUpdateSchema = bookingObject.partial();
export type BookingUpdateDto = z.infer<typeof bookingUpdateSchema>;

export const bookingQuerySchema = z.object({
  ref: z.string().optional(),
  hotelId: z.string().optional(),
  tourOperatorId: z.string().optional(),
  marketId: z.string().optional(),
  resortId: z.string().optional(),
  status: zBookingStatus.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
});
export type BookingQueryDto = z.infer<typeof bookingQuerySchema>;

// ---- Hotels / room types ----
export const hotelWriteSchema = z.object({
  name: z.string().min(1),
  resortId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});
export type HotelWriteDto = z.infer<typeof hotelWriteSchema>;

export const roomTypeWriteSchema = z.object({
  name: z.string().min(1),
  allocation: z.coerce.number().int().min(0).default(0),
  active: z.boolean().optional(),
});
export type RoomTypeWriteDto = z.infer<typeof roomTypeWriteSchema>;

// ---- Generic lookup (TO / Market / Resort) ----
export const lookupWriteSchema = z.object({
  code: z.string().min(1),
  name: z.string().optional().nullable(),
  active: z.boolean().optional(),
});
export type LookupWriteDto = z.infer<typeof lookupWriteSchema>;

// ---- Stop sale ----
export const stopSaleWriteSchema = z.object({
  hotelId: z.string().min(1),
  hotelRoomTypeId: z.string().optional().nullable(),
  qty: z.coerce.number().int(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
}).refine((s) => s.toDate >= s.fromDate, {
  message: "To date must be on/after from date",
  path: ["toDate"],
});
export type StopSaleWriteDto = z.infer<typeof stopSaleWriteSchema>;

// ---- Users ----
export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: zRole,
  password: z.string().min(8),
  active: z.boolean().default(true),
});
export type UserCreateDto = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: zRole.optional(),
  active: z.boolean().optional(),
});
export type UserUpdateDto = z.infer<typeof userUpdateSchema>;

export const resetPasswordSchema = z.object({ password: z.string().min(8) });
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

// ---- Materialization ----
export const materializationQuerySchema = z.object({
  hotelId: z.string().min(1),
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine((q) => q.to >= q.from, { message: "Invalid range", path: ["to"] });
export type MaterializationQueryDto = z.infer<typeof materializationQuerySchema>;

// ---- Dashboard ----
export const dashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: zBookingStatus.optional(),
  hotelId: z.string().optional(),
  tourOperatorId: z.string().optional(),
  marketId: z.string().optional(),
  resortId: z.string().optional(),
});
export type DashboardQueryDto = z.infer<typeof dashboardQuerySchema>;

export const breakdownQuerySchema = dashboardQuerySchema.extend({
  groupBy: z.enum(["tourOperator", "market", "resort", "hotel"]).default("tourOperator"),
});
export type BreakdownQueryDto = z.infer<typeof breakdownQuerySchema>;
