"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2, Search, ArrowLeft } from "lucide-react";
import {
  nights as calcNights, plUsd, plEur, ebdAmountUsd, ebdAmountEur,
  formatMoney,
  BOOKING_STATUSES, ROOM_CATEGORIES, MEAL_BASES, PAYMENT_METHODS,
  STATUS_LABEL, ROOMCAT_LABEL, PAYMENT_LABEL,
  ACCOUNTANT_EDITABLE_FIELDS, canDeleteBooking,
  type Role,
} from "@itour/shared";
import { get, post, patch, del, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useLookups, lookupToOptions, fetchHotelOptions, fetchRoomTypeOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Combobox, enumOptions } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/states";

type S = Record<string, string>;

const EMPTY: S = {
  bookingDate: "", hotelStatus: "Confirmed", toStatus: "Confirmed",
  tourOperatorId: "", marketId: "", toBookingRef: "", sejourRef: "",
  resortId: "", hotelId: "", hotelRoomTypeId: "",
  arrivalDate: "", departureDate: "", roomCategory: "DBL", numRooms: "1",
  adults: "2", children: "0", infants: "0", mealBasis: "AI",
  guestNames: "", child1Age: "", child1Dob: "", child2Age: "", child2Dob: "",
  costUsd: "0", sellingUsd: "0", costEur: "0", sellingEur: "0",
  paymentMethod: "Cash", paymentOptionDate: "", accountingRemarks: "",
  visaHandling: "0", arrFlightNo: "", arrFlightTime: "", depFlightNo: "", depFlightTime: "",
  meetAssistVisa: "", remarks: "", ebdPercent: "", ebdPaymentDate: "", guestNameRebooked: "",
};

const num = (v: string) => (v === "" || v == null ? 0 : Number(v) || 0);
const optDate = (v: string) => (v ? v : undefined);
const optStr = (v: string) => (v.trim() ? v.trim() : undefined);
const optInt = (v: string) => (v === "" ? undefined : Number(v) || 0);

