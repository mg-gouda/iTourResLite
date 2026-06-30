"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Search } from "lucide-react";
import {
  formatPercent,
  type MaterializationGrid,
  type MaterializationRow,
} from "@itour/shared";
import { API, get, qs } from "@/lib/api";
import { fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

interface Params {
  hotelId: string;
  from: string;
  to: string;
}

/** Heat scale for availability cells. */
function availClass(avail: number, alloc: number): string {
  if (alloc <= 0) return "text-muted-foreground";
  if (avail <= 0) return "bg-red-500/20 text-red-300";
  const ratio = avail / alloc;
  if (ratio <= 0.25) return "bg-amber-500/20 text-amber-300";
  return "bg-emerald-500/15 text-emerald-300";
}

export default function MaterializationPage() {
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [params, setParams] = useState<Params | null>(null);

  const query = useQuery({
    queryKey: ["materialization", params],
    enabled: !!params,
    queryFn: () =>
      get<MaterializationGrid>(
        `/materialization${qs({ hotelId: params!.hotelId, from: params!.from, to: params!.to })}`,
      ),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hotelId && from && to) setParams({ hotelId, from, to });
  }

  const pdfHref =
    params && `${API}/materialization/pdf${qs({ hotelId: params.hotelId, from: params.from, to: params.to })}`;

  return (
    <div>
      <PageHeader
        title="Materialization"
        description="Daily allotment, sold, stop-sale and availability per room type."
        actions={
          pdfHref ? (
            <a href={pdfHref} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <FileDown className="size-4" /> Export PDF
              </Button>
            </a>
          ) : undefined
        }
      />

      <Card className="mb-5">
        <CardContent className="p-4">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <Field label="Hotel" className="min-w-[16rem] flex-1">
              <AsyncCombobox
                fetcher={fetchHotelOptions}
                value={hotelId}
                label={hotelLabel}
                onChange={(v, l) => {
                  setHotelId(v);
                  setHotelLabel(l);
                }}
                placeholder="Search hotel…"
                aria-label="Hotel"
              />
            </Field>
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </Field>
            <Button type="submit" disabled={!hotelId || !from || !to}>
              <Search className="size-4" /> Load grid
            </Button>
          </form>
        </CardContent>
      </Card>

      {!params ? (
        <Card>
          <EmptyState
            title="Pick a hotel and date range"
            description="Select a hotel and a from/to window to view its materialization grid."
          />
        </Card>
      ) : query.isLoading ? (
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-80" />
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>
      ) : !query.data || query.data.rows.length === 0 ? (
        <Card><EmptyState title="No room types" description="This hotel has no allotment in the selected range." /></Card>
      ) : (
        <Grid grid={query.data} />
      )}
    </div>
  );
}

function Grid({ grid }: { grid: MaterializationGrid }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20">
              <tr className="bg-card">
                <th className="sticky left-0 z-30 min-w-[10rem] border-b border-r border-border bg-card px-3 py-2 text-left font-medium">
                  {grid.hotelName}
                </th>
                {grid.days.map((d) => (
                  <th key={d} className="border-b border-border px-2 py-2 text-center font-medium text-muted-foreground">
                    {d.slice(5)}
                  </th>
                ))}
                <th className="border-b border-l border-border bg-card px-3 py-2 text-center font-medium">TTL</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <RoomBlock key={row.roomTypeId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RoomBlock({ row }: { row: MaterializationRow }) {
  const showSS = row.cells.some((c) => c.ss !== 0) || row.totalSS !== 0;

  const ROWS: { key: "alloc" | "sold" | "ss" | "avail"; label: string }[] = [
    { key: "alloc", label: "Alloc" },
    { key: "sold", label: "Sold" },
    ...(showSS ? [{ key: "ss" as const, label: "SS" }] : []),
    { key: "avail", label: "Avail" },
  ];

  return (
    <>
      <tr>
        <td
          colSpan={row.cells.length + 2}
          className="sticky left-0 z-10 border-b border-t border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
        >
          {row.roomTypeName}
        </td>
      </tr>
      {ROWS.map((r, i) => (
        <tr key={r.key} className="hover:bg-secondary/30">
          <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-1.5 text-muted-foreground">
            {r.label}
          </td>
          {row.cells.map((cell) => {
            const val = cell[r.key];
            const isAvail = r.key === "avail";
            return (
              <td
                key={cell.date}
                className={cn(
                  "px-2 py-1.5 text-center tabular-nums",
                  isAvail && availClass(cell.avail, cell.alloc),
                )}
              >
                {val}
              </td>
            );
          })}
          {/* TTL column: only meaningful on the first row (Mat%). */}
          {i === 0 ? (
            <td
              rowSpan={ROWS.length}
              className="border-l border-border bg-card px-3 text-center align-middle font-semibold text-primary"
            >
              {row.matPercent == null ? "—" : `${row.matPercent.toFixed(1)}%`}
            </td>
          ) : null}
        </tr>
      ))}
    </>
  );
}
