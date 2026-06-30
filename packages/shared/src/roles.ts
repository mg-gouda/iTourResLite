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
  "costUsd", "sellingUsd", "costEur", "sellingEur",
  "paymentMethod", "paymentOptionDate", "visaHandling", "accountingRemarks",
  "ebdPercent", "ebdPaymentDate",
] as const;

export type AccountantField = (typeof ACCOUNTANT_EDITABLE_FIELDS)[number];

export function canEditBooking(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT" || role === "ACCOUNTANT";
}

export function canDeleteBooking(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
