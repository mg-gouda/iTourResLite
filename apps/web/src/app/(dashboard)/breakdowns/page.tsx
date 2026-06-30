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
} from "recharts";
import { formatMoney, type BreakdownRow } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

type GroupBy = "tourOperator" | "market" | "resort" | "hotel";

const GROUP_OPTIONS = [
  { value: "tourOperator", label: "Tour Operator" },
  { value: "market", label: "Market" },
  { value: "resort", label: "Resort" },
  { value: "hotel", label: "Hotel" },
];

export default function BreakdownsPage() {
  const [groupBy, setGroupBy] = useState<GroupBy>("tourOperator");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });

  const query = useQuery({
    queryKey: ["breakdowns", groupBy, range],
    queryFn: () =>
      get<BreakdownRow[]>(
        `/dashboard/breakdowns${qs({ groupBy, from: range.from, to: range.to })}`,
      ),
  });

  return (
    <div>
      <PageHeader
        title="Breakdowns"
        description="Performance grouped by dimension."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      <div className="mb-4 max-w-xs">
        <Field label="Group by">
          <Combobox
            options={GROUP_OPTIONS}
            value={groupBy}
            onChange={(v) => setGroupBy(v as GroupBy)}
            aria-label="Group breakdowns by"
          />
        </Field>
      </div>

      {query.isLoading ? (
        <div className="space-y-5"><Skeleton className="h-80" /><Skeleton className="h-64" /></div>
      ) : query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>
      ) : !query.data || query.data.length === 0 ? (
        <Card><EmptyState title="No data" description="No bookings match these filters." /></Card>
      ) : (
        <Body rows={query.data} />
      )}
    </div>
  );
}

function Body({ rows }: { rows: BreakdownRow[] }) {
  const chartData = [...rows]
    .sort((a, b) => b.sellingEur - a.sellingEur)
    .slice(0, 15)
    .map((r) => ({ label: r.label, sellingEur: r.sellingEur }));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Selling EUR by group</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--secondary))" }}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatMoney(v, "EUR"), "Selling EUR"]}
                />
                <Bar dataKey="sellingEur" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detail</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Group</TH>
                <TH className="text-right">Bookings</TH>
                <TH className="text-right">Rooms</TH>
                <TH className="text-right">Selling EUR</TH>
                <TH className="text-right">P/L EUR</TH>
                <TH className="text-right">P/L USD</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.key}>
                  <TD className="font-medium">{r.label}</TD>
                  <TD className="text-right tabular-nums">{r.bookings.toLocaleString()}</TD>
                  <TD className="text-right tabular-nums">{r.rooms.toLocaleString()}</TD>
                  <TD className="text-right tabular-nums">{formatMoney(r.sellingEur, "EUR")}</TD>
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
