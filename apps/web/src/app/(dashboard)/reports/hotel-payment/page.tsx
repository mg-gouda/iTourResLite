"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { formatMoney, fmtDate, round2 } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { ReportCurrencyTotals } from "@/components/report-currency-totals";
import { ReportTotalCount } from "@/components/report-total-count";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { useLookups, fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportSpec } from "@/lib/export";

export default function HotelPaymentPage() {
  const lookups = useLookups();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const statusOpts = lookups.data?.bookingStatuses ?? [];
  const filters = { from, to, hotelId, status, paid, creditNote };

  const query = useQuery({
    queryKey: ["report-hotel-payment", filters],
    queryFn: () => get<any[]>(`/reports/hotel-payment${qs(filters)}`),
    enabled: !!(from || to || hotelId || status || paid || creditNote),
  });

  const rows = query.data ?? [];

  const hasFilters = !!(from || to || hotelId || status || paid || creditNote);
  const clearFilters = () => { setFrom(""); setTo(""); setHotelId(""); setHotelLabel(""); setStatus(""); setPaid(""); setCreditNote(""); };

  const EXPORT_COLS = ["Operator Ref", "Hotel", "Status", "Cost USD", "Cost EUR", "Cost EGP", "Paid", "Balance", "Credit Note", "Payment Option", "Payment", "Paid Date"];
  const EXPORT_ALIGNS = ["left", "left", "left", "right", "right", "right", "right", "right", "right", "left", "left", "left"] as ("left" | "right")[];

  const payLabel = (b: any) => (b.bookingPaid ? "Paid" : b.paidTotal > 0 ? "Partial" : "Unpaid");
  const cnCurrency = (b: any) => b.creditNotes?.[0]?.currency ?? b.paidCurrency;

  // Per-currency totals: Cost from the fixed columns; Paid/Balance summed by the
  // booking's own (paid) currency; Credit Note by the note's currency.
  const COST_FIELD: Record<string, string> = { USD: "costUsd", EUR: "costEur", EGP: "costEgp" };
  const currencyTotals = ["USD", "EUR", "EGP"].map((cur) => ({
    currency: cur,
    rows: [
      { label: "Cost", value: round2(rows.reduce((a, b) => a + Number(b[COST_FIELD[cur]] ?? 0), 0)) },
      { label: "Paid", value: round2(rows.reduce((a, b) => a + (b.paidCurrency === cur ? Number(b.paidTotal ?? 0) : 0), 0)) },
      { label: "Balance", value: round2(rows.reduce((a, b) => a + (b.paidCurrency === cur ? Number(b.balance ?? 0) : 0), 0)) },
      { label: "Credit Note", value: round2(rows.reduce((a, b) => a + (cnCurrency(b) === cur ? Number(b.creditNoteRemaining ?? 0) : 0), 0)) },
    ],
  }));

  function buildExport(): ExportSpec {
    return {
      title: "Hotel Payment Report",
      filename: "hotel-payment",
      columns: EXPORT_COLS,
      aligns: EXPORT_ALIGNS,
      rows: rows.map((b) => [
        b.toBookingRef, b.hotel?.name ?? "", b.hotelStatus,
        Number(b.costUsd), Number(b.costEur), Number(b.costEgp),
        formatMoney(b.paidTotal ?? 0, b.paidCurrency), formatMoney(b.balance ?? 0, b.paidCurrency),
        b.creditNoteRemaining ? formatMoney(b.creditNoteRemaining, cnCurrency(b)) : "—",
        fmtDate(b.paymentOptionDate), payLabel(b), fmtDate(b.paidDate),
      ]),
    };
  }

  function exportCsv() {
    if (!rows.length) return;
    const lines = buildExport().rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [EXPORT_COLS.join(","), ...lines].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "hotel-payment.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Hotel Payment Report" description="Payment status and proof per booking, by paid date."
        actions={
          <>
            <ClearFiltersButton onClear={clearFilters} disabled={!hasFilters} />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> CSV</Button>
            <ExportButtons build={buildExport} disabled={!rows.length} />
          </>
        } />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Paid From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Paid To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Hotel">
            <AsyncCombobox fetcher={fetchHotelOptions} value={hotelId} label={hotelLabel}
              onChange={(v, l) => { setHotelId(v); setHotelLabel(l); }} placeholder="Any hotel" />
          </Field>
          <Field label="Payment">
            <Combobox
              options={[{ value: "", label: "All" }, { value: "paid", label: "Paid" }, { value: "partial", label: "Partial" }, { value: "unpaid", label: "Unpaid" }]}
              value={paid} onChange={setPaid} placeholder="All" />
          </Field>
          <Field label="Credit Note">
            <Combobox
              options={[{ value: "", label: "Any" }, { value: "any", label: "Has credit note" }, { value: "remaining", label: "Has remaining credit" }]}
              value={creditNote} onChange={setCreditNote} placeholder="Any" />
          </Field>
          <Field label="Hotel Booking Status">
            <Combobox options={[{ value: "", label: "Any status" }, ...statusOpts]} value={status} onChange={setStatus} placeholder="Any status" />
          </Field>
        </CardContent>
      </Card>

      {rows.length > 0 && <ReportTotalCount count={rows.length} />}
      {rows.length > 0 && <ReportCurrencyTotals totals={currencyTotals} />}

      <Card>
        <CardContent className="p-0">
          {!from && !to && !hotelId && !status && !paid && !creditNote ? (
            <EmptyState title="Set a filter" description="Select a paid-date range, hotel, payment status, credit-note or booking status to load the report." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={12} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !rows.length ? <EmptyState title="No bookings" />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Operator Ref</TH><TH>Hotel</TH><TH>Status</TH>
                    <TH className="text-right">Cost USD</TH><TH className="text-right">Cost EUR</TH><TH className="text-right">Cost EGP</TH>
                    <TH className="text-right">Paid</TH><TH className="text-right">Balance</TH><TH className="text-right">Credit Note</TH>
                    <TH>Payment Option</TH><TH>Payment</TH><TH>Paid Date</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-medium">{b.toBookingRef}</TD>
                      <TD className="max-w-[12rem] truncate">{b.hotel?.name}</TD>
                      <TD>{b.hotelStatus}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.costUsd, "USD")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.costEur, "EUR")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.costEgp, "EGP")}</TD>
                      <TD className="text-right tabular-nums">{formatMoney(b.paidTotal ?? 0, b.paidCurrency)}</TD>
                      <TD className={`text-right tabular-nums ${(b.balance ?? 0) > 0.005 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatMoney(b.balance ?? 0, b.paidCurrency)}</TD>
                      <TD className="text-right tabular-nums">
                        {b.creditNoteRemaining ? (
                          <span className="text-emerald-600 dark:text-emerald-400" title={`${b.creditNotes?.length ?? 0} credit note(s) held at this hotel`}>
                            {formatMoney(b.creditNoteRemaining, cnCurrency(b))}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TD>
                      <TD>{fmtDate(b.paymentOptionDate)}</TD>
                      <TD><Badge variant={b.bookingPaid ? "success" : b.paidTotal > 0 ? "warning" : "neutral"}>{payLabel(b)}</Badge></TD>
                      <TD>{fmtDate(b.paidDate)}</TD>
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
