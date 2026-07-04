"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  BookOpen, BedDouble, Moon, Euro, DollarSign, TrendingUp, SlidersHorizontal,
} from "lucide-react";
import {
  formatMoney,
  type DashboardOverview,
  type SessionUser,
} from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useLookups, lookupToOptions, fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

interface Filters {
  from: string; to: string;
  hotelId: string; hotelLabel: string;
  tourOperatorId: string; marketId: string; resortId: string; status: string;
}

const EMPTY_FILTERS: Filters = {
  from: "", to: "", hotelId: "", hotelLabel: "", tourOperatorId: "", marketId: "", resortId: "", status: "",
};

// Fallback color palette for statuses not in DB
const PALETTE = [
  "#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#f97316","#06b6d4","#a1a1aa",
];

function roleGreeting(user: SessionUser): string {
  switch (user.role) {
    case "ACCOUNTANT": return "Finance overview — P&L and payments at a glance.";
    case "AGENT": return "Your reservations activity and inventory health.";
    case "VIEWER": return "Read-only overview of bookings and performance.";
    default: return "Operational overview across bookings, inventory and revenue.";
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const lookups = useLookups();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const query = useQuery({
    queryKey: ["dashboard-overview", filters],
    queryFn: () =>
      get<DashboardOverview>(
        `/dashboard/overview${qs({
          from: filters.from, to: filters.to,
          hotelId: filters.hotelId, tourOperatorId: filters.tourOperatorId,
          marketId: filters.marketId, resortId: filters.resortId, status: filters.status,
        })}`,
      ),
  });

  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const marketOpts = lookupToOptions(lookups.data?.markets);
  const resortOpts = lookupToOptions(lookups.data?.resorts);
  const statusOpts = lookups.data?.bookingStatuses ?? [];
  // Dynamic label map from DB (code → display label)
  const statusLabelMap = Object.fromEntries(statusOpts.map((s) => [s.value, s.label]));

  const hasFilters = Object.entries(filters).some(([k, v]) => k !== "hotelLabel" && v !== "");

  return (
    <div>
      <PageHeader
        title={`Welcome${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={user ? roleGreeting(user) : undefined}
        actions={
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            )}
            <Button
              variant="outline" size="sm"
              onClick={() => setFiltersOpen((o) => !o)}
              className={cn(filtersOpen && "bg-secondary")}
            >
              <SlidersHorizontal className="size-4" /> Filters
            </Button>
          </div>
        }
      />

      {filtersOpen && (
        <Card className="mb-5">
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Arrival From">
              <DateInput value={filters.from} onChange={(v) => set("from", v)} />
            </Field>
            <Field label="Arrival To">
              <DateInput value={filters.to} onChange={(v) => set("to", v)} />
            </Field>
            <Field label="Hotel">
              <AsyncCombobox
                fetcher={fetchHotelOptions} value={filters.hotelId} label={filters.hotelLabel}
                onChange={(v, l) => setFilters((f) => ({ ...f, hotelId: v, hotelLabel: l }))}
                placeholder="Any hotel"
              />
            </Field>
            <Field label="Tour Operator">
              <Combobox options={toOpts} value={filters.tourOperatorId} onChange={(v) => set("tourOperatorId", v)} placeholder="Any" />
            </Field>
            <Field label="Market">
              <Combobox options={marketOpts} value={filters.marketId} onChange={(v) => set("marketId", v)} placeholder="Any" />
            </Field>
            <Field label="Status">
              <Combobox options={statusOpts} value={filters.status} onChange={(v) => set("status", v)} placeholder="Any" />
            </Field>
          </CardContent>
        </Card>
      )}

      {query.isLoading ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>
      ) : (
        <DashboardBody data={query.data!} statusLabelMap={statusLabelMap} />
      )}
    </div>
  );
}

function DashboardBody({ data, statusLabelMap }: { data: DashboardOverview; statusLabelMap: Record<string, string> }) {
  const chartData = data.byStatus.map((s, i) => ({
    status: s.status,
    label: statusLabelMap[s.status] ?? s.status,
    count: s.count,
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total bookings" value={data.totalBookings.toLocaleString()} icon={<BookOpen className="size-4" />} />
        <KpiCard label="Total rooms" value={data.totalRooms.toLocaleString()} icon={<BedDouble className="size-4" />} />
        <KpiCard label="Room-nights" value={data.totalRoomNights.toLocaleString()} icon={<Moon className="size-4" />} />
        <KpiCard label="P/L EUR" value={formatMoney(data.plEur, "EUR")} icon={<TrendingUp className="size-4" />} accent />
        <KpiCard label="P/L USD" value={formatMoney(data.plUsd, "USD")} icon={<DollarSign className="size-4" />} accent />
        <KpiCard label="Selling EUR" value={formatMoney(data.sellingEur, "EUR")} icon={<Euro className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Bookings by status</CardTitle></CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No bookings in this period.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--secondary))" }}
                      contentStyle={{
                        background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
                        borderRadius: 8, fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((d) => <Cell key={d.status} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status breakdown table */}
        <Card>
          <CardHeader><CardTitle>Status summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            {chartData.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No data.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {chartData.map((d) => (
                    <tr key={d.status} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                          <span>{d.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{d.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                        {data.totalBookings > 0 ? ((d.count / data.totalBookings) * 100).toFixed(1) + "%" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