export function BookingForm({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = (user?.role ?? "VIEWER") as Role;
  const isAccountant = role === "ACCOUNTANT";
  const isViewer = role === "VIEWER";
  const lookups = useLookups();

  const [form, setForm] = useState<S>(EMPTY);
  const [hotelLabel, setHotelLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchRef, setSearchRef] = useState("");

  // Load existing booking (edit mode).
  const existing = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!bookingId,
    queryFn: () => get<any>(`/bookings/${bookingId}`),
  });

  useEffect(() => {
    const b = existing.data;
    if (!b) return;
    setForm({
      bookingDate: b.bookingDate?.slice(0, 10) ?? "",
      hotelStatus: b.hotelStatus, toStatus: b.toStatus,
      tourOperatorId: b.tourOperatorId, marketId: b.marketId, toBookingRef: b.toBookingRef ?? "",
      sejourRef: b.sejourRef ?? "", resortId: b.resortId, hotelId: b.hotelId,
      hotelRoomTypeId: b.hotelRoomTypeId, arrivalDate: b.arrivalDate?.slice(0, 10) ?? "",
      departureDate: b.departureDate?.slice(0, 10) ?? "", roomCategory: b.roomCategory,
      numRooms: String(b.numRooms ?? 1), adults: String(b.adults ?? 0),
      children: String(b.children ?? 0), infants: String(b.infants ?? 0), mealBasis: b.mealBasis,
      guestNames: b.guestNames ?? "", child1Age: b.child1Age?.toString() ?? "",
      child1Dob: b.child1Dob?.slice(0, 10) ?? "", child2Age: b.child2Age?.toString() ?? "",
      child2Dob: b.child2Dob?.slice(0, 10) ?? "", costUsd: String(b.costUsd ?? 0),
      sellingUsd: String(b.sellingUsd ?? 0), costEur: String(b.costEur ?? 0),
      sellingEur: String(b.sellingEur ?? 0), paymentMethod: b.paymentMethod,
      paymentOptionDate: b.paymentOptionDate?.slice(0, 10) ?? "", accountingRemarks: b.accountingRemarks ?? "",
      visaHandling: String(b.visaHandling ?? 0), arrFlightNo: b.arrFlightNo ?? "",
      arrFlightTime: b.arrFlightTime ?? "", depFlightNo: b.depFlightNo ?? "",
      depFlightTime: b.depFlightTime ?? "", meetAssistVisa: b.meetAssistVisa ?? "",
      remarks: b.remarks ?? "", ebdPercent: b.ebdPercent ? String(Number(b.ebdPercent) * 100) : "",
      ebdPaymentDate: b.ebdPaymentDate?.slice(0, 10) ?? "", guestNameRebooked: b.guestNameRebooked ?? "",
    });
    setHotelLabel(b.hotel?.name ?? "");
  }, [existing.data]);

  // Cascade: room types for the selected hotel.
  const roomTypes = useQuery({
    queryKey: ["room-types", form.hotelId],
    enabled: !!form.hotelId,
    queryFn: () => fetchRoomTypeOptions(form.hotelId),
  });

  const set = (k: keyof S | string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Live derived values.
  const ebdFraction = form.ebdPercent === "" ? 0 : Number(form.ebdPercent) / 100;
  const derived = useMemo(() => ({
    nights: form.arrivalDate && form.departureDate ? calcNights(form.arrivalDate, form.departureDate) : 0,
    plUsd: plUsd(num(form.costUsd), num(form.sellingUsd)),
    plEur: plEur(num(form.costEur), num(form.sellingEur), num(form.visaHandling)),
    ebdUsd: ebdAmountUsd(ebdFraction, num(form.costUsd)),
    ebdEur: ebdAmountEur(ebdFraction, num(form.costEur)),
  }), [form]);

  // Field is editable? Accountant only financial fields; Viewer none.
  const editable = (name: string) => {
    if (isViewer) return false;
    if (isAccountant) return (ACCOUNTANT_EDITABLE_FIELDS as readonly string[]).includes(name);
    return true;
  };
  const dis = (name: string) => !editable(name);

  function buildPayload() {
    const full: Record<string, unknown> = {
      bookingDate: form.bookingDate, hotelStatus: form.hotelStatus, toStatus: form.toStatus,
      tourOperatorId: form.tourOperatorId, marketId: form.marketId, toBookingRef: form.toBookingRef.trim(),
      sejourRef: optStr(form.sejourRef), resortId: form.resortId, hotelId: form.hotelId,
      hotelRoomTypeId: form.hotelRoomTypeId, arrivalDate: form.arrivalDate, departureDate: form.departureDate,
      roomCategory: form.roomCategory, numRooms: num(form.numRooms) || 1,
      adults: num(form.adults), children: num(form.children), infants: num(form.infants),
      mealBasis: form.mealBasis, guestNames: optStr(form.guestNames),
      child1Age: optInt(form.child1Age), child1Dob: optDate(form.child1Dob),
      child2Age: optInt(form.child2Age), child2Dob: optDate(form.child2Dob),
      costUsd: num(form.costUsd), sellingUsd: num(form.sellingUsd),
      costEur: num(form.costEur), sellingEur: num(form.sellingEur),
      paymentMethod: form.paymentMethod, paymentOptionDate: optDate(form.paymentOptionDate),
      accountingRemarks: optStr(form.accountingRemarks), visaHandling: num(form.visaHandling),
      arrFlightNo: optStr(form.arrFlightNo), arrFlightTime: optStr(form.arrFlightTime),
      depFlightNo: optStr(form.depFlightNo), depFlightTime: optStr(form.depFlightTime),
      meetAssistVisa: optStr(form.meetAssistVisa), remarks: optStr(form.remarks),
      ebdPercent: ebdFraction, ebdPaymentDate: optDate(form.ebdPaymentDate),
      guestNameRebooked: optStr(form.guestNameRebooked),
    };
    // Accountant PATCH: send only the fields they're allowed to change.
    if (isAccountant && bookingId) {
      const filtered: Record<string, unknown> = {};
      for (const k of ACCOUNTANT_EDITABLE_FIELDS) filtered[k] = full[k];
      return filtered;
    }
    return full;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.hotelId || !form.hotelRoomTypeId || !form.tourOperatorId || !form.marketId || !form.resortId) {
      setError("Hotel, Room Type, Tour Operator, Market and Resort are required.");
      return;
    }
    if (!form.arrivalDate || !form.departureDate || form.departureDate <= form.arrivalDate) {
      setError("Departure date must be after arrival date.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = bookingId
        ? await patch<any>(`/bookings/${bookingId}`, payload)
        : await post<any>("/bookings", payload);
      await qc.invalidateQueries({ queryKey: ["bookings"] });
      router.push(`/bookings/${saved.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save booking.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!bookingId || !confirm("Delete this booking?")) return;
    try {
      await del(`/bookings/${bookingId}`);
      await qc.invalidateQueries({ queryKey: ["bookings"] });
      router.push("/bookings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const ref = searchRef.trim();
    if (!ref) return;
    try {
      const b = await get<any>(`/bookings/by-ref/${encodeURIComponent(ref)}`);
      router.push(`/bookings/${b.id}`);
    } catch {
      setError(`No booking found for reference "${ref}".`);
    }
  }

  if (bookingId && existing.isLoading) {
    return <div className="flex justify-center py-20"><Spinner className="size-7 text-primary" /></div>;
  }
  if (bookingId && existing.isError) {
    return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  }

  const toOpts = lookupToOptions(lookups.data?.tourOperators);
  const marketOpts = lookupToOptions(lookups.data?.markets);
  const resortOpts = lookupToOptions(lookups.data?.resorts);
  const readOnlyCls = "bg-secondary/40 text-foreground";

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title={bookingId ? "Edit booking" : "New booking"}
        description={bookingId ? form.toBookingRef : "Create a hotel reservation."}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/bookings")}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {bookingId && canDeleteBooking(role) && (
              <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            {!isViewer && (
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Spinner className="size-4" /> : <Save className="size-4" />} Save
              </Button>
            )}
          </div>
        }
      />

      {/* Search existing by reference */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <Field label="T/O Booking Reference" className="flex-1 min-w-[220px]">
            <Input value={searchRef} onChange={(e) => setSearchRef(e.target.value)} placeholder="Load a booking by reference…" />
          </Field>
          <Button type="button" variant="outline" size="sm" onClick={onSearch}>
            <Search className="size-4" /> Search
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Booking & Status */}
        <Card>
          <CardHeader><CardTitle>Booking &amp; Status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Booking Date"><Input type="date" value={form.bookingDate} disabled={dis("bookingDate")} onChange={(e) => set("bookingDate", e.target.value)} /></Field>
            <Field label="T/O BKG Ref"><Input value={form.toBookingRef} disabled={dis("toBookingRef")} onChange={(e) => set("toBookingRef", e.target.value)} /></Field>
            <Field label="Sejour Ref"><Input value={form.sejourRef} disabled={dis("sejourRef")} onChange={(e) => set("sejourRef", e.target.value)} /></Field>
            <Field label="Tour Operator"><Combobox options={toOpts} value={form.tourOperatorId} disabled={dis("tourOperatorId")} onChange={(v) => set("tourOperatorId", v)} placeholder="Select" /></Field>
            <Field label="Market"><Combobox options={marketOpts} value={form.marketId} disabled={dis("marketId")} onChange={(v) => set("marketId", v)} placeholder="Select" /></Field>
            <Field label="HTL BKG Status"><Combobox options={enumOptions(BOOKING_STATUSES, STATUS_LABEL)} value={form.hotelStatus} disabled={dis("hotelStatus")} onChange={(v) => set("hotelStatus", v)} /></Field>
            <Field label="T/O BKG Status"><Combobox options={enumOptions(BOOKING_STATUSES, STATUS_LABEL)} value={form.toStatus} disabled={dis("toStatus")} onChange={(v) => set("toStatus", v)} /></Field>
          </CardContent>
        </Card>

        {/* Hotel & Stay */}
        <Card>
          <CardHeader><CardTitle>Hotel &amp; Stay</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Hotel Name" className="col-span-2">
              <AsyncCombobox fetcher={fetchHotelOptions} value={form.hotelId} label={hotelLabel} disabled={dis("hotelId")}
                onChange={(v, l) => { set("hotelId", v); setHotelLabel(l); set("hotelRoomTypeId", ""); }} placeholder="Search hotel…" />
            </Field>
            <Field label="Room Type" className="col-span-2" hint={!form.hotelId ? "Choose a hotel first" : undefined}>
              <Combobox options={roomTypes.data ?? []} value={form.hotelRoomTypeId} disabled={dis("hotelRoomTypeId") || !form.hotelId}
                onChange={(v) => set("hotelRoomTypeId", v)} placeholder={roomTypes.isLoading ? "Loading…" : "Select room type"} emptyText="No room types" />
            </Field>
            <Field label="Resort"><Combobox options={resortOpts} value={form.resortId} disabled={dis("resortId")} onChange={(v) => set("resortId", v)} placeholder="Select" /></Field>
            <Field label="Room"><Combobox options={enumOptions(ROOM_CATEGORIES, ROOMCAT_LABEL)} value={form.roomCategory} disabled={dis("roomCategory")} onChange={(v) => set("roomCategory", v)} /></Field>
            <Field label="No of Rooms"><Input type="number" min={1} value={form.numRooms} disabled={dis("numRooms")} onChange={(e) => set("numRooms", e.target.value)} /></Field>
            <Field label="Meal Basis"><Combobox options={enumOptions(MEAL_BASES)} value={form.mealBasis} disabled={dis("mealBasis")} onChange={(v) => set("mealBasis", v)} /></Field>
            <Field label="Arrival Date"><Input type="date" value={form.arrivalDate} disabled={dis("arrivalDate")} onChange={(e) => set("arrivalDate", e.target.value)} /></Field>
            <Field label="Departure Date"><Input type="date" value={form.departureDate} disabled={dis("departureDate")} onChange={(e) => set("departureDate", e.target.value)} /></Field>
            <Field label="Nights (computed)"><Input readOnly value={derived.nights} className={readOnlyCls} /></Field>
          </CardContent>
        </Card>

        {/* Financials & Payment */}
        <Card>
          <CardHeader><CardTitle>Financials &amp; Payment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Cost USD"><Input type="number" step="0.01" value={form.costUsd} disabled={dis("costUsd")} onChange={(e) => set("costUsd", e.target.value)} /></Field>
            <Field label="Selling USD"><Input type="number" step="0.01" value={form.sellingUsd} disabled={dis("sellingUsd")} onChange={(e) => set("sellingUsd", e.target.value)} /></Field>
            <Field label="P/L USD (computed)"><Input readOnly value={formatMoney(derived.plUsd, "USD")} className={readOnlyCls} /></Field>
            <div />
            <Field label="Cost EUR"><Input type="number" step="0.01" value={form.costEur} disabled={dis("costEur")} onChange={(e) => set("costEur", e.target.value)} /></Field>
            <Field label="Selling EUR"><Input type="number" step="0.01" value={form.sellingEur} disabled={dis("sellingEur")} onChange={(e) => set("sellingEur", e.target.value)} /></Field>
            <Field label="P/L EUR (computed)" hint="Incl. Visa & Handling"><Input readOnly value={formatMoney(derived.plEur, "EUR")} className={readOnlyCls} /></Field>
            <Field label="Visa & Handling"><Input type="number" step="0.01" value={form.visaHandling} disabled={dis("visaHandling")} onChange={(e) => set("visaHandling", e.target.value)} /></Field>
            <Field label="Payment Method"><Combobox options={enumOptions(PAYMENT_METHODS, PAYMENT_LABEL)} value={form.paymentMethod} disabled={dis("paymentMethod")} onChange={(v) => set("paymentMethod", v)} /></Field>
            <Field label="P. Option Date"><Input type="date" value={form.paymentOptionDate} disabled={dis("paymentOptionDate")} onChange={(e) => set("paymentOptionDate", e.target.value)} /></Field>
            <Field label="EBD %"><Input type="number" step="0.1" value={form.ebdPercent} disabled={dis("ebdPercent")} onChange={(e) => set("ebdPercent", e.target.value)} placeholder="e.g. 5" /></Field>
            <Field label="EBD Payment Date"><Input type="date" value={form.ebdPaymentDate} disabled={dis("ebdPaymentDate")} onChange={(e) => set("ebdPaymentDate", e.target.value)} /></Field>
            <Field label="EBD Amount USD"><Input readOnly value={formatMoney(derived.ebdUsd, "USD")} className={readOnlyCls} /></Field>
            <Field label="EBD Amount EUR"><Input readOnly value={formatMoney(derived.ebdEur, "EUR")} className={readOnlyCls} /></Field>
            <Field label="Accounting Remarks" className="col-span-2"><Textarea rows={2} value={form.accountingRemarks} disabled={dis("accountingRemarks")} onChange={(e) => set("accountingRemarks", e.target.value)} /></Field>
          </CardContent>
        </Card>

        {/* Guests & Occupancy */}
        <Card>
          <CardHeader><CardTitle>Guests &amp; Occupancy</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Adults"><Input type="number" min={0} value={form.adults} disabled={dis("adults")} onChange={(e) => set("adults", e.target.value)} /></Field>
            <Field label="Children"><Input type="number" min={0} value={form.children} disabled={dis("children")} onChange={(e) => set("children", e.target.value)} /></Field>
            <Field label="Infants"><Input type="number" min={0} value={form.infants} disabled={dis("infants")} onChange={(e) => set("infants", e.target.value)} /></Field>
            <div />
            <Field label="1st CHD Age"><Input type="number" value={form.child1Age} disabled={dis("child1Age")} onChange={(e) => set("child1Age", e.target.value)} /></Field>
            <Field label="1st CHD DOB"><Input type="date" value={form.child1Dob} disabled={dis("child1Dob")} onChange={(e) => set("child1Dob", e.target.value)} /></Field>
            <Field label="2nd CHD Age"><Input type="number" value={form.child2Age} disabled={dis("child2Age")} onChange={(e) => set("child2Age", e.target.value)} /></Field>
            <Field label="2nd CHD DOB"><Input type="date" value={form.child2Dob} disabled={dis("child2Dob")} onChange={(e) => set("child2Dob", e.target.value)} /></Field>
            <Field label="Guest Names" className="col-span-2"><Textarea rows={2} value={form.guestNames} disabled={dis("guestNames")} onChange={(e) => set("guestNames", e.target.value)} placeholder="Comma-separated guest names" /></Field>
          </CardContent>
        </Card>

        {/* Flights & Transfer */}
        <Card>
          <CardHeader><CardTitle>Flights &amp; Transfer</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Arr FLT No"><Input value={form.arrFlightNo} disabled={dis("arrFlightNo")} onChange={(e) => set("arrFlightNo", e.target.value)} /></Field>
            <Field label="Arr Time"><Input value={form.arrFlightTime} disabled={dis("arrFlightTime")} onChange={(e) => set("arrFlightTime", e.target.value)} placeholder="e.g. 14:30" /></Field>
            <Field label="Dep FLT No"><Input value={form.depFlightNo} disabled={dis("depFlightNo")} onChange={(e) => set("depFlightNo", e.target.value)} /></Field>
            <Field label="Dep FLT Time"><Input value={form.depFlightTime} disabled={dis("depFlightTime")} onChange={(e) => set("depFlightTime", e.target.value)} placeholder="e.g. 09:10" /></Field>
            <Field label="Meet, Assist & Visa" className="col-span-2"><Textarea rows={2} value={form.meetAssistVisa} disabled={dis("meetAssistVisa")} onChange={(e) => set("meetAssistVisa", e.target.value)} /></Field>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader><CardTitle>Remarks</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            <Field label="General Remarks"><Textarea rows={3} value={form.remarks} disabled={dis("remarks")} onChange={(e) => set("remarks", e.target.value)} /></Field>
            <Field label="Guest Name Rebooked"><Textarea rows={2} value={form.guestNameRebooked} disabled={dis("guestNameRebooked")} onChange={(e) => set("guestNameRebooked", e.target.value)} /></Field>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
