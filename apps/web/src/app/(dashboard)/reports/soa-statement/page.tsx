"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { fmtDate, round2, invoiceAmount } from "@itour/shared";
import { get, qs } from "@/lib/api";
import { ReportCurrencyTotals } from "@/components/report-currency-totals";
import { ReportTotalCount } from "@/components/report-total-count";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import {
  exportSoaStatementExcel, soaReportName,
  SOA_TAX_AMOUNT, SOA_TAX_RATE, SOA_TAX_TYPE, type SoaRow,
} from "@/lib/soa-statement";

const iso = (v: string | Date | null | undefined) => (v ? String(v).slice(0, 10) : "");

export default function SoaStatementPage() {
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [arrivalFrom, setArrivalFrom] = useState("");
  const [arrivalTo, setArrivalTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters = { dueFrom, dueTo, arrivalFrom, arrivalTo };
  const hasFilters = !!(dueFrom || dueTo || arrivalFrom || arrivalTo);

  const query = useQuery({
    queryKey: ["report-soa-statement", filters],
    queryFn: () => get<any[]>(`/reports/soa-statement${qs(filters)}`),
    enabled: hasFilters,
  });

  // One statement line per booking, in the column order the recipient expects.
  const rows: SoaRow[] = useMemo(() => (query.data ?? []).map((b: any) => {
    const { currency, amount } = invoiceAmount(b);
    return {
      supplierInvoiceNo: b.jumboInvoiceNo ?? "",
      roomType: b.hotelRoomType?.name ?? "",
      clientRefNo: b.toBookingRef ?? "",
      amount: round2(amount),
      currency,
      invoiceDate: iso(b.arrivalDate),
      invoiceDueDate: iso(b.invoiceDueDate),
    };
  }), [query.data]);

  const currencyTotals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const r of rows) byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.amount);
    return [...byCurrency.entries()].map(([currency, total]) => ({
      currency,
      rows: [{ label: "Invoice Amount", value: round2(total) }],
    }));
  }, [rows]);

  const reportName = soaReportName(dueTo, arrivalTo);

  async function exportExcel() {
    if (!rows.length || exporting) return;
    setExporting(true);
    try {
      await exportSoaStatementExcel(rows, reportName);
    } catch (err) {
      console.error("SOA Statement export failed", err);
      alert("Export failed — please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="SOA Statement"
        description="Statement of account for Jumbo — Confirmed JMB bookings with their issued invoice number, amount and due date (arrival + 45 days)."
        actions={
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!rows.length || exporting}>
            {exporting ? <Spinner className="size-4" /> : <FileSpreadsheet className="size-4" />} Excel
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="Due Date From"><DateInput value={dueFrom} onChange={setDueFrom} /></Field>
          <Field label="Due Date To"><DateInput value={dueTo} onChange={setDueTo} /></Field>
          <Field label="Arrival From"><DateInput value={arrivalFrom} onChange={setArrivalFrom} /></Field>
          <Field label="Arrival To"><DateInput value={arrivalTo} onChange={setArrivalTo} /></Field>
          <Field label="Operator"><Input value="Jumbo" readOnly disabled /></Field>
          <Field label="Hotel Booking Status"><Input value="Confirmed" readOnly disabled /></Field>
          <div className="flex items-end">
            <ClearFiltersButton
              onClear={() => { setDueFrom(""); setDueTo(""); setArrivalFrom(""); setArrivalTo(""); }}
              disabled={!hasFilters}
            />
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          <ReportCurrencyTotals totals={currencyTotals} />
          <ReportTotalCount count={rows.length} />
        </>
      )}

      <Card>
        <CardContent className="p-0">
          {!hasFilters ? (
            <EmptyState title="Set a date range" description="Filter by invoice due date, arrival date, or both." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={11} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !rows.length ? <EmptyState title="No statement lines" description="No Confirmed Jumbo bookings match these dates." />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Supplier Invoice No</TH>
                    <TH>Supplier Confirmation No</TH>
                    <TH>Client Ref No</TH>
                    <TH className="text-right">Invoice Amount</TH>
                    <TH className="text-right">Tax Amount</TH>
                    <TH className="text-right">Tax Rate</TH>
                    <TH>Tax Type</TH>
                    <TH>Currency</TH>
                    <TH>Invoice Date</TH>
                    <TH>Invoice Due Date</TH>
                    <TH>Invoice Type</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r, i) => (
                    <TR key={`${r.clientRefNo}-${i}`}>
                      <TD className="font-medium tabular-nums">
                        {r.supplierInvoiceNo || <span className="text-muted-foreground">not issued</span>}
                      </TD>
                      <TD className="max-w-[16rem] truncate" title={r.roomType}>{r.roomType || "—"}</TD>
                      <TD className="font-medium">{r.clientRefNo}</TD>
                      <TD className="text-right tabular-nums">{r.amount.toFixed(2)}</TD>
                      <TD className="text-right tabular-nums">{SOA_TAX_AMOUNT}</TD>
                      <TD className="text-right tabular-nums">{SOA_TAX_RATE}</TD>
                      <TD>{SOA_TAX_TYPE}</TD>
                      <TD>{r.currency}</TD>
                      <TD className="whitespace-nowrap">{fmtDate(r.invoiceDate)}</TD>
                      <TD className="whitespace-nowrap">
                        {r.invoiceDueDate ? fmtDate(r.invoiceDueDate) : <span className="text-muted-foreground">—</span>}
                      </TD>
                      <TD />
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
