// RBAC helpers (iTourResLite.md §3). Shared by API guard + web UI gating.
import type { Role } from "./enums";

// Higher number = more privilege. AGENT+ means rank >= AGENT.
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  ACCOUNTANT: 1,
  AGENT: 2,
  MANAGER: 3,
  ADMIN: 4,
};

export function hasRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Fields the ACCOUNTANT may edit on a booking (everything else is rejected). */
export const ACCOUNTANT_EDITABLE_FIELDS = [
  "costUsd", "sellingUsd", "calculationUsd",
  "costEur", "sellingEur", "calculationEur",
  "costEgp", "sellingEgp", "calculationEgp",
  "paymentMethod", "paymentOptionDate", "visaHandling", "accountingRemarks",
  "ebdPercent", "ebdPaymentDate",
  "bookingPaid",
] as const;

export type AccountantField = (typeof ACCOUNTANT_EDITABLE_FIELDS)[number];

export function canEditBooking(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT" || role === "ACCOUNTANT";
}

export function canDeleteBooking(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * Who may set "Booking Paid" and upload the payment proof: Accountant &
 * Manager (Admin as superuser). Agents create bookings but do not handle
 * payment; Viewers are read-only. Enforced in the web UI and the API.
 */
export function canEditPayment(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "ACCOUNTANT";
}
