"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { formatMoney, fmtDate } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useLookups, lookupToOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportSpec } from "@/lib/export";

export default function PaymentOptionsPage() {
  const lookups = useLookups();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tourOperatorId, setTourOperatorId] = useState("");
  const [status, setStatus] = useState("");
  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const statusOpts = lookups.data?.bookingStatuses ?? [];
  const filters = { from, to, tourOperatorId, status };

  const query = useQuery({
    queryKey: ["report-payment-options", filters],
    queryFn: () => get<any[]>(`/reports/payment-options${qs(filters)}`),
    enabled: !!(from || to || tourOperatorId || status),
  });

  function buildExport(): ExportSpec {
    return {
      title: "Payment Option Report",
      filename: "payment-options",
      columns: ["Ref", "Hotel", "Arr Date", "Status", "Rooms", "Pay Method", "Payment Option Date", "Currency", "Cost USD", "Sell USD", "Cost EUR", "Sell EUR", "Cost EGP", "Sell EGP"],
      aligns: ["left", "left", "left", "left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "right"],
      rows: (query.data ?? []).map((b) => [
        b.toBookingRef, b.hotel?.name, fmtDate(b.arrivalDate),
        b.hotelStatus, b.numRooms, b.paymentMethod,
        fmtDate(b.paymentOptionDate), b.bookingCurrency ?? "",
        Number(b.costUsd), Number(b.sellingUsd),
        Number(b.costEur), Number(b.sellingEur),
        Number(b.costEgp), Number(b.sellingEgp),
      ]),
    };
  }

  function exportCsv() {
    const spec = buildExport();
    const lines = spec.rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [spec.columns.join(","), ...lines].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "payment-options.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Payment Option Report" description="Bookings with upcoming payment option dates."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!query.data?.length}><Download className="size-4" /> CSV</Button>
            <ExportButtons build={buildExport} disabled={!query.data?.length} />
          </>
        } />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="Payment Option From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Payment Option To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Tour Operator"><Combobox options={toOpts} value={tourOperatorId} onChange={setTourOperatorId} placeholder="Any" /></Field>
          <Field label="Hotel Booking Status"><Combobox options={statusOpts} value={status} onChange={setStatus} placeholder="Any" /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {!from && !to && !tourOperatorId && !status ? (
            <EmptyState title="Set a filter" description="Select payment option dates, a tour operator, or a booking status to load the report." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={12} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !query.data?.length ? <EmptyState title="No payment options" />
          : (
            <Table>
              <THead>
                <TR>
                  <TH>Ref</TH><TH>Hotel</TH><TH>Arr Date</TH><TH>Status</TH>
                  <TH>Pay Method</TH><TH>Payment Option Date</TH><TH>Currency</TH>
                  <TH className="text-right">Cost USD</TH><TH className="text-right">Sell USD</TH>
                  <TH className="text-right">Cost EUR</TH><TH className="text-right">Sell EUR</TH>
                  <TH className="text-right">Cost EGP</TH><TH className="text-right">Sell EGP</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-medium">{b.toBookingRef}</TD>
                    <TD className="max-w-[12rem] truncate">{b.hotel?.name}</TD>
                    <TD>{fmtDate(b.arrivalDate)}</TD>
                    <TD>{b.hotelStatus}</TD>
                    <TD>{b.paymentMethod}</TD>
                    <TD className="font-medium text-warning">{fmtDate(b.paymentOptionDate)}</TD>
                    <TD>{b.bookingCurrency ?? "—"}</TD>
                    <TD className="text-right tabular-nums">{formatMoney(b.costUsd, "USD")}</TD>
                    <TD className="text-right tabular-nums">{formatMoney(b.sellingUsd, "USD")}</TD>
                    <TD className="text-right tabular-nums">{formatMoney(b.costEur, "EUR")}</TD>
                    <TD className="text-right tabular-nums">{formatMoney(b.sellingEur, "EUR")}</TD>
                    <TD className="text-right tabular-nums">{formatMoney(b.costEgp, "EGP")}</TD>
                    <TD className="text-right tabular-nums">{formatMoney(b.sellingEgp, "EGP")}</TD>
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
