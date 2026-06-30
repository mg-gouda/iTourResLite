"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  BookOpen,
  BedDouble,
  Moon,
  Euro,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  formatMoney,
  STATUS_LABEL,
  type DashboardOverview,
  type BookingStatus,
  type SessionUser,
} from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

const STATUS_COLORS: Record<string, string> = {
  Confirmed: "#10b981",
  Pending: "#f59e0b",
  CXL: "#ef4444",
  Sent: "#3b82f6",
  NoShow: "#a1a1aa",
  Bubble: "#8b5cf6",
  StopSale: "#f97316",
};

function roleGreeting(user: SessionUser): string {
  switch (user.role) {
    case "ACCOUNTANT":
      return "Finance overview — P&L and payments at a glance.";
    case "AGENT":
      return "Your reservations activity and inventory health.";
    case "VIEWER":
      return "Read-only overview of bookings and performance.";
    default:
      return "Operational overview across bookings, inventory and revenue.";
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });

  const query = useQuery({
    queryKey: ["dashboard-overview", range],
    queryFn: () =>
      get<DashboardOverview>(
        `/dashboard/overview${qs({ from: range.from, to: range.to })}`,
      ),
  });

  return (
    <div>
      <PageHeader
        title={`Welcome${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={user ? roleGreeting(user) : undefined}
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {query.isLoading ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : (
        <DashboardBody data={query.data!} />
      )}
    </div>
  );
}

function DashboardBody({ data }: { data: DashboardOverview }) {
  const chartData = data.byStatus.map((s) => ({
    status: s.status,
    label: STATUS_LABEL[s.status as BookingStatus] ?? s.status,
    count: s.count,
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

      <Card>
        <CardHeader>
          <CardTitle>Bookings by status</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No bookings in this period.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary))" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
