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
  fileNumber: z.string().regex(/^$|^FT-\d{3,6}-\d{2}$/, "Format: FT-XXXX-XX").optional().nullable(),
  hasSpo: z.boolean().default(false),
  sejourSpoCode: z.string().optional().nullable(),
  spoDate: z.coerce.date().optional().nullable(),
  roomCatsJson: z.string().optional().nullable(),
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
  bookingCurrency: z.string().optional().nullable(),
  guestList: z.array(z.object({
    title: z.string().default("Mr"),
    name: z.string().min(1),
    type: z.enum(["HOTEL", "REBOOK"]).default("HOTEL"),
    room: z.coerce.number().int().default(1),
    sortOrder: z.coerce.number().int().optional(),
  })).optional(),
  child1Age: z.coerce.number().int().optional().nullable(),
  child1Dob: optDate,
  child2Age: z.coerce.number().int().optional().nullable(),
  child2Dob: optDate,
  infantAge: z.coerce.number().int().optional().nullable(),
  infantDob: optDate,
  costUsd: money.default(0),
  sellingUsd: money.default(0),
  calculationUsd: z.string().optional().nullable(),
  costEur: money.default(0),
  sellingEur: money.default(0),
  calculationEur: z.string().optional().nullable(),
  costEgp: money.default(0),
  sellingEgp: money.default(0),
  calculationEgp: z.string().optional().nullable(),
  paymentMethod: zPaymentMethod,
  paymentOptionDate: optDate,
  visaHandling: money.default(0),
  arrFlightNo: z.string().optional().nullable(),
  arrFlightTime: z.string().optional().nullable(),
  depFlightNo: z.string().optional().nullable(),
  depFlightTime: z.string().optional().nullable(),
  meetAssistVisa: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  hotelRemarks: z.string().optional().nullable(),
  ebdPercent: money.default(0), // fraction 0.05 = 5%
  ebdPaymentDate: optDate,
  guestNameRebooked: z.string().optional().nullable(),
  overrideStopSale: z.boolean().optional(),
});

export const bookingWriteSchema = bookingObject.refine((b) => b.departureDate > b.arrivalDate, {
  message: "Departure must be after arrival",
  path: ["departureDate"],
});
export type BookingWriteDto = z.infer<typeof bookingObject>;

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
  hasSpo: z.enum(["true", "false"]).optional(),
  currency: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
});
export type BookingQueryDto = z.infer<typeof bookingQuerySchema>;

// ---- Hotels / room types ----
export const hotelWriteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
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

// ---- Generic lookup (TO / Market / Resort + 6 new admin tables) ----
export const lookupWriteSchema = z.object({
  code: z.string().min(1),
  name: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const verifyTotpSchema = z.object({ code: z.string().length(6) });
export type VerifyTotpDto = z.infer<typeof verifyTotpSchema>;

export const twoFaLoginSchema = z.object({
  preAuthToken: z.string().min(1),
  code: z.string().length(6),
});
export type TwoFaLoginDto = z.infer<typeof twoFaLoginSchema>;

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

// ---- Audit Log ----
export const auditQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  userId: z.string().optional(),
  entity: z.string().optional(),
  action: z.enum(["CREATE", "UPDATE", "DELETE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditQueryDto = z.infer<typeof auditQuerySchema>;

// ---- Reports ----
export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  hotelId: z.string().optional(),
  tourOperatorId: z.string().optional(),
  marketId: z.string().optional(),
  resortId: z.string().optional(),
});
export type ReportQueryDto = z.infer<typeof reportQuerySchema>;
