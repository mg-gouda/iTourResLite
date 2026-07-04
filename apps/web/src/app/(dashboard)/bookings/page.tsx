"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Plus, Download, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import {
  formatMoney, fmtDate,
  nights as calcNights,
  canEditBooking,
  type Paginated,
  type Role,
} from "@itour/shared";
import { get, qs } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useLookups, lookupToOptions, fetchHotelOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Combobox } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";

interface BookingListItem {
  id: string;
  internalRef?: string | null;
  bookingDate: string;
  toBookingRef: string;
  sejourRef?: string | null;
  fileNumber?: string | null;
  hotelStatus: string;
  toStatus?: string;
  hotel?: { name?: string };
  hotelRoomType?: { name?: string };
  tourOperator?: { code?: string; name?: string };
  market?: { code?: string; name?: string };
  resort?: { code?: string; name?: string };
  arrivalDate: string;
  departureDate: string;
  nights?: number;
  roomCategory?: string;
  numRooms: number;
  adults?: number;
  children?: number;
  infants?: number;
  mealBasis?: string;
  costUsd?: number | string;
  sellingUsd?: number | string;
  plUsd?: number | string;
  costEur?: number | string;
  sellingEur: number | string;
  plEur?: number | string;
  costEgp?: number | string;
  sellingEgp?: number | string;
  plEgp?: number | string;
  visaHandling?: number | string;
  paymentMethod?: string;
  paymentOptionDate?: string | null;
  ebdPercent?: number | string;
  ebdAmountUsd?: number | string;
  ebdAmountEur?: number | string;
  ebdAmountEgp?: number | string;
  ebdPaymentDate?: string | null;
  arrFlightNo?: string | null;
  arrFlightTime?: string | null;
  depFlightNo?: string | null;
  depFlightTime?: string | null;
  meetAssistVisa?: string | null;
  remarks?: string | null;
  hasSpo?: boolean;
}

const PAGE_SIZE = 25;

const ALL_COLS = [
  // References
  { key: "internalRef",      label: "Internal Ref"       },
  { key: "ref",              label: "Operator Ref"       },
  { key: "sejourRef",        label: "Sejour Ref"         },
  { key: "fileNumber",       label: "File Number"        },
  { key: "bookingDate",      label: "Booking Date"       },
  // Location
  { key: "resort",           label: "Resort"             },
  { key: "hotel",            label: "Hotel"              },
  { key: "roomType",         label: "Room Type"          },
  { key: "roomCategory",     label: "Room Category"      },
  // Stay
  { key: "arrival",          label: "Arrival"            },
  { key: "departure",        label: "Departure"          },
  { key: "nights",           label: "Nights"             },
  { key: "rooms",            label: "Rooms"              },
  // Pax
  { key: "adults",           label: "Adults"             },
  { key: "children",         label: "Children"           },
  { key: "infants",          label: "Infants"            },
  { key: "mealBasis",        label: "Meal Basis"         },
  // Operator
  { key: "tourOperator",     label: "Tour Operator"      },
  { key: "market",           label: "Market"             },
  // Status
  { key: "hotelStatus",      label: "Hotel Status"       },
  { key: "toStatus",         label: "Operator Status"    },
  // Financials EUR
  { key: "costEur",          label: "Cost EUR"           },
  { key: "sellingEur",       label: "Selling EUR"        },
  { key: "plEur",            label: "P/L EUR"            },
  // Financials USD
  { key: "costUsd",          label: "Cost USD"           },
  { key: "sellingUsd",       label: "Selling USD"        },
  { key: "plUsd",            label: "P/L USD"            },
  // Financials EGP
  { key: "costEgp",          label: "Cost EGP"           },
  { key: "sellingEgp",       label: "Selling EGP"        },
  { key: "plEgp",            label: "P/L EGP"            },
  // Other financials
  { key: "visaHandling",     label: "Visa & Handling"    },
  { key: "paymentMethod",    label: "Payment Method"     },
  { key: "paymentOptionDate",label: "Payment Option Date"},
  // EBD
  { key: "ebdPercent",       label: "EBD %"              },
  { key: "ebdAmountUsd",     label: "EBD Amt USD"        },
  { key: "ebdAmountEur",     label: "EBD Amt EUR"        },
  { key: "ebdAmountEgp",     label: "EBD Amt EGP"        },
  { key: "ebdPaymentDate",   label: "EBD Payment Date"   },
  // Flights
  { key: "arrFlightNo",      label: "Arr Flight"         },
  { key: "arrFlightTime",    label: "Arr Time"           },
  { key: "depFlightNo",      label: "Dep Flight"         },
  { key: "depFlightTime",    label: "Dep Time"           },
  // Other
  { key: "meetAssistVisa",   label: "Meet & Assist"      },
  { key: "hasSpo",           label: "SPO"                },
  { key: "remarks",          label: "Remarks"            },
] as const;
type ColKey = typeof ALL_COLS[number]["key"];
const DEFAULT_COLS = new Set<ColKey>([
  "ref", "hotel", "roomType", "arrival", "departure", "nights", "rooms", "hotelStatus", "sellingEur", "plEur",
]);

