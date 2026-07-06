"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { nights as calcNights, fmtDate } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useLookups, lookupToOptions, fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { ExportButtons } from "@/components/export-buttons";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { ReportTotalCount } from "@/components/report-total-count";
import type { ExportSpec } from "@/lib/export";

export default function HotelArrivalsPage() {
  const lookups = useLookups();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const [marketId, setMarketId] = useState("");
  const [status, setStatus] = useState("");

  const marketOpts = lookupToOptions(lookups.data?.markets);
  const statusOpts = lookups.data?.bookingStatuses ?? [];
  const filters = { from, to, hotelId, marketId, status };

  const query = useQuery({
    queryKey: ["report-hotel-arrivals", filters],
    queryFn: () => get<any[]>(`/reports/hotel-arrivals${qs(filters)}`),
    enabled: !!(from || to || hotelId || status),
  });

  const hasFilters = !!(from || to || hotelId || marketId || status);
  const clearFilters = () => { setFrom(""); setTo(""); setHotelId(""); setHotelLabel(""); setMarketId(""); setStatus(""); };

  function buildExport(): ExportSpec {
    return {
      title: "Hotel Arrival List",
      filename: "hotel-arrivals",
      columns: ["Ref", "Hotel", "Room Type", "Arr Date", "Dep Date", "Nts", "Rooms", "Adults", "CHD", "INF", "Market", "Arrival Flight No.", "Arrival Flight Time", "Status", "Guest Names"],
      aligns: ["left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "left", "left", "left", "left", "left"],
      rows: (query.data ?? []).map((b) => [
        b.toBookingRef,
        b.hotel?.name ?? "",
        b.hotelRoomType?.name ?? "",
        fmtDate(b.arrivalDate),
        fmtDate(b.departureDate),
        calcNights(b.arrivalDate, b.departureDate),
        b.numRooms, b.adults, b.children, b.infants,
        b.market?.code ?? "",
        b.arrFlightNo ?? "",
        b.arrFlightTime ?? "",
        b.hotelStatus ?? "",
        b.guestNames ?? "",
      ]),
    };
  }

  function exportCsv() {
    const spec = buildExport();
    const lines = spec.rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [spec.columns.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "hotel-arrivals.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Hotel Arrival List" description="Arrivals filtered by date range."
        actions={
          <>
            <ClearFiltersButton onClear={clearFilters} disabled={!hasFilters} />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!query.data?.length}><Download className="size-4" /> CSV</Button>
            <ExportButtons build={buildExport} disabled={!query.data?.length} />
          </>
        } />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-5">
          <Field label="Arrival From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Arrival To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Hotel">
            <AsyncCombobox fetcher={fetchHotelOptions} value={hotelId} label={hotelLabel}
              onChange={(v, l) => { setHotelId(v); setHotelLabel(l); }} placeholder="Any hotel" />
          </Field>
          <Field label="Market"><Combobox options={marketOpts} value={marketId} onChange={setMarketId} placeholder="Any" /></Field>
          <Field label="Hotel Booking Status"><Combobox options={statusOpts} value={status} onChange={setStatus} placeholder="Any" /></Field>
        </CardContent>
      </Card>

      {(query.data?.length ?? 0) > 0 && <ReportTotalCount count={query.data!.length} />}

      <Card>
        <CardContent className="p-0">
          {!from && !to && !hotelId && !status ? (
            <EmptyState title="Set a filter" description="Select arrival dates, a hotel, or a booking status to load the report." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={10} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !query.data?.length ? <EmptyState title="No arrivals" />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Ref</TH><TH>Hotel</TH><TH>Room Type</TH><TH>Arr</TH><TH>Dep</TH>
                    <TH className="text-right">Nts</TH><TH className="text-right">Rms</TH>
                    <TH>PAX</TH><TH>Market</TH><TH>FLT</TH><TH>Time</TH><TH>Status</TH><TH>Guests</TH>
                  </TR>
                </THead>
                <TBody>
                  {query.data.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-medium">{b.toBookingRef}</TD>
                      <TD className="max-w-[12rem] truncate">{b.hotel?.name}</TD>
                      <TD className="text-muted-foreground">{b.hotelRoomType?.name}</TD>
                      <TD>{fmtDate(b.arrivalDate)}</TD>
                      <TD>{fmtDate(b.departureDate)}</TD>
                      <TD className="text-right tabular-nums">{calcNights(b.arrivalDate, b.departureDate)}</TD>
                      <TD className="text-right tabular-nums">{b.numRooms}</TD>
                      <TD className="tabular-nums">{b.adults}+{b.children}+{b.infants}</TD>
                      <TD>{b.market?.code}</TD>
                      <TD>{b.arrFlightNo ?? "—"}</TD>
                      <TD>{b.arrFlightTime ?? "—"}</TD>
                      <TD><Badge variant={statusVariant(b.hotelStatus)}>{b.hotelStatus}</Badge></TD>
                      <TD className="max-w-[16rem] truncate text-muted-foreground">{b.guestNames ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
