"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Plus, Download, ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatMoney,
  nights as calcNights,
  STATUS_LABEL,
  BOOKING_STATUSES,
  canEditBooking,
  type BookingStatus,
  type Paginated,
  type Role,
} from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useLookups, lookupToOptions, fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Combobox, enumOptions } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";

interface BookingListItem {
  id: string;
  toBookingRef: string;
  hotelName?: string;
  hotel?: { name?: string };
  roomTypeName?: string;
  hotelRoomType?: { name?: string };
  arrivalDate: string;
  departureDate: string;
  numRooms: number;
  hotelStatus: BookingStatus;
  sellingEur: number | string;
  costEur?: number | string;
  visaHandling?: number | string;
  plEur?: number | string;
}

const PAGE_SIZE = 25;

export default function BookingsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const role = (user?.role ?? "VIEWER") as Role;
  const lookups = useLookups();

  const [ref, setRef] = useState(sp.get("ref") ?? "");
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const [tourOperatorId, setTourOperatorId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [resortId, setResortId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filters = { ref, hotelId, tourOperatorId, marketId, resortId, status, from, to };

  const query = useQuery({
    queryKey: ["bookings", filters, page],
    placeholderData: keepPreviousData,
    queryFn: () =>
      get<Paginated<BookingListItem>>(
        `/bookings${qs({ ...filters, page, pageSize: PAGE_SIZE })}`,
      ),
  });

  function resetFilters() {
    setRef("");
    setHotelId("");
    setHotelLabel("");
    setTourOperatorId("");
    setMarketId("");
    setResortId("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function exportCsv() {
    const rows = query.data?.data ?? [];
    if (rows.length === 0) return;
    const header = ["Ref", "Hotel", "Room Type", "Arrival", "Departure", "Nights", "Rooms", "Status", "Selling EUR", "P/L EUR"];
    const lines = rows.map((b) => {
      const n = calcNights(b.arrivalDate, b.departureDate);
      return [
        b.toBookingRef,
        b.hotelName ?? b.hotel?.name ?? "",
        b.roomTypeName ?? b.hotelRoomType?.name ?? "",
        b.arrivalDate?.slice(0, 10),
        b.departureDate?.slice(0, 10),
        n,
        b.numRooms,
        b.hotelStatus,
        b.sellingEur,
        b.plEur ?? "",
      ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canCreate = canEditBooking(role) && role !== "ACCOUNTANT";
  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const marketOpts = lookupToOptions(lookups.data?.markets);
  const resortOpts = lookupToOptions(lookups.data?.resorts);

  const data = query.data;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Search, filter and manage reservations."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.data.length}>
              <Download className="size-4" /> Export CSV
            </Button>
            {canCreate && (
              <Button size="sm" onClick={() => router.push("/bookings/new")}>
                <Plus className="size-4" /> New booking
              </Button>
            )}
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="T/O Booking Ref">
            <Input
              value={ref}
              onChange={(e) => { setRef(e.target.value); setPage(1); }}
              placeholder="Reference…"
            />
          </Field>
          <Field label="Hotel">
            <AsyncCombobox
              fetcher={fetchHotelOptions}
              value={hotelId}
              label={hotelLabel}
              onChange={(v, l) => { setHotelId(v); setHotelLabel(l); setPage(1); }}
              placeholder="Any hotel"
            />
          </Field>
          <Field label="Tour Operator">
            <Combobox options={toOpts} value={tourOperatorId} onChange={(v) => { setTourOperatorId(v); setPage(1); }} placeholder="Any" />
          </Field>
          <Field label="Market">
            <Combobox options={marketOpts} value={marketId} onChange={(v) => { setMarketId(v); setPage(1); }} placeholder="Any" />
          </Field>
          <Field label="Resort">
            <Combobox options={resortOpts} value={resortId} onChange={(v) => { setResortId(v); setPage(1); }} placeholder="Any" />
          </Field>
          <Field label="Status">
            <Combobox
              options={enumOptions(BOOKING_STATUSES, STATUS_LABEL)}
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              placeholder="Any"
            />
          </Field>
          <Field label="Arrival from">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </Field>
          <Field label="Arrival to">
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </Field>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <TableSkeleton rows={8} cols={9} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : !data || data.data.length === 0 ? (
            <EmptyState
              title="No bookings found"
              description="Try adjusting filters or create a new booking."
              action={canCreate ? <Button size="sm" onClick={() => router.push("/bookings/new")}><Plus className="size-4" /> New booking</Button> : undefined}
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Ref</TH>
                    <TH>Hotel</TH>
                    <TH>Room Type</TH>
                    <TH>Arr</TH>
                    <TH>Dep</TH>
                    <TH className="text-right">Nts</TH>
                    <TH className="text-right">Rms</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Selling EUR</TH>
                    <TH className="text-right">P/L EUR</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.data.map((b) => {
                    const n = calcNights(b.arrivalDate, b.departureDate);
                    return (
                      <TR
                        key={b.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/bookings/${b.id}`)}
                      >
                        <TD className="font-medium">{b.toBookingRef}</TD>
                        <TD className="max-w-[14rem] truncate">{b.hotelName ?? b.hotel?.name ?? "—"}</TD>
                        <TD className="max-w-[12rem] truncate text-muted-foreground">{b.roomTypeName ?? b.hotelRoomType?.name ?? "—"}</TD>
                        <TD>{b.arrivalDate?.slice(0, 10)}</TD>
                        <TD>{b.departureDate?.slice(0, 10)}</TD>
                        <TD className="text-right tabular-nums">{n}</TD>
                        <TD className="text-right tabular-nums">{b.numRooms}</TD>
                        <TD><Badge variant={statusVariant(b.hotelStatus)}>{STATUS_LABEL[b.hotelStatus] ?? b.hotelStatus}</Badge></TD>
                        <TD className="text-right tabular-nums">{formatMoney(b.sellingEur, "EUR")}</TD>
                        <TD className="text-right tabular-nums">{b.plEur != null ? formatMoney(b.plEur, "EUR") : "—"}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>

              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span>
                  {data.total.toLocaleString()} bookings · page {data.page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
