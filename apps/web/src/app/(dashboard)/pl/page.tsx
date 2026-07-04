"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, RefreshCcw } from "lucide-react";
import { formatMoney, type RebookingStats } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

interface PlRow {
  period: string; // yyyy-mm
  plEur: number;
  plUsd: number;
  sellingEur?: number;
  sellingUsd?: number;
}

export default function PlPage() {
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });

  const query = useQuery({
    queryKey: ["pl", range],
    queryFn: () => get<PlRow[]>(`/dashboard/pl${qs({ from: range.from, to: range.to })}`),
  });

  const rebookingQuery = useQuery({
    queryKey: ["rebooking-stats"],
    queryFn: () => get<RebookingStats>("/dashboard/rebooking"),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description="Monthly P&L in EUR and USD."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {/* Rebooking Over Profit card — always shown */}
      <RebookingCard data={rebookingQuery.data} loading={rebookingQuery.isLoading} />

      {query.isLoading ? (
        <div className="space-y-5 mt-5"><Skeleton className="h-80" /><Skeleton className="h-64" /></div>
      ) : query.isError ? (
        <Card className="mt-5"><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>
      ) : !query.data || query.data.length === 0 ? (
        <Card className="mt-5"><EmptyState title="No P&L data" description="No bookings in the selected period." /></Card>
      ) : (
        <div className="mt-5"><Body rows={query.data} /></div>
      )}
    </div>
  );
}

function RebookingCard({ data, loading }: { data?: RebookingStats; loading: boolean }) {
  return (
    <Card className="mb-0 border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
          <RefreshCcw className="size-4" />
          Rebooking Over Profit
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cumulative profit gain from bookings rebooked at a lower rate (original cost − current cost).
          {data && data.bookingCount > 0 && (
            <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">
              {data.bookingCount} booking{data.bookingCount !== 1 ? "s" : ""} rebooked.
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex gap-6"><Skeleton className="h-8 w-32" /><Skeleton className="h-8 w-32" /></div>
        ) : !data || data.bookingCount === 0 ? (
          <p className="text-sm text-muted-foreground py-1">No rebooking profit recorded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            {data.gainEur > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">EUR Gain</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(data.gainEur, "EUR")}
                </p>
              </div>
            )}
            {data.gainUsd > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">USD Gain</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(data.gainUsd, "USD")}
                </p>
              </div>
            )}
            {data.gainEgp > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">EGP Gain</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {data.gainEgp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
                </p>
              </div>
            )}
            <div className="ml-auto self-center">
              <TrendingUp className="size-8 text-emerald-500/40" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Body({ rows }: { rows: PlRow[] }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>P&L by month</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name) => [formatMoney(v, name === "P/L USD" ? "USD" : "EUR"), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="plEur" name="P/L EUR" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line dataKey="plUsd" name="P/L USD" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Monthly detail</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Period</TH>
                <TH className="text-right">P/L EUR</TH>
                <TH className="text-right">P/L USD</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.period}>
                  <TD className="font-medium">{r.period}</TD>
                  <TD className="text-right tabular-nums">{formatMoney(r.plEur, "EUR")}</TD>
                  <TD className="text-right tabular-nums">{formatMoney(r.plUsd, "USD")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
