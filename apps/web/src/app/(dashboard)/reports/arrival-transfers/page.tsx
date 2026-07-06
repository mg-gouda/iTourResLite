"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { fmtDate } from "@itour/shared";
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
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { ExportButtons } from "@/components/export-buttons";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { ReportTotalCount } from "@/components/report-total-count";
import type { ExportSpec } from "@/lib/export";

export default function ArrivalTransfersPage() {
  const lookups = useLookups();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const [tourOperatorId, setTourOperatorId] = useState("");
  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const filters = { from, to, hotelId, tourOperatorId };

  const query = useQuery({
    queryKey: ["report-arrival-transfers", filters],
    queryFn: () => get<any[]>(`/reports/arrival-transfers${qs(filters)}`),
    enabled: !!(from || to),
  });

  const hasFilters = !!(from || to || hotelId || tourOperatorId);
  const clearFilters = () => { setFrom(""); setTo(""); setHotelId(""); setHotelLabel(""); setTourOperatorId(""); };

  function buildExport(): ExportSpec {
    return {
      title: "Arrival Transfers",
      filename: "arrival-transfers",
      columns: ["Ref", "Arr Date", "FLT No", "FLT Time", "Hotel", "AD", "CH", "INF", "T/O", "Guests", "Meet & Visa"],
      aligns: ["left", "left", "left", "left", "left", "right", "right", "right", "left", "left", "left"],
      rows: (query.data ?? []).map((b) => [
        b.toBookingRef, fmtDate(b.arrivalDate),
        b.arrFlightNo ?? "", b.arrFlightTime ?? "",
        b.hotel?.name ?? "", b.adults, b.children, b.infants,
        b.tourOperator?.code ?? "", b.guestNames ?? "", b.meetAssistVisa ?? "",
      ]),
    };
  }

  function exportCsv() {
    const spec = buildExport();
    const lines = spec.rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [spec.columns.join(","), ...lines].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "arrival-transfers.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Arrival Transfers" description="Arrivals with flight details — transfers planning."
        actions={
          <>
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
          <Field label="Tour Operator"><Combobox options={toOpts} value={tourOperatorId} onChange={setTourOperatorId} placeholder="Any" /></Field>
          <div className="flex items-end">
            <ClearFiltersButton onClear={clearFilters} disabled={!hasFilters} />
          </div>
        </CardContent>
      </Card>

      {(query.data?.length ?? 0) > 0 && <ReportTotalCount count={query.data!.length} />}

      <Card>
        <CardContent className="p-0">
          {!from && !to ? (
            <EmptyState title="Set arrival dates" description="Select a date range to load the transfers report." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={8} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !query.data?.length ? <EmptyState title="No arrivals" />
          : (
            <Table>
              <THead>
                <TR>
                  <TH>Ref</TH><TH>Arr Date</TH><TH>FLT No</TH><TH>FLT Time</TH>
                  <TH>Hotel</TH><TH>T/O</TH><TH>PAX</TH><TH>Guests</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-medium">{b.toBookingRef}</TD>
                    <TD>{fmtDate(b.arrivalDate)}</TD>
                    <TD>{b.arrFlightNo ?? "—"}</TD>
                    <TD>{b.arrFlightTime ?? "—"}</TD>
                    <TD className="max-w-[14rem] truncate">{b.hotel?.name}</TD>
                    <TD>{b.tourOperator?.code}</TD>
                    <TD className="tabular-nums">{b.adults}+{b.children}+{b.infants}</TD>
                    <TD className="max-w-[16rem] truncate text-muted-foreground">{b.guestNames ?? "—"}</TD>
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
