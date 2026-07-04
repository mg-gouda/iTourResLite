import { z } from "zod";

// Role is internal-only; not admin-editable, kept as code-level enum.
export const ROLES = ["ADMIN", "MANAGER", "AGENT", "ACCOUNTANT", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];
export const zRole = z.enum(ROLES);

// These are String fields in DB (admin-editable via System Parameters).
// Arrays kept for default seed display labels; zod validators accept any string.
export const BOOKING_STATUSES = ["Confirmed", "CXL", "Pending", "Sent", "NoShow", "Bubble", "StopSale"] as const;
export const ROOM_CATEGORIES  = ["DBL", "SGL", "TPL", "Family", "Suite", "JSuite"] as const;
export const MEAL_BASES        = ["AI", "BB", "HB", "FB", "SAI", "BO"] as const;
export const PAYMENT_METHODS   = ["VCR", "Cash", "DD", "Bubble", "ThirdParty"] as const;
export const CURRENCIES        = ["USD", "EUR", "GBP", "EGP"] as const;

export type BookingStatus = string;
export type RoomCategory  = string;
export type MealBasis     = string;
export type PaymentMethod = string;
export type Currency      = string;

export const zBookingStatus = z.string().min(1);
export const zRoomCategory  = z.string().min(1);
export const zMealBasis     = z.string().min(1);
export const zPaymentMethod = z.string().min(1);
export const zCurrency      = z.string().min(1);

// Built-in display labels (fallback when DB label absent)
export const STATUS_LABEL: Record<string, string> = {
  Confirmed: "Confirmed", CXL: "CXL", Pending: "Pending", Sent: "Sent",
  NoShow: "No Show", Bubble: "Bubble", StopSale: "Stop Sale",
};
export const ROOMCAT_LABEL: Record<string, string> = {
  DBL: "DBL", SGL: "SGL", TPL: "TPL", Family: "Family", Suite: "Suite", JSuite: "J. Suite",
};
export const PAYMENT_LABEL: Record<string, string> = {
  VCR: "VCR", Cash: "Cash", DD: "DD", Bubble: "Bubble", ThirdParty: "3rd Party",
};
