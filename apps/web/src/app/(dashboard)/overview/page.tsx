"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, BedDouble, Moon, Euro, DollarSign, Percent } from "lucide-react";
import {
  formatMoney,
  formatPercent,
  type DashboardOverview,
} from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useLookups } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

export default function OverviewPage() {
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const lookups = useLookups();
  const statusLabelMap = Object.fromEntries(
    (lookups.data?.bookingStatuses ?? []).map((s) => [s.value, s.label])
  );

  const query = useQuery({
    queryKey: ["overview", range],
    queryFn: () =>
      get<DashboardOverview>(`/dashboard/overview${qs({ from: range.from, to: range.to })}`),
  });

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Headline KPIs and a full booking-status breakdown."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {query.isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>
      ) : (
        <Body data={query.data!} statusLabelMap={statusLabelMap} />
      )}
    </div>
  );
}

function Body({ data, statusLabelMap }: { data: DashboardOverview; statusLabelMap: Record<string, string> }) {
  const total = data.byStatus.reduce((s, r) => s + r.count, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total bookings" value={data.totalBookings.toLocaleString()} icon={<BookOpen className="size-4" />} />
        <KpiCard label="Total rooms" value={data.totalRooms.toLocaleString()} icon={<BedDouble className="size-4" />} />
        <KpiCard label="Room-nights" value={data.totalRoomNights.toLocaleString()} icon={<Moon className="size-4" />} />
        <KpiCard label="Selling EUR" value={formatMoney(data.sellingEur, "EUR")} icon={<Euro className="size-4" />} />
        <KpiCard label="Selling USD" value={formatMoney(data.sellingUsd, "USD")} icon={<DollarSign className="size-4" />} />
        <KpiCard
          label="Avg materialization"
          value={data.avgMaterialization == null ? "—" : formatPercent(data.avgMaterialization)}
          icon={<Percent className="size-4" />}
          accent
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Status breakdown</CardTitle></CardHeader>
        <CardContent>
          {data.byStatus.length === 0 ? (
            <EmptyState title="No bookings" description="No bookings match the selected period." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Status</TH>
                  <TH className="text-right">Bookings</TH>
                  <TH className="text-right">Share</TH>
                </TR>
              </THead>
              <TBody>
                {data.byStatus.map((row) => (
                  <TR key={row.status}>
                    <TD>
                      <Badge variant={statusVariant(row.status)}>
                        {statusLabelMap[row.status] ?? row.status}
                      </Badge>
                    </TD>
                    <TD className="text-right tabular-nums">{row.count.toLocaleString()}</TD>
                    <TD className="text-right tabular-nums text-muted-foreground">
                      {total ? `${((row.count / total) * 100).toFixed(1)}%` : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
