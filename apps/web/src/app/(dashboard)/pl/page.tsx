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
import { formatMoney } from "@itour/shared";
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

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description="Monthly P&L in EUR and USD."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {query.isLoading ? (
        <div className="space-y-5"><Skeleton className="h-80" /><Skeleton className="h-64" /></div>
      ) : query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>
      ) : !query.data || query.data.length === 0 ? (
        <Card><EmptyState title="No P&L data" description="No bookings in the selected period." /></Card>
      ) : (
        <Body rows={query.data} />
      )}
    </div>
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
