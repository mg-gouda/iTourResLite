"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { fmtDate, nights as calcNights, canIssueInvoices, type Role } from "@itour/shared";
import { get, post, qs } from "@/lib/api";
import { useLookups } from "@/lib/lookups";
import { useAuth } from "@/components/auth-provider";
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
import { buildJumboInvoicesZip, type JumboInvoice } from "@/lib/jumbo-invoice";

const iso = (v: string | Date | null | undefined) => (v ? String(v).slice(0, 10) : "");

// Lead client for the invoice, printed exactly as recorded on the booking —
// the title comes from the guest row, never from a guess. Falls back to the
// legacy free-text name (which carries no title) when no guest rows exist.
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

function downloadBlob(blob: Blob, filename: string) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function JumboInvoicesPage() {
  const lookups = useLookups();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const canIssue = canIssueInvoices((user?.role ?? "VIEWER") as Role);
  const filters = { from, to };
  const hasFilters = !!(from || to);

  const query = useQuery({
    queryKey: ["report-jumbo-invoices", filters],
    queryFn: () => get<any[]>(`/reports/jumbo-invoices${qs(filters)}`),
    enabled: hasFilters,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  // Only rows currently listed can be generated — a filter change drops the rest.
  const selectedIds = useMemo(
    () => rows.filter((b) => selected.has(b.id)).map((b) => b.id),
    [rows, selected],
  );
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const catLabel = (code: string) =>
    (lookups.data?.roomCategories ?? []).find((o: any) => o.value === code)?.label ?? code ?? "—";

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((b) => b.id)));
  }

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
      issuedBy: user?.name ?? "",
    };
  };

  // Issue (or re-use) the numbers for the ticked bookings, then build one PDF
  // per booking and download them together as a zip.
  async function generate() {
    if (!selectedIds.length || generating) return;
    setGenerating(true);
    try {
      const issued = await post<any[]>("/reports/jumbo-invoices/issue", { bookingIds: selectedIds });
      if (!issued.length) {
        toast.error("None of the selected bookings could be invoiced.");
        return;
      }
      const zip = await buildJumboInvoicesZip(issued.map(toInvoice));
      const stamp = from && to ? `${from}_${to}` : new Date().toISOString().slice(0, 10);
      downloadBlob(zip, `jumbo-invoices-${stamp}.zip`);
      toast.success(`Generated ${issued.length} invoice${issued.length === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["report-jumbo-invoices"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not generate the invoices.");
    } finally {
      setGenerating(false);
    }
  }

  const generateLabel = generating
    ? "Generating…"
    : selectedIds.length
      ? `Generate (${selectedIds.length})`
      : "Generate";

  return (
    <div>
      <PageHeader
        title="Jumbo Invoices"
        description="Confirmed Jumbo bookings arriving in the selected range. Tick the bookings to invoice — each one downloads as its own PDF inside a zip."
        actions={
          <Button size="sm" onClick={generate} disabled={!selectedIds.length || generating || !canIssue}
            title={canIssue ? undefined : "Only Accountant, Manager or Admin may issue invoices"}>
            <FileText className="size-4" /> {generateLabel}
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
            <ClearFiltersButton
              onClear={() => { setFrom(""); setTo(""); setSelected(new Set()); }}
              disabled={!hasFilters}
            />
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && <ReportTotalCount count={rows.length} />}
      {!canIssue && rows.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Issuing invoices is limited to Accountant, Manager and Admin users.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {!hasFilters ? (
            <EmptyState title="Set an arrival date range" description="Choose the arrival dates, tick the bookings to invoice, then press Generate." />
          ) : query.isLoading ? <TableSkeleton rows={8} cols={11} />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : !rows.length ? <EmptyState title="No confirmed Jumbo bookings" description="No Confirmed bookings for Jumbo arrive in this range." />
          : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-8">
                      <input type="checkbox" className="accent-primary size-4 align-middle"
                        checked={allSelected} onChange={toggleAll} aria-label="Select all bookings" />
                    </TH>
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
                      <TR key={b.id} className={selected.has(b.id) ? "bg-secondary/40" : undefined}>
                        <TD>
                          <input type="checkbox" className="accent-primary size-4 align-middle"
                            checked={selected.has(b.id)} onChange={() => toggleRow(b.id)}
                            aria-label={`Select booking ${inv.agencyRef}`} />
                        </TD>
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
