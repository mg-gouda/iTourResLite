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

export default function PaymentOptionsPage() {
  const lookups = useLookups();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tourOperatorId, setTourOperatorId] = useState("");
  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const filters = { from, to, tourOperatorId };

  const query = useQuery({
    queryKey: ["report-payment-options", filters],
    queryFn: () => get<any[]>(`/reports/payment-options${qs(filters)}`),
    enabled: !!(from || to),
  });

  function exportCsv() {
    const rows = query.data ?? [];
    const header = ["Ref", "Hotel", "Arr Date", "Status", "Rooms", "Pay Method", "Payment Option Date", "Cost EUR", "Sell EUR"];
    const lines = rows.map((b) => [
      b.toBookingRef, b.hotel?.name, fmtDate(b.arrivalDate),
      b.hotelStatus, b.numRooms, b.paymentMethod,
      fmtDate(b.paymentOptionDate),
      Number(b.costEur), Number(b.sellingEur),
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "payment-options.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Payment Option Report" description="Bookings with upcoming payment option dates."
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!query.data?.length}><Download className="size-4" /> CSV</Button>} />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="Payment Option From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Payment Option To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Tour Operator"><Combobox options={toOpts} value={tourOperatorId} onChange={setTourOperatorId} placeholder="Any" /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {!from && !to ? (
            <EmptyState title="Set payment option dates" description="Select a date range to load the report." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={8} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !query.data?.length ? <EmptyState title="No payment options" />
          : (
            <Table>
              <THead>
                <TR>
                  <TH>Ref</TH><TH>Hotel</TH><TH>Arr Date</TH><TH>Status</TH>
                  <TH>Pay Method</TH><TH>Payment Option Date</TH>
                  <TH className="text-right">Cost EUR</TH><TH className="text-right">Sell EUR</TH>
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
                    <TD className="text-right tabular-nums">{formatMoney(b.costEur, "EUR")}</TD>
                    <TD className="text-right tabular-nums">{formatMoney(b.sellingEur, "EUR")}</TD>
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
