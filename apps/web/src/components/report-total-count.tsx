"use client";

// Small "Total Bookings: N" line shown above a report's cards/table.
export function ReportTotalCount({ count, label = "Total Bookings" }: { count: number; label?: string }) {
  return (
    <p className="mb-2 text-sm text-muted-foreground">
      {label}: <span className="font-medium text-foreground tabular-nums">{count}</span>
    </p>
  );
}
