import { z } from "zod";

// Mirror Prisma enum identifiers (the API passes these straight to Prisma).
export const ROLES = ["ADMIN", "MANAGER", "AGENT", "ACCOUNTANT", "VIEWER"] as const;
export const BOOKING_STATUSES = ["Confirmed", "CXL", "Pending", "Sent", "NoShow", "Bubble", "StopSale"] as const;
export const ROOM_CATEGORIES = ["DBL", "SGL", "TPL", "Family", "Suite", "JSuite"] as const;
export const MEAL_BASES = ["AI", "BB", "HB", "FB", "SAI", "BO"] as const;
export const PAYMENT_METHODS = ["VCR", "Cash", "DD", "Bubble", "ThirdParty"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "EGP"] as const;

export type Role = (typeof ROLES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type RoomCategory = (typeof ROOM_CATEGORIES)[number];
export type MealBasis = (typeof MEAL_BASES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Currency = (typeof CURRENCIES)[number];

export const zRole = z.enum(ROLES);
export const zBookingStatus = z.enum(BOOKING_STATUSES);
export const zRoomCategory = z.enum(ROOM_CATEGORIES);
export const zMealBasis = z.enum(MEAL_BASES);
export const zPaymentMethod = z.enum(PAYMENT_METHODS);
export const zCurrency = z.enum(CURRENCIES);

// Human-readable labels for display (legacy spellings).
export const STATUS_LABEL: Record<BookingStatus, string> = {
  Confirmed: "Confirmed", CXL: "CXL", Pending: "Pending", Sent: "Sent",
  NoShow: "No Show", Bubble: "Bubble", StopSale: "Stop Sale",
};
export const ROOMCAT_LABEL: Record<RoomCategory, string> = {
  DBL: "DBL", SGL: "SGL", TPL: "TPL", Family: "Family", Suite: "Suite", JSuite: "J. Suite",
};
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  VCR: "VCR", Cash: "Cash", DD: "DD", Bubble: "Bubble", ThirdParty: "3rd Party",
};
