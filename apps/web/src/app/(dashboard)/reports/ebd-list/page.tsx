"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { formatMoney, fmtDate, ebdAmountUsd, ebdAmountEur, ebdAmountEgp, round2 } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { ReportCurrencyTotals } from "@/components/report-currency-totals";
import { ReportTotalCount } from "@/components/report-total-count";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportSpec } from "@/lib/export";

export default function EbdListPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const filters = { from, to, hotelId };

  const query = useQuery({
    queryKey: ["report-ebd-list", filters],
    queryFn: () => get<any[]>(`/reports/ebd-list${qs(filters)}`),
    enabled: !!(from || to || hotelId),
  });

  const rows = query.data ?? [];
  const hasFilters = !!(from || to || hotelId);
  const clearFilters = () => { setFrom(""); setTo(""); setHotelId(""); setHotelLabel(""); };
  const currencyTotals = [
    { currency: "USD", rows: [
      { label: "Cost", value: round2(rows.reduce((a, b) => a + Number(b.costUsd ?? 0), 0)) },
      { label: "EBD", value: round2(rows.reduce((a, b) => a + ebdAmountUsd(Number(b.ebdPercent), b.costUsd), 0)) },
    ] },
    { currency: "EUR", rows: [
      { label: "Cost", value: round2(rows.reduce((a, b) => a + Number(b.costEur ?? 0), 0)) },
      { label: "EBD", value: round2(rows.reduce((a, b) => a + ebdAmountEur(Number(b.ebdPercent), b.costEur), 0)) },
    ] },
    { currency: "EGP", rows: [
      { label: "Cost", value: round2(rows.reduce((a, b) => a + Number(b.costEgp ?? 0), 0)) },
      { label: "EBD", value: round2(rows.reduce((a, b) => a + ebdAmountEgp(Number(b.ebdPercent), b.costEgp ?? 0), 0)) },
    ] },
  ];

  function buildExport(): ExportSpec {
    return {
      title: "EBD List",
      filename: "ebd-list",
      columns: ["Ref", "Hotel", "Room Type", "Arr Date", "Status", "Rooms", "EBD%", "Cost USD", "EBD USD", "Cost EUR", "EBD EUR", "Cost EGP", "EBD EGP", "EBD Pay Date"],
      aligns: ["left", "left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "left"],
      rows: (query.data ?? []).map((b) => {
        const pct = Number(b.ebdPercent);
        return [
          b.toBookingRef, b.hotel?.name, b.hotelRoomType?.name, fmtDate(b.arrivalDate),
          b.hotelStatus, b.numRooms, (pct * 100).toFixed(1) + "%",
          Number(b.costUsd), ebdAmountUsd(pct, b.costUsd),
          Number(b.costEur), ebdAmountEur(pct, b.costEur),
          Number(b.costEgp), ebdAmountEgp(pct, b.costEgp),
          fmtDate(b.ebdPaymentDate),
        ];
      }),
    };
  }

  function exportCsv() {
    const spec = buildExport();
    const lines = spec.rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [spec.columns.join(","), ...lines].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "ebd-list.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="EBD List" description="Bookings with Early Booking Discount > 0."
        actions={
          <>
            <ClearFiltersButton onClear={clearFilters} disabled={!hasFilters} />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!query.data?.length}><Download className="size-4" /> CSV</Button>
            <ExportButtons build={buildExport} disabled={!query.data?.length} />
          </>
        } />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="Arrival From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Arrival To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Hotel">
            <AsyncCombobox fetcher={fetchHotelOptions} value={hotelId} label={hotelLabel}
              onChange={(v, l) => { setHotelId(v); setHotelLabel(l); }} placeholder="Any hotel" />
          </Field>
        </CardContent>
      </Card>

      {rows.length > 0 && <ReportTotalCount count={rows.length} />}
      {rows.length > 0 && <ReportCurrencyTotals totals={currencyTotals} />}

      <Card>
        <CardContent className="p-0">
          {!from && !to && !hotelId ? (
            <EmptyState title="Set a filter" description="Select dates or a hotel to load the EBD list." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={10} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !query.data?.length ? <EmptyState title="No EBD bookings" />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Ref</TH><TH>Hotel</TH><TH>Room Type</TH><TH>Arr Date</TH>
                    <TH className="text-right">EBD%</TH>
                    <TH className="text-right">Cost USD</TH><TH className="text-right">EBD USD</TH>
                    <TH className="text-right">Cost EUR</TH><TH className="text-right">EBD EUR</TH>
                    <TH className="text-right">Cost EGP</TH><TH className="text-right">EBD EGP</TH>
                    <TH>EBD Pay Date</TH>
                  </TR>
                </THead>
                <TBody>
                  {query.data.map((b) => {
                    const pct = Number(b.ebdPercent);
                    return (
                      <TR key={b.id}>
                        <TD className="font-medium">{b.toBookingRef}</TD>
                        <TD className="max-w-[12rem] truncate">{b.hotel?.name}</TD>
                        <TD className="text-muted-foreground">{b.hotelRoomType?.name}</TD>
                        <TD>{fmtDate(b.arrivalDate)}</TD>
                        <TD className="text-right tabular-nums">{(pct * 100).toFixed(1)}%</TD>
                        <TD className="text-right tabular-nums">{formatMoney(b.costUsd, "USD")}</TD>
                        <TD className="text-right tabular-nums">{formatMoney(ebdAmountUsd(pct, b.costUsd), "USD")}</TD>
                        <TD className="text-right tabular-nums">{formatMoney(b.costEur, "EUR")}</TD>
                        <TD className="text-right tabular-nums">{formatMoney(ebdAmountEur(pct, b.costEur), "EUR")}</TD>
                        <TD className="text-right tabular-nums">{formatMoney(b.costEgp ?? 0, "EGP")}</TD>
                        <TD className="text-right tabular-nums">{formatMoney(ebdAmountEgp(pct, b.costEgp ?? 0), "EGP")}</TD>
                        <TD>{fmtDate(b.ebdPaymentDate)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
