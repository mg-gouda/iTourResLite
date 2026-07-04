import type { Role } from "./enums";

export const PERMISSIONS = [
  // Views
  "dashboard.view",
  "overview.view",
  "pl.view",
  "pl.rebooking.view",
  "breakdowns.view",
  // Bookings — actions
  "bookings.view",
  "bookings.create",
  "bookings.update",
  "bookings.delete",
  "bookings.export",
  "bookings.parse_email",
  "bookings.send_email",
  "bookings.upload_spo",
  // Bookings — field access
  "bookings.cost.view",
  "bookings.cost.edit",
  "bookings.selling.view",
  "bookings.selling.edit",
  "bookings.pl.view",
  "bookings.payment.edit",
  "bookings.accounting.edit",
  "bookings.ebd.edit",
  "bookings.ratehistory.view",
  // Stop Sale
  "stop_sale.view",
  "stop_sale.create",
  "stop_sale.delete",
  // Materialization
  "materialization.view",
  "materialization.run",
  // Reports
  "reports.view",
  // Users
  "users.view",
  "users.create",
  "users.update",
  "users.reset_password",
  "users.deactivate",
  // System
  "system.params.view",
  "system.params.edit",
  "system.license.view",
  "system.license.manage",
  "system.audit.view",
  "system.permissions.view",
  "system.permissions.edit",
  // Profile (always granted — own user)
  "profile.change_password",
  "profile.2fa",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "View Dashboard",
  "overview.view": "View Overview",
  "pl.view": "View P&L",
  "pl.rebooking.view": "View Rebooking Stats",
  "breakdowns.view": "View Breakdowns",
  "bookings.view": "View Bookings",
  "bookings.create": "Create Booking",
  "bookings.update": "Edit Booking",
  "bookings.delete": "Delete Booking",
  "bookings.export": "Export Bookings",
  "bookings.parse_email": "AI Email Parse",
  "bookings.send_email": "Send Hotel Email",
  "bookings.upload_spo": "Upload SPO Document",
  "bookings.cost.view": "View Cost Fields",
  "bookings.cost.edit": "Edit Cost Fields",
  "bookings.selling.view": "View Selling Fields",
  "bookings.selling.edit": "Edit Selling Fields",
  "bookings.pl.view": "View P&L in Booking",
  "bookings.payment.edit": "Edit Payment Fields",
  "bookings.accounting.edit": "Edit Accounting Remarks",
  "bookings.ebd.edit": "Edit EBD Fields",
  "bookings.ratehistory.view": "View Rate History",
  "stop_sale.view": "View Stop Sales",
  "stop_sale.create": "Create Stop Sale",
  "stop_sale.delete": "Delete Stop Sale",
  "materialization.view": "View Materialization",
  "materialization.run": "Run Materialization",
  "reports.view": "View Reports",
  "users.view": "View Users",
  "users.create": "Create User",
  "users.update": "Edit User Role / Status",
  "users.reset_password": "Reset User Password",
  "users.deactivate": "Deactivate User",
  "system.params.view": "View System Parameters",
  "system.params.edit": "Edit System Parameters",
  "system.license.view": "View License",
  "system.license.manage": "Manage License",
  "system.audit.view": "View Audit Trail",
  "system.permissions.view": "View Permission Matrix",
  "system.permissions.edit": "Edit Permission Matrix",
  "profile.change_password": "Change Own Password",
  "profile.2fa": "Manage Own 2FA",
};

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: "Views",
    permissions: ["dashboard.view", "overview.view", "pl.view", "pl.rebooking.view", "breakdowns.view"],
  },
  {
    label: "Bookings — Actions",
    permissions: [
      "bookings.view", "bookings.create", "bookings.update", "bookings.delete",
      "bookings.export", "bookings.parse_email", "bookings.send_email", "bookings.upload_spo",
    ],
  },
  {
    label: "Bookings — Fields",
    permissions: [
      "bookings.cost.view", "bookings.cost.edit",
      "bookings.selling.view", "bookings.selling.edit",
      "bookings.pl.view", "bookings.payment.edit",
      "bookings.accounting.edit", "bookings.ebd.edit", "bookings.ratehistory.view",
    ],
  },
  {
    label: "Stop Sale",
    permissions: ["stop_sale.view", "stop_sale.create", "stop_sale.delete"],
  },
  {
    label: "Materialization",
    permissions: ["materialization.view", "materialization.run"],
  },
  {
    label: "Reports",
    permissions: ["reports.view"],
  },
  {
    label: "Users",
    permissions: ["users.view", "users.create", "users.update", "users.reset_password", "users.deactivate"],
  },
  {
    label: "System",
    permissions: [
      "system.params.view", "system.params.edit",
      "system.license.view", "system.license.manage",
      "system.audit.view",
      "system.permissions.view", "system.permissions.edit",
    ],
  },
  {
    label: "Profile",
    permissions: ["profile.change_password", "profile.2fa"],
  },
];

