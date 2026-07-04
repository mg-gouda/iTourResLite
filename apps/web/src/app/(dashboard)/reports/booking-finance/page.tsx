"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { formatMoney, fmtDate, plUsd, plEur, plEgp } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useLookups, lookupToOptions, fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";

export default function BookingFinancePage() {
  const lookups = useLookups();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const [tourOperatorId, setTourOperatorId] = useState("");
  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const filters = { from, to, hotelId, tourOperatorId };

  const query = useQuery({
    queryKey: ["report-booking-finance", filters],
    queryFn: () => get<any[]>(`/reports/booking-finance${qs(filters)}`),
    enabled: !!(from || to || hotelId),
  });

  const rows = query.data ?? [];
  const totals = rows.reduce((acc, b) => ({
    costUsd: acc.costUsd + Number(b.costUsd),
    sellingUsd: acc.sellingUsd + Number(b.sellingUsd),
    costEur: acc.costEur + Number(b.costEur),
    sellingEur: acc.sellingEur + Number(b.sellingEur),
    visaHandling: acc.visaHandling + Number(b.visaHandling),
    costEgp: acc.costEgp + Number(b.costEgp),
    sellingEgp: acc.sellingEgp + Number(b.sellingEgp),
  }), { costUsd: 0, sellingUsd: 0, costEur: 0, sellingEur: 0, visaHandling: 0, costEgp: 0, sellingEgp: 0 });

  function exportCsv() {
    if (!rows.length) return;
    const header = ["Ref", "Hotel", "Arr Date", "Dep Date", "Status", "Rooms", "Cost USD", "Sell USD", "P/L USD", "Cost EUR", "Sell EUR", "P/L EUR", "Cost EGP", "Sell EGP", "P/L EGP", "Pay Method"];
    const lines = rows.map((b) => [
      b.toBookingRef, b.hotel?.name, fmtDate(b.arrivalDate), fmtDate(b.departureDate),
      b.hotelStatus, b.numRooms,
      Number(b.costUsd), Number(b.sellingUsd), plUsd(b.costUsd, b.sellingUsd),
      Number(b.costEur), Number(b.sellingEur), plEur(b.costEur, b.sellingEur, b.visaHandling),
      Number(b.costEgp), Number(b.sellingEgp), plEgp(b.costEgp, b.sellingEgp),
      b.paymentMethod,
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "booking-finance.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Booking Finance Report" description="Cost, selling and P&L per booking."
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> CSV</Button>} />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="Arrival From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Arrival To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Hotel">
            <AsyncCombobox fetcher={fetchHotelOptions} value={hotelId} label={hotelLabel}
              onChange={(v, l) => { setHotelId(v); setHotelLabel(l); }} placeholder="Any hotel" />
          </Field>
          <Field label="Tour Operator"><Combobox options={toOpts} value={tourOperatorId} onChange={setTourOperatorId} placeholder="Any" /></Field>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card className="mb-4">
          <CardContent className="grid grid-cols-3 gap-4 p-4 sm:grid-cols-6 text-sm">
            <div><p className="text-muted-foreground text-xs">P/L USD</p><p className="tabular-nums font-medium">{formatMoney(plUsd(totals.costUsd, totals.sellingUsd), "USD")}</p></div>
            <div><p className="text-muted-foreground text-xs">P/L EUR</p><p className="tabular-nums font-medium">{formatMoney(plEur(totals.costEur, totals.sellingEur, totals.visaHandling), "EUR")}</p></div>
            <div><p className="text-muted-foreground text-xs">P/L EGP</p><p className="tabular-nums font-medium">{formatMoney(plEgp(totals.costEgp, totals.sellingEgp), "EGP")}</p></div>
            <div><p className="text-muted-foreground text-xs">Total Bookings</p><p className="tabular-nums font-medium">{rows.length}</p></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {!from && !to && !hotelId ? (
            <EmptyState title="Set a filter" description="Select dates or a hotel to load the finance report." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={10} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !rows.length ? <EmptyState title="No bookings" />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Ref</TH><TH>Hotel</TH><TH>Arr</TH><TH>Status</TH>
                    <TH className="text-right">Cost USD</TH><TH className="text-right">Sell USD</TH><TH className="text-right">P/L USD</TH>
                    <TH className="text-right">Cost EUR</TH><TH className="text-right">Sell EUR</TH><TH className="text-right">P/L EUR</TH>
                    <TH className="text-right">Cost EGP</TH><TH className="text-right">Sell EGP</TH><TH className="text-right">P/L EGP</TH>
                    <TH>Pay</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-medium">{b.toBookingRef}</TD>
                      <TD className="max-w-[12rem] truncate">{b.hotel?.name}</TD>
                      <TD>{fmtDate(b.arrivalDate)}</TD>
                      <TD>{b.hotelStatus}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.costUsd, "USD")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.sellingUsd, "USD")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(plUsd(b.costUsd, b.sellingUsd), "USD")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.costEur, "EUR")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.sellingEur, "EUR")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(plEur(b.costEur, b.sellingEur, b.visaHandling), "EUR")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.costEgp, "EGP")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.sellingEgp, "EGP")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(plEgp(b.costEgp, b.sellingEgp), "EGP")}</TD>
                      <TD>{b.paymentMethod}</TD>
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
