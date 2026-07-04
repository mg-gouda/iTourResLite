// Response shapes shared by API + web (materialization grid, dashboard, paging).

export interface MaterializationCell {
  date: string; // yyyy-mm-dd
  alloc: number;
  sold: number;
  ss: number;
  avail: number; // alloc - sold (SS shown separately)
}

export interface MaterializationRow {
  roomTypeId: string;
  roomTypeName: string;
  cells: MaterializationCell[];
  totalAlloc: number;
  totalSold: number;
  totalSS: number;
  matPercent: number | null; // totalSold / totalAlloc, null when alloc 0
}

export interface MaterializationGrid {
  hotelId: string;
  hotelName: string;
  from: string;
  to: string;
  days: string[];
  rows: MaterializationRow[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardOverview {
  totalBookings: number;
  totalRooms: number;
  totalRoomNights: number;
  plUsd: number;
  plEur: number;
  sellingUsd: number;
  sellingEur: number;
  avgMaterialization: number | null;
  byStatus: { status: string; count: number }[];
}

export interface BreakdownRow {
  key: string;
  label: string;
  bookings: number;
  rooms: number;
  sellingEur: number;
  plEur: number;
  plUsd: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface RateChangeEntry {
  changedAt: string;      // ISO timestamp
  currency: string;       // bookingCurrency at time of change
  oldCostUsd: number;
  oldCostEur: number;
  oldCostEgp: number;
  oldSellingUsd: number;
  oldSellingEur: number;
  oldSellingEgp: number;
  oldCalcUsd?: string;
  oldCalcEur?: string;
  oldCalcEgp?: string;
  oldPlUsd: number;
  oldPlEur: number;
  oldPlEgp: number;
}

export interface RebookingStats {
  bookingCount: number;
  gainEur: number;
  gainUsd: number;
  gainEgp: number;
}