// ── Default permission matrix ─────────────────────────────────────────────────

type Row = Record<Permission, boolean>;

function row(granted: Permission[], denied: Permission[]): Row {
  const r = {} as Row;
  for (const p of PERMISSIONS) r[p] = false;
  for (const p of granted) r[p] = true;
  for (const p of denied) r[p] = false;
  return r;
}

const ALL = PERMISSIONS as unknown as Permission[];

export const DEFAULT_MATRIX: Record<Role, Row> = {
  // ADMIN — all granted
  ADMIN: row(ALL, []),

  // MANAGER — everything except user/system/permissions management
  MANAGER: row(
    [
      "dashboard.view", "overview.view", "pl.view", "pl.rebooking.view", "breakdowns.view",
      "bookings.view", "bookings.create", "bookings.update", "bookings.delete",
      "bookings.export", "bookings.parse_email", "bookings.send_email", "bookings.upload_spo",
      "bookings.cost.view", "bookings.cost.edit",
      "bookings.selling.view", "bookings.selling.edit",
      "bookings.pl.view", "bookings.payment.edit", "bookings.accounting.edit", "bookings.ebd.edit",
      "bookings.ratehistory.view",
      "stop_sale.view", "stop_sale.create", "stop_sale.delete",
      "materialization.view", "materialization.run",
      "reports.view",
      "system.audit.view",
      "profile.change_password", "profile.2fa",
    ],
    [],
  ),

  // AGENT — full booking ops, no delete, no financial edit gatekeeping
  AGENT: row(
    [
      "dashboard.view", "overview.view", "pl.view", "pl.rebooking.view", "breakdowns.view",
      "bookings.view", "bookings.create", "bookings.update",
      "bookings.export", "bookings.parse_email", "bookings.send_email", "bookings.upload_spo",
      "bookings.cost.view", "bookings.cost.edit",
      "bookings.selling.view", "bookings.selling.edit",
      "bookings.pl.view", "bookings.payment.edit", "bookings.accounting.edit", "bookings.ebd.edit",
      "bookings.ratehistory.view",
      "stop_sale.view", "stop_sale.create",
      "materialization.view",
      "reports.view",
      "profile.change_password", "profile.2fa",
    ],
    [],
  ),

  // ACCOUNTANT — financial fields only; no create/delete/ops actions
  ACCOUNTANT: row(
    [
      "dashboard.view", "overview.view", "pl.view", "pl.rebooking.view", "breakdowns.view",
      "bookings.view", "bookings.update", "bookings.export",
      "bookings.cost.view", "bookings.cost.edit",
      "bookings.selling.view", "bookings.selling.edit",
      "bookings.pl.view", "bookings.payment.edit", "bookings.accounting.edit", "bookings.ebd.edit",
      "bookings.ratehistory.view",
      "stop_sale.view",
      "reports.view",
      "profile.change_password", "profile.2fa",
    ],
    [],
  ),

  // VIEWER — read-only; only dashboard, overview, bookings view
  VIEWER: row(
    [
      "dashboard.view", "overview.view",
      "bookings.view",
      "profile.change_password", "profile.2fa",
    ],
    [],
  ),
};

// ── Resolve effective permissions for a user ──────────────────────────────────

export interface PermOverride { permission: string; granted: boolean }

export function resolvePermissions(
  role: Role,
  roleOverrides: PermOverride[],
  userOverrides: PermOverride[],
): Record<Permission, boolean> {
  const effective = { ...DEFAULT_MATRIX[role] };
  // ADMIN always has full access regardless of overrides
  if (role === "ADMIN") return effective;
  for (const o of roleOverrides) {
    if (o.permission in effective) (effective as any)[o.permission] = o.granted;
  }
  for (const o of userOverrides) {
    if (o.permission in effective) (effective as any)[o.permission] = o.granted;
  }
  return effective;
}
