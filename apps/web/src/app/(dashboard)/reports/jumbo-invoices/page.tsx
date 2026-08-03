"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { fmtDate, nights as calcNights } from "@itour/shared";
import { get, post, qs } from "@/lib/api";
import { useLookups } from "@/lib/lookups";
import { useToast } from "@/components/toast-provider";
import { ReportTotalCount } from "@/components/report-total-count";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { openJumboInvoices, type JumboInvoice } from "@/lib/jumbo-invoice";

const iso = (v: string | Date | null | undefined) => (v ? String(v).slice(0, 10) : "");

// Lead client for the invoice: first HOTEL guest (falling back to any listed
// guest, then the legacy free-text field), printed as "Mr FAMILY NAME".
function clientName(b: any): string {
  const list: any[] = b.guestNameList ?? [];
  const hotel = list.filter((g) => g.type === "HOTEL" && g.name?.trim());
  const lead = (hotel.length ? hotel : list.filter((g) => g.name?.trim()))[0];
  if (lead) return `${lead.title ? lead.title + " " : ""}${lead.name.trim().toUpperCase()}`;
  const legacy = (b.guestNames ?? "").split(/[,\n]/)[0]?.trim();
  return legacy ? legacy.toUpperCase() : "—";
}

// Occupancy cell: "DBL" for a single room, "2 x DBL" when several rooms share a
// category, "DBL + SGL" when the booking mixes them.
function occupancy(b: any, label: (code: string) => string): string {
  const rooms = Math.max(1, Number(b.numRooms) || 1);
  let cats: string[] = [];
  try {
    const parsed = b.roomCatsJson ? JSON.parse(b.roomCatsJson) : null;
    if (Array.isArray(parsed)) cats = parsed.filter(Boolean).map(String);
  } catch { /* malformed JSON — fall back to the booking-level category */ }
  if (cats.length !== rooms) cats = Array.from({ length: rooms }, () => b.roomCategory);

  const counts = new Map<string, number>();
  cats.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  return [...counts.entries()]
    .map(([code, n]) => (n > 1 ? `${n} x ${label(code)}` : label(code)))
    .join(" + ");
}

// Selling total in the booking currency. GBP shares the USD selling column
// (see the booking form's currency handling); a missing currency is inferred
// from whichever selling figure is populated.
function money(b: any): { currency: string; amount: number } {
  const cur = b.bookingCurrency
    || (Number(b.sellingEur) ? "EUR" : Number(b.sellingEgp) ? "EGP" : "USD");
  const amount = cur === "EUR" ? Number(b.sellingEur)
    : cur === "EGP" ? Number(b.sellingEgp) : Number(b.sellingUsd);
  return { currency: cur, amount: Number.isFinite(amount) ? amount : 0 };
}

const paxOf = (b: any) => (Number(b.adults) || 0) + (Number(b.children) || 0) + (Number(b.infants) || 0);

export default function JumboInvoicesPage() {
  const lookups = useLookups();
  const toast = useToast();
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [generating, setGenerating] = useState(false);

  const filters = { from, to };
  const hasFilters = !!(from || to);

  const query = useQuery({
    queryKey: ["report-jumbo-invoices", filters],
    queryFn: () => get<any[]>(`/reports/jumbo-invoices${qs(filters)}`),
    enabled: hasFilters,
  });

  const rows = query.data ?? [];
  const catLabel = (code: string) =>
    (lookups.data?.roomCategories ?? []).find((o: any) => o.value === code)?.label ?? code ?? "—";

  const toInvoice = (b: any): JumboInvoice => {
    const { currency, amount } = money(b);
    return {
      invoiceNo: b.jumboInvoiceNo ?? "",
      agencyRef: b.toBookingRef ?? "",
      clientName: clientName(b),
      requestDate: iso(b.bookingDate),
      checkIn: iso(b.arrivalDate),
      checkOut: iso(b.departureDate),
      nights: calcNights(b.arrivalDate, b.departureDate),
      roomOccupancy: occupancy(b, catLabel),
      roomType: b.hotelRoomType?.name ?? "—",
      pax: paxOf(b),
      currency,
      amount,
    };
  };

  // Issue (or re-use) the invoice numbers server-side, then print the whole
  // batch as one document — one invoice page per booking.
  async function generate() {
    if (!rows.length || generating) return;
    setGenerating(true);
    try {
      const issued = await post<any[]>("/reports/jumbo-invoices/issue", filters);
      const opened = openJumboInvoices(issued.map(toInvoice));
      if (opened) toast.success(`Generated ${issued.length} invoice${issued.length === 1 ? "" : "s"}.`);
      else toast.error("Print window was blocked — please allow pop-ups for this site.");
      qc.invalidateQueries({ queryKey: ["report-jumbo-invoices"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not generate the invoices.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Jumbo Invoices"
        description="Confirmed Jumbo bookings arriving in the selected range, as one PDF with a separate invoice page per booking."
        actions={
          <Button size="sm" onClick={generate} disabled={!rows.length || generating}>
            <FileText className="size-4" /> {generating ? "Generating…" : "Generate"}
          </Button>
        }
      />
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="Arrival From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Arrival To"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Operator"><Input value="Jumbo" readOnly disabled /></Field>
          <Field label="Hotel Booking Status"><Input value="Confirmed" readOnly disabled /></Field>
          <div className="flex items-end">
            <ClearFiltersButton onClear={() => { setFrom(""); setTo(""); }} disabled={!hasFilters} />
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && <ReportTotalCount count={rows.length} />}

      <Card>
        <CardContent className="p-0">
          {!hasFilters ? (
            <EmptyState title="Set an arrival date range" description="Choose the arrival dates to invoice, then press Generate." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={10} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !rows.length ? <EmptyState title="No confirmed Jumbo bookings" description="No Confirmed bookings for Jumbo arrive in this range." />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Invoice No.</TH><TH>Agency Reference</TH><TH>Client Name</TH>
                    <TH>Request Date</TH><TH>Check In</TH><TH>Check Out</TH>
                    <TH className="text-right">Nights</TH><TH>Room Occupancy</TH><TH>Room Type</TH>
                    <TH className="text-right">Pax</TH><TH className="text-right">Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((b) => {
                    const inv = toInvoice(b);
                    return (
                      <TR key={b.id}>
                        <TD className="font-medium tabular-nums">
                          {inv.invoiceNo || <span className="text-muted-foreground">not issued</span>}
                        </TD>
                        <TD className="font-medium">{inv.agencyRef}</TD>
                        <TD className="max-w-[14rem] truncate" title={inv.clientName}>{inv.clientName}</TD>
                        <TD className="whitespace-nowrap">{fmtDate(b.bookingDate)}</TD>
                        <TD className="whitespace-nowrap">{fmtDate(b.arrivalDate)}</TD>
                        <TD className="whitespace-nowrap">{fmtDate(b.departureDate)}</TD>
                        <TD className="text-right tabular-nums">{inv.nights}</TD>
                        <TD className="whitespace-nowrap">{inv.roomOccupancy}</TD>
                        <TD className="max-w-[12rem] truncate" title={inv.roomType}>{inv.roomType}</TD>
                        <TD className="text-right tabular-nums">{inv.pax}</TD>
                        <TD className="text-right tabular-nums">{inv.currency} {inv.amount.toFixed(2)}</TD>
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
