"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { formatMoney, fmtDate, round2 } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { ReportCurrencyTotals } from "@/components/report-currency-totals";
import { ClearFiltersButton } from "@/components/clear-filters-button";
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

const CUR_FIELDS: [string, string, string][] = [
  ["USD", "costUsd", "sellingUsd"],
  ["EUR", "costEur", "sellingEur"],
  ["EGP", "costEgp", "sellingEgp"],
];

// Cost/selling lines for every currency the booking actually carries figures in.
function currencyLines(b: any) {
  return CUR_FIELDS
    .map(([cur, c, s]) => ({ cur, cost: Number(b[c] ?? 0), selling: Number(b[s] ?? 0) }))
    .filter((x) => x.cost !== 0 || x.selling !== 0);
}

// Lead-to-full guest names: prefer HOTEL guests, fall back to any listed guest,
// then to the legacy free-text field.
function guestLabel(b: any): string {
  const list: any[] = b.guestNameList ?? [];
  const hotel = list.filter((g) => g.type === "HOTEL");
  const names = (hotel.length ? hotel : list).map((g) => g.name).filter(Boolean);
  if (names.length) return names.join(", ");
  return b.guestNames || "—";
}

const operatorLabel = (b: any) => b.tourOperator?.name || b.tourOperator?.code || "—";

export default function InvoicesReviewPage() {
  const lookups = useLookups();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tourOperatorId, setTourOperatorId] = useState("");
  const [status, setStatus] = useState("");
  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const statusOpts = lookups.data?.bookingStatuses ?? [];
  const filters = { from, to, tourOperatorId, status };

  const query = useQuery({
    queryKey: ["report-invoices-review", filters],
    queryFn: () => get<any[]>(`/reports/invoices-review${qs(filters)}`),
    enabled: !!(from || to || tourOperatorId || status),
  });

  const rows = query.data ?? [];

  const hasFilters = !!(from || to || tourOperatorId || status);
  const clearFilters = () => { setFrom(""); setTo(""); setTourOperatorId(""); setStatus(""); };

  const currencyTotals = CUR_FIELDS.map(([cur, c, s]) => ({
    currency: cur,
    rows: [
      { label: "Cost", value: round2(rows.reduce((a, b) => a + Number(b[c] ?? 0), 0)) },
      { label: "Selling", value: round2(rows.reduce((a, b) => a + Number(b[s] ?? 0), 0)) },
    ],
  }));

  const EXPORT_COLS = ["Operator", "Operator Reference", "Hotel Name", "Arrival", "Departure", "Guest Name", "Currencies Cost & Selling"];
  const EXPORT_ALIGNS = ["left", "left", "left", "left", "left", "left", "left"] as ("left" | "right")[];

  const currencyText = (b: any) => {
    const lines = currencyLines(b);
    if (!lines.length) return "—";
    return lines.map((x) => `${x.cur} Cost ${formatMoney(x.cost, x.cur)} / Sell ${formatMoney(x.selling, x.cur)}`).join(" | ");
  };

  function buildExport(): ExportSpec {
    return {
      title: "Invoices Review",
      filename: "invoices-review",
      columns: EXPORT_COLS,
      aligns: EXPORT_ALIGNS,
      rows: rows.map((b) => [
        operatorLabel(b), b.toBookingRef, b.hotel?.name ?? "",
        fmtDate(b.arrivalDate), fmtDate(b.departureDate),
        guestLabel(b), currencyText(b),
      ]),
    };
  }

  function exportCsv() {
    if (!rows.length) return;
    const lines = buildExport().rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [EXPORT_COLS.join(","), ...lines].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "invoices-review.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Invoices Review" description="Operator, stay dates, guest and per-currency cost &amp; selling per booking."
        actions={
          <>
            <ClearFiltersButton onClear={clearFilters} disabled={!hasFilters} />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> CSV</Button>
            <ExportButtons build={buildExport} disabled={!rows.length} />
          </>
        } />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="Arrival From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Arrival To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Operator"><Combobox options={toOpts} value={tourOperatorId} onChange={setTourOperatorId} placeholder="Any" /></Field>
          <Field label="Hotel Booking Status">
            <Combobox options={[{ value: "", label: "Any status" }, ...statusOpts]} value={status} onChange={setStatus} placeholder="Any status" />
          </Field>
        </CardContent>
      </Card>

      {rows.length > 0 && <ReportCurrencyTotals totals={currencyTotals} />}

      <Card>
        <CardContent className="p-0">
          {!from && !to && !tourOperatorId && !status ? (
            <EmptyState title="Set a filter" description="Select an arrival-date range, operator or booking status to load the report." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={7} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !rows.length ? <EmptyState title="No bookings" />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Operator</TH><TH>Operator Reference</TH><TH>Hotel Name</TH>
                    <TH>Arrival</TH><TH>Departure</TH><TH>Guest Name</TH>
                    <TH>Currencies Cost &amp; Selling</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((b) => (
                    <TR key={b.id}>
                      <TD>{operatorLabel(b)}</TD>
                      <TD className="font-medium">{b.toBookingRef}</TD>
                      <TD className="max-w-[12rem] truncate">{b.hotel?.name}</TD>
                      <TD className="whitespace-nowrap">{fmtDate(b.arrivalDate)}</TD>
                      <TD className="whitespace-nowrap">{fmtDate(b.departureDate)}</TD>
                      <TD className="max-w-[14rem] truncate" title={guestLabel(b)}>{guestLabel(b)}</TD>
                      <TD>
                        {currencyLines(b).length ? (
                          <div className="space-y-0.5">
                            {currencyLines(b).map((x) => (
                              <div key={x.cur} className="whitespace-nowrap tabular-nums text-xs">
                                <span className="font-medium">{x.cur}</span>{" "}
                                <span className="text-muted-foreground">Cost</span> {formatMoney(x.cost, x.cur)}{" "}
                                <span className="text-muted-foreground">· Sell</span> {formatMoney(x.selling, x.cur)}
                              </div>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TD>
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