export default function BookingsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const role = (user?.role ?? "VIEWER") as Role;
  const lookups = useLookups();

  const [ref, setRef] = useState(sp.get("ref") ?? "");
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    try {
      const saved = localStorage.getItem("bookings-cols");
      if (saved) return new Set(JSON.parse(saved) as ColKey[]);
    } catch { /* ignore */ }
    return DEFAULT_COLS;
  });
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setRef(sp.get("ref") ?? ""); setPage(1); }, [sp]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setColPickerOpen(false);
    }
    if (colPickerOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [colPickerOpen]);

  function toggleCol(key: ColKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      localStorage.setItem("bookings-cols", JSON.stringify([...next]));
      return next;
    });
  }
  const [hotelId, setHotelId] = useState("");
  const [hotelLabel, setHotelLabel] = useState("");
  const [tourOperatorId, setTourOperatorId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [resortId, setResortId] = useState("");
  const [status, setStatus] = useState("");
  const [hasSpo, setHasSpo] = useState("");
  const [currency, setCurrency] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filters = { ref: ref || undefined, hotelId: hotelId || undefined, tourOperatorId: tourOperatorId || undefined, marketId: marketId || undefined, resortId: resortId || undefined, status: status || undefined, hasSpo: hasSpo || undefined, currency: currency || undefined, from: from || undefined, to: to || undefined };

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
    setHasSpo("");
    setCurrency("");
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
        b.hotel?.name ?? "",
        b.hotelRoomType?.name ?? "",
        fmtDate(b.arrivalDate),
        fmtDate(b.departureDate),
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
  const statusOpts = lookups.data?.bookingStatuses ?? [];
  // Dynamic label map from DB — falls back to code if admin hasn't set a label
  const statusLabelMap = Object.fromEntries(statusOpts.map((s) => [s.value, s.label]));
  const spoOpts = [{ value: "true", label: "Has SPO" }, { value: "false", label: "No SPO" }];

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
          <Field label="Operator Reference">
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
              options={statusOpts}
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              placeholder="Any"
            />
          </Field>
          <Field label="SPO">
            <Combobox options={spoOpts} value={hasSpo} onChange={(v) => { setHasSpo(v); setPage(1); }} placeholder="Any" />
          </Field>
          <Field label="Currency">
            <Combobox
              options={[
                { value: "USD", label: "USD — US Dollar" },
                { value: "EUR", label: "EUR — Euro" },
                { value: "EGP", label: "EGP — Egyptian Pound" },
                { value: "GBP", label: "GBP — British Pound" },
              ]}
              value={currency}
              onChange={(v) => { setCurrency(v); setPage(1); }}
              placeholder="Any"
            />
          </Field>
          <Field label="Arrival from">
            <DateInput value={from} onChange={(v) => { setFrom(v); setPage(1); }} />
          </Field>
          <Field label="Arrival to">
            <DateInput value={to} onChange={(v) => { setTo(v); setPage(1); }} />
          </Field>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        {/* Column picker toolbar */}
        <div className="flex items-center justify-end border-b border-border px-4 py-2">
          <div className="relative" ref={colPickerRef}>
            <Button variant="outline" size="sm" onClick={() => setColPickerOpen((o) => !o)}>
              <Columns3 className="size-4" />
              Columns
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                {visibleCols.size}/{ALL_COLS.length}
              </span>
            </Button>
            {colPickerOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold text-muted-foreground">Toggle columns</span>
                  <button
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => {
                      setVisibleCols(new Set(DEFAULT_COLS));
                      localStorage.setItem("bookings-cols", JSON.stringify([...DEFAULT_COLS]));
                    }}
                  >
                    Reset
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto py-1 scrollbar-thin">
                  {ALL_COLS.map((col) => (
                    <label key={col.key} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-secondary/50">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={visibleCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-0">
          {query.isLoading ? (
            <TableSkeleton rows={8} cols={visibleCols.size} />
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
                    {visibleCols.has("internalRef")       && <TH>Internal Ref</TH>}
                    {visibleCols.has("ref")               && <TH>Operator Ref</TH>}
                    {visibleCols.has("sejourRef")         && <TH>Sejour Ref</TH>}
                    {visibleCols.has("fileNumber")        && <TH>File No.</TH>}
                    {visibleCols.has("bookingDate")       && <TH>Booking Date</TH>}
                    {visibleCols.has("resort")            && <TH>Resort</TH>}
                    {visibleCols.has("hotel")             && <TH>Hotel</TH>}
                    {visibleCols.has("roomType")          && <TH>Room Type</TH>}
                    {visibleCols.has("roomCategory")      && <TH>Room Cat.</TH>}
                    {visibleCols.has("arrival")           && <TH>Arrival</TH>}
                    {visibleCols.has("departure")         && <TH>Departure</TH>}
                    {visibleCols.has("nights")            && <TH className="text-right">Nts</TH>}
                    {visibleCols.has("rooms")             && <TH className="text-right">Rms</TH>}
                    {visibleCols.has("adults")            && <TH className="text-right">Adl</TH>}
                    {visibleCols.has("children")          && <TH className="text-right">Chd</TH>}
                    {visibleCols.has("infants")           && <TH className="text-right">Inf</TH>}
                    {visibleCols.has("mealBasis")         && <TH>Meal</TH>}
                    {visibleCols.has("tourOperator")      && <TH>Operator</TH>}
                    {visibleCols.has("market")            && <TH>Market</TH>}
                    {visibleCols.has("hotelStatus")       && <TH>Hotel Status</TH>}
                    {visibleCols.has("toStatus")          && <TH>Op. Status</TH>}
                    {visibleCols.has("costEur")           && <TH className="text-right">Cost EUR</TH>}
                    {visibleCols.has("sellingEur")        && <TH className="text-right">Sell EUR</TH>}
                    {visibleCols.has("plEur")             && <TH className="text-right">P/L EUR</TH>}
                    {visibleCols.has("costUsd")           && <TH className="text-right">Cost USD</TH>}
                    {visibleCols.has("sellingUsd")        && <TH className="text-right">Sell USD</TH>}
                    {visibleCols.has("plUsd")             && <TH className="text-right">P/L USD</TH>}
                    {visibleCols.has("costEgp")           && <TH className="text-right">Cost EGP</TH>}
                    {visibleCols.has("sellingEgp")        && <TH className="text-right">Sell EGP</TH>}
                    {visibleCols.has("plEgp")             && <TH className="text-right">P/L EGP</TH>}
                    {visibleCols.has("visaHandling")      && <TH className="text-right">Visa &amp; Hdl</TH>}
                    {visibleCols.has("paymentMethod")     && <TH>Payment</TH>}
                    {visibleCols.has("paymentOptionDate") && <TH>Option Date</TH>}
                    {visibleCols.has("ebdPercent")        && <TH className="text-right">EBD %</TH>}
                    {visibleCols.has("ebdAmountUsd")      && <TH className="text-right">EBD USD</TH>}
                    {visibleCols.has("ebdAmountEur")      && <TH className="text-right">EBD EUR</TH>}
                    {visibleCols.has("ebdAmountEgp")      && <TH className="text-right">EBD EGP</TH>}
                    {visibleCols.has("ebdPaymentDate")    && <TH>EBD Pmt Date</TH>}
                    {visibleCols.has("arrFlightNo")       && <TH>Arr Flight</TH>}
                    {visibleCols.has("arrFlightTime")     && <TH>Arr Time</TH>}
                    {visibleCols.has("depFlightNo")       && <TH>Dep Flight</TH>}
                    {visibleCols.has("depFlightTime")     && <TH>Dep Time</TH>}
                    {visibleCols.has("meetAssistVisa")    && <TH>Meet &amp; Assist</TH>}
                    {visibleCols.has("hasSpo")            && <TH>SPO</TH>}
                    {visibleCols.has("remarks")           && <TH>Remarks</TH>}
                  </TR>
                </THead>
                <TBody>
                  {data.data.map((b) => {
                    const n = b.nights ?? calcNights(b.arrivalDate, b.departureDate);
                    return (
                      <TR key={b.id} className="cursor-pointer" onClick={() => router.push(`/bookings/${b.id}`)}>
                        {visibleCols.has("internalRef")       && <TD className="tabular-nums text-muted-foreground">{b.internalRef ?? "—"}</TD>}
                        {visibleCols.has("ref")               && <TD className="font-medium">{b.toBookingRef}</TD>}
                        {visibleCols.has("sejourRef")         && <TD className="text-muted-foreground">{b.sejourRef ?? "—"}</TD>}
                        {visibleCols.has("fileNumber")        && <TD className="text-muted-foreground">{b.fileNumber ?? "—"}</TD>}
                        {visibleCols.has("bookingDate")       && <TD>{fmtDate(b.bookingDate)}</TD>}
                        {visibleCols.has("resort")            && <TD>{b.resort?.name ?? b.resort?.code ?? "—"}</TD>}
                        {visibleCols.has("hotel")             && <TD className="max-w-[14rem] truncate">{b.hotel?.name ?? "—"}</TD>}
                        {visibleCols.has("roomType")          && <TD className="max-w-[12rem] truncate text-muted-foreground">{b.hotelRoomType?.name ?? "—"}</TD>}
                        {visibleCols.has("roomCategory")      && <TD>{b.roomCategory ?? "—"}</TD>}
                        {visibleCols.has("arrival")           && <TD>{fmtDate(b.arrivalDate)}</TD>}
                        {visibleCols.has("departure")         && <TD>{fmtDate(b.departureDate)}</TD>}
                        {visibleCols.has("nights")            && <TD className="text-right tabular-nums">{n}</TD>}
                        {visibleCols.has("rooms")             && <TD className="text-right tabular-nums">{b.numRooms}</TD>}
                        {visibleCols.has("adults")            && <TD className="text-right tabular-nums">{b.adults ?? "—"}</TD>}
                        {visibleCols.has("children")          && <TD className="text-right tabular-nums">{b.children ?? "—"}</TD>}
                        {visibleCols.has("infants")           && <TD className="text-right tabular-nums">{b.infants ?? "—"}</TD>}
                        {visibleCols.has("mealBasis")         && <TD>{b.mealBasis ?? "—"}</TD>}
                        {visibleCols.has("tourOperator")      && <TD>{b.tourOperator?.name ?? b.tourOperator?.code ?? "—"}</TD>}
                        {visibleCols.has("market")            && <TD>{b.market?.name ?? b.market?.code ?? "—"}</TD>}
                        {visibleCols.has("hotelStatus")       && (
                          <TD><Badge variant={statusVariant(b.hotelStatus)}>{statusLabelMap[b.hotelStatus] ?? b.hotelStatus ?? "—"}</Badge></TD>
                        )}
                        {visibleCols.has("toStatus")          && (
                          <TD><Badge variant={statusVariant(b.toStatus ?? "")}>{statusLabelMap[b.toStatus ?? ""] ?? b.toStatus ?? "—"}</Badge></TD>
                        )}
                        {visibleCols.has("costEur")           && <TD className="text-right tabular-nums">{formatMoney(b.costEur ?? 0, "EUR")}</TD>}
                        {visibleCols.has("sellingEur")        && <TD className="text-right tabular-nums">{formatMoney(b.sellingEur, "EUR")}</TD>}
                        {visibleCols.has("plEur")             && <TD className="text-right tabular-nums">{b.plEur != null ? formatMoney(b.plEur, "EUR") : "—"}</TD>}
                        {visibleCols.has("costUsd")           && <TD className="text-right tabular-nums">{formatMoney(b.costUsd ?? 0, "USD")}</TD>}
                        {visibleCols.has("sellingUsd")        && <TD className="text-right tabular-nums">{formatMoney(b.sellingUsd ?? 0, "USD")}</TD>}
                        {visibleCols.has("plUsd")             && <TD className="text-right tabular-nums">{b.plUsd != null ? formatMoney(b.plUsd, "USD") : "—"}</TD>}
                        {visibleCols.has("costEgp")           && <TD className="text-right tabular-nums">{formatMoney(b.costEgp ?? 0, "EGP")}</TD>}
                        {visibleCols.has("sellingEgp")        && <TD className="text-right tabular-nums">{formatMoney(b.sellingEgp ?? 0, "EGP")}</TD>}
                        {visibleCols.has("plEgp")             && <TD className="text-right tabular-nums">{b.plEgp != null ? formatMoney(b.plEgp, "EGP") : "—"}</TD>}
                        {visibleCols.has("visaHandling")      && <TD className="text-right tabular-nums">{formatMoney(b.visaHandling ?? 0, "EUR")}</TD>}
                        {visibleCols.has("paymentMethod")     && <TD>{b.paymentMethod ?? "—"}</TD>}
                        {visibleCols.has("paymentOptionDate") && <TD>{b.paymentOptionDate ? fmtDate(b.paymentOptionDate) : "—"}</TD>}
                        {visibleCols.has("ebdPercent")        && <TD className="text-right tabular-nums">{b.ebdPercent != null ? `${(Number(b.ebdPercent) * 100).toFixed(1)}%` : "—"}</TD>}
                        {visibleCols.has("ebdAmountUsd")      && <TD className="text-right tabular-nums">{formatMoney(b.ebdAmountUsd ?? 0, "USD")}</TD>}
                        {visibleCols.has("ebdAmountEur")      && <TD className="text-right tabular-nums">{formatMoney(b.ebdAmountEur ?? 0, "EUR")}</TD>}
                        {visibleCols.has("ebdAmountEgp")      && <TD className="text-right tabular-nums">{formatMoney(b.ebdAmountEgp ?? 0, "EGP")}</TD>}
                        {visibleCols.has("ebdPaymentDate")    && <TD>{b.ebdPaymentDate ? fmtDate(b.ebdPaymentDate) : "—"}</TD>}
                        {visibleCols.has("arrFlightNo")       && <TD>{b.arrFlightNo ?? "—"}</TD>}
                        {visibleCols.has("arrFlightTime")     && <TD>{b.arrFlightTime ?? "—"}</TD>}
                        {visibleCols.has("depFlightNo")       && <TD>{b.depFlightNo ?? "—"}</TD>}
                        {visibleCols.has("depFlightTime")     && <TD>{b.depFlightTime ?? "—"}</TD>}
                        {visibleCols.has("meetAssistVisa")    && <TD className="max-w-[10rem] truncate">{b.meetAssistVisa ?? "—"}</TD>}
                        {visibleCols.has("hasSpo")            && <TD>{b.hasSpo ? <Badge variant="outline" className="text-[10px] py-0 px-1">SPO</Badge> : "—"}</TD>}
                        {visibleCols.has("remarks")           && <TD className="max-w-[16rem] truncate text-muted-foreground">{b.remarks ?? "—"}</TD>}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>

              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span>{data.total.toLocaleString()} bookings · page {data.page} of {totalPages}</span>
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
