"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2, Search, ArrowLeft, Mail, Plus, X, AlertTriangle, Sparkles, Calculator, Info, Download } from "lucide-react";
import {
  nights as calcNights, plUsd, plEur, plEgp, ebdAmountUsd, ebdAmountEur, ebdAmountEgp,
  formatMoney,
  ACCOUNTANT_EDITABLE_FIELDS, canDeleteBooking,
  type Role, type RateChangeEntry,
} from "@itour/shared";
import { get, post, patch, del, ApiError, API } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useConfirm } from "@/components/dialog-provider";
import { useLookups, lookupToOptions, fetchHotelOptions, fetchRoomTypeOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { DateInput } from "@/components/ui/date-input";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/states";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type S = Record<string, string>;

interface GuestRow { id?: string; title: string; name: string; type: "HOTEL" | "REBOOK"; room: number }
interface CalcRate { pppnDbl: string; sglRoom: string; pppnTpl: string; chd1: string; chd2: string; nChd1: string; nChd2: string }
interface DateSupp { desc: string; date: string; adultRate: string; childRate: string }
interface StaySupp { desc: string; adultRate: string; childRate: string }

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY: S = {
  bookingDate: TODAY, hotelStatus: "Confirmed", toStatus: "Confirmed",
  tourOperatorId: "", marketId: "", toBookingRef: "", sejourRef: "", fileNumber: "",
  resortId: "", hotelId: "", hotelRoomTypeId: "",
  arrivalDate: "", departureDate: "", roomCategory: "DBL", numRooms: "1",
  adults: "2", children: "0", infants: "0", mealBasis: "AI",
  child1Age: "", child1Dob: "", child2Age: "", child2Dob: "",
  infantAge: "", infantDob: "",
  bookingCurrency: "",
  costUsd: "0", sellingUsd: "0", calculationUsd: "",
  costEur: "0", sellingEur: "0", calculationEur: "",
  costEgp: "0", sellingEgp: "0", calculationEgp: "",
  paymentMethod: "Cash", paymentOptionDate: "",
  visaHandling: "0", arrFlightNo: "", arrFlightTime: "", depFlightNo: "", depFlightTime: "",
  meetAssistVisa: "", remarks: "", hotelRemarks: "", ebdPercent: "", ebdPaymentDate: "",
  hasEbd: "false", hasSpo: "false", sejourSpoCode: "", spoDate: "",
};

const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mstr", "Dr"];
const num = (v: string) => (v === "" || v == null ? 0 : Number(v) || 0);
const optDate = (v: string) => (v ? v : undefined);
const optStr = (v: string) => (v.trim() ? v.trim() : undefined);
const optInt = (v: string) => (v === "" ? undefined : Number(v) || 0);

function calcAge(dob: string, arrivalDate: string): number | null {
  if (!dob || !arrivalDate) return null;
  const d = new Date(dob); const a = new Date(arrivalDate);
  let age = a.getFullYear() - d.getFullYear();
  if (a.getMonth() < d.getMonth() || (a.getMonth() === d.getMonth() && a.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

function RateHistoryIcon({ history }: { history: RateChangeEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!history.length) return null;
  const fmt = (n: number, cur: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        className="flex items-center justify-center rounded-full p-0.5 text-amber-500 hover:text-amber-600 transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label="Rate change history"
      >
        <Info className="size-4" />
      </button>
      {open && (
        <div
          className="absolute left-6 top-0 z-50 w-[480px] rounded-lg border border-amber-500/30 bg-popover p-3 shadow-xl text-xs"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
            <Info className="size-3" /> Rate Change History ({history.length} change{history.length !== 1 ? "s" : ""})
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {history.map((e, i) => (
              <div key={i} className="rounded border border-border bg-secondary/40 px-3 py-2 space-y-1">
                <p className="text-[10px] text-muted-foreground">{fmtDate(e.changedAt)} — Currency: {e.currency}</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 tabular-nums">
                  {e.oldCostEur !== 0 && <><span className="text-muted-foreground">Cost EUR:</span><span className="col-span-2 font-medium">{fmt(e.oldCostEur, "EUR")}</span></>}
                  {e.oldCostUsd !== 0 && <><span className="text-muted-foreground">Cost USD:</span><span className="col-span-2 font-medium">{fmt(e.oldCostUsd, "USD")}</span></>}
                  {e.oldCostEgp !== 0 && <><span className="text-muted-foreground">Cost EGP:</span><span className="col-span-2 font-medium">{fmt(e.oldCostEgp, "EGP")}</span></>}
                  {e.oldPlEur !== 0 && <><span className="text-muted-foreground">P/L EUR:</span><span className={`col-span-2 font-semibold ${e.oldPlEur >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(e.oldPlEur, "EUR")}</span></>}
                  {e.oldPlUsd !== 0 && <><span className="text-muted-foreground">P/L USD:</span><span className={`col-span-2 font-semibold ${e.oldPlUsd >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(e.oldPlUsd, "USD")}</span></>}
                  {e.oldPlEgp !== 0 && <><span className="text-muted-foreground">P/L EGP:</span><span className={`col-span-2 font-semibold ${e.oldPlEgp >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(e.oldPlEgp, "EGP")}</span></>}
                </div>
                {(e.oldCalcEur || e.oldCalcUsd || e.oldCalcEgp) && (
                  <p className="text-[10px] text-muted-foreground font-mono leading-tight mt-1 truncate" title={e.oldCalcEur ?? e.oldCalcUsd ?? e.oldCalcEgp ?? ""}>
                    {e.oldCalcEur ?? e.oldCalcUsd ?? e.oldCalcEgp}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export function BookingForm({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const confirm = useConfirm();
  const role = (user?.role ?? "VIEWER") as Role;
  const isAccountant = role === "ACCOUNTANT";
  const isViewer = role === "VIEWER";
  const lookups = useLookups();

  const [form, setForm] = useState<S>(EMPTY);
  const [hotelLabel, setHotelLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchRef, setSearchRef] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [internalRef, setInternalRef] = useState<string | null>(null);
  const [guestList, setGuestList] = useState<GuestRow[]>([]);
  const [spoDocumentName, setSpoDocumentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stopSaleConflict, setStopSaleConflict] = useState<{ conflicts: { id: string; fromDate: string; toDate: string; qty: number; roomTypeName: string | null }[] } | null>(null);
  const [pendingOverride, setPendingOverride] = useState<Record<string, unknown> | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiDragging, setAiDragging] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [roomCats, setRoomCats] = useState<string[]>(["DBL"]);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcRates, setCalcRates] = useState<CalcRate[]>([]);
  const [calcResults, setCalcResults] = useState<number[]>([]);
  const [dateSupps, setDateSupps] = useState<DateSupp[]>([]);
  const [staySupps, setStaySupps] = useState<StaySupp[]>([]);
  const [dateSuppResults, setDateSuppResults] = useState<number[]>([]);
  const [staySuppResults, setStaySuppResults] = useState<number[]>([]);
  const [rateHistory, setRateHistory] = useState<RateChangeEntry[]>([]);

  const existing = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!bookingId,
    queryFn: () => get<any>(`/bookings/${bookingId}`),
  });

  useEffect(() => {
    const b = existing.data;
    if (!b) return;
    setInternalRef(b.internalRef ?? null);
    setForm({
      bookingDate: b.bookingDate?.slice(0, 10) ?? TODAY,
      hotelStatus: b.hotelStatus, toStatus: b.toStatus,
      tourOperatorId: b.tourOperatorId, marketId: b.marketId, toBookingRef: b.toBookingRef ?? "",
      sejourRef: b.sejourRef ?? "", fileNumber: b.fileNumber ?? "",
      resortId: b.resortId, hotelId: b.hotelId,
      hotelRoomTypeId: b.hotelRoomTypeId, arrivalDate: b.arrivalDate?.slice(0, 10) ?? "",
      departureDate: b.departureDate?.slice(0, 10) ?? "", roomCategory: b.roomCategory,
      numRooms: String(b.numRooms ?? 1), adults: String(b.adults ?? 0),
      children: String(b.children ?? 0), infants: String(b.infants ?? 0), mealBasis: b.mealBasis,
      child1Age: b.child1Age?.toString() ?? "", child1Dob: b.child1Dob?.slice(0, 10) ?? "",
      child2Age: b.child2Age?.toString() ?? "", child2Dob: b.child2Dob?.slice(0, 10) ?? "",
      infantAge: b.infantAge?.toString() ?? "", infantDob: b.infantDob?.slice(0, 10) ?? "",
      bookingCurrency: b.bookingCurrency ?? "",
      costUsd: String(b.costUsd ?? 0), sellingUsd: String(b.sellingUsd ?? 0),
      calculationUsd: b.calculationUsd ?? "",
      costEur: String(b.costEur ?? 0), sellingEur: String(b.sellingEur ?? 0),
      calculationEur: b.calculationEur ?? "",
      costEgp: String(b.costEgp ?? 0), sellingEgp: String(b.sellingEgp ?? 0),
      calculationEgp: b.calculationEgp ?? "",
      paymentMethod: b.paymentMethod,
      paymentOptionDate: b.paymentOptionDate?.slice(0, 10) ?? "",
      visaHandling: String(b.visaHandling ?? 0), arrFlightNo: b.arrFlightNo ?? "",
      arrFlightTime: b.arrFlightTime ?? "", depFlightNo: b.depFlightNo ?? "",
      depFlightTime: b.depFlightTime ?? "", meetAssistVisa: b.meetAssistVisa ?? "",
      remarks: b.remarks ?? "", hotelRemarks: b.hotelRemarks ?? "", ebdPercent: b.ebdPercent ? String(Number(b.ebdPercent) * 100) : "",
      ebdPaymentDate: b.ebdPaymentDate?.slice(0, 10) ?? "",
      hasEbd: (b.ebdPercent && Number(b.ebdPercent) > 0) ? "true" : "false",
      hasSpo: b.hasSpo ? "true" : "false", sejourSpoCode: b.sejourSpoCode ?? "",
      spoDate: b.spoDate?.slice(0, 10) ?? "",
    });
    // Restore per-room categories
    const n = b.numRooms ?? 1;
    const parsedCats: string[] | null = b.roomCatsJson ? (() => { try { return JSON.parse(b.roomCatsJson); } catch { return null; } })() : null;
    setRoomCats(Array.isArray(parsedCats) && parsedCats.length === n ? parsedCats : Array.from({ length: n }, () => b.roomCategory || "DBL"));
    setSpoDocumentName(b.spoDocumentName ?? null);
    setHotelLabel(b.hotel?.name ?? "");
    // Parse rate change history
    try {
      const hist = b.rateHistoryJson ? JSON.parse(b.rateHistoryJson) : [];
      setRateHistory(Array.isArray(hist) ? hist : []);
    } catch { setRateHistory([]); }
    if (b.guestNameList?.length) {
      setGuestList(b.guestNameList.map((g: any) => ({ id: g.id, title: g.title, name: g.name, type: g.type, room: g.room ?? 1 })));
    } else if (b.guestNames) {
      // migrate legacy plain-text guest names → HOTEL rows
      setGuestList(b.guestNames.split(/[,\n]/).map((n: string) => n.trim()).filter(Boolean)
        .map((name: string, i: number) => ({ title: "Mr", name, type: "HOTEL" as const, room: 1 })));
    }
  }, [existing.data]);

  const roomTypes = useQuery({
    queryKey: ["room-types", form.hotelId],
    enabled: !!form.hotelId,
    queryFn: () => fetchRoomTypeOptions(form.hotelId),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Booking Currency: selecting one zeros-out the others
  function onCurrencyChange(cur: string) {
    set("bookingCurrency", cur);
    if (cur === "USD") {
      setForm((f) => ({ ...f, bookingCurrency: cur, costEur: "0", sellingEur: "0", calculationEur: "", costEgp: "0", sellingEgp: "0", calculationEgp: "" }));
    } else if (cur === "EUR") {
      setForm((f) => ({ ...f, bookingCurrency: cur, costUsd: "0", sellingUsd: "0", calculationUsd: "", costEgp: "0", sellingEgp: "0", calculationEgp: "" }));
    } else if (cur === "EGP") {
      setForm((f) => ({ ...f, bookingCurrency: cur, costUsd: "0", sellingUsd: "0", calculationUsd: "", costEur: "0", sellingEur: "0", calculationEur: "" }));
    } else if (cur === "GBP") {
      setForm((f) => ({ ...f, bookingCurrency: cur, costEur: "0", sellingEur: "0", calculationEur: "", costEgp: "0", sellingEgp: "0", calculationEgp: "" }));
    }
  }

  // Child DOB → auto-calculate age vs arrival date
  function onChildDobChange(n: 1 | 2, dob: string) {
    const ageKey = n === 1 ? "child1Age" : "child2Age";
    const dobKey = n === 1 ? "child1Dob" : "child2Dob";
    const age = calcAge(dob, form.arrivalDate);
    setForm((f) => ({ ...f, [dobKey]: dob, [ageKey]: age != null ? String(age) : f[ageKey] }));
  }

  function onInfantDobChange(dob: string) {
    const age = calcAge(dob, form.arrivalDate);
    setForm((f) => ({ ...f, infantDob: dob, infantAge: age != null ? String(age) : f.infantAge }));
  }

  async function onSpoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bookingId) return;

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const allowed = [".eml", ".doc", ".docx", ".pdf", ".jpg", ".jpeg", ".png", ".msg"];
    if (!allowed.includes(ext)) {
      notify(false, `File type "${ext}" is not allowed. Accepted: ${allowed.join(", ")}`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/${bookingId}/upload-spo`, {
        method: "POST", body: fd, credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `Server error (${res.status})`);
      setSpoDocumentName(data.name);
      notify(true, `"${data.name}" uploaded successfully.`);
    } catch (err: any) {
      notify(false, err.message ?? "Upload failed — please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function notify(ok: boolean, msg: string) {
    setUploadStatus({ ok, msg });
    setTimeout(() => setUploadStatus(null), 6000);
  }

  const ebdFraction = form.ebdPercent === "" ? 0 : Number(form.ebdPercent) / 100;
  const derived = useMemo(() => ({
    nights: form.arrivalDate && form.departureDate ? calcNights(form.arrivalDate, form.departureDate) : 0,
    plUsd: plUsd(num(form.costUsd), num(form.sellingUsd)),
    plEur: plEur(num(form.costEur), num(form.sellingEur), num(form.visaHandling)),
    plEgp: plEgp(num(form.costEgp), num(form.sellingEgp)),
    ebdUsd: ebdAmountUsd(ebdFraction, num(form.costUsd)),
    ebdEur: ebdAmountEur(ebdFraction, num(form.costEur)),
    ebdEgp: ebdAmountEgp(ebdFraction, num(form.costEgp)),
    child1Age: form.child1Dob ? calcAge(form.child1Dob, form.arrivalDate) : null,
    child2Age: form.child2Dob ? calcAge(form.child2Dob, form.arrivalDate) : null,
    infantAge: form.infantDob ? calcAge(form.infantDob, form.arrivalDate) : null,
  }), [form, ebdFraction]);

  const editable = (name: string) => {
    if (isViewer) return false;
    if (isAccountant) return (ACCOUNTANT_EDITABLE_FIELDS as readonly string[]).includes(name);
    return true;
  };
  const dis = (name: string) => !editable(name);

  // Guest list helpers
  function addGuest(type: "HOTEL" | "REBOOK") {
    const room = type === "HOTEL" ? Math.max(1, parseInt(form.numRooms) || 1) : 1;
    setGuestList((g) => [...g, { title: "Mr", name: "", type, room }]);
  }
  function removeGuest(i: number) { setGuestList((g) => g.filter((_, j) => j !== i)); }
  function updateGuest(i: number, field: keyof GuestRow, val: string) {
    setGuestList((g) => g.map((r, j) => j === i ? { ...r, [field]: val } : r));
  }

  // ── Per-room helpers ────────────────────────────────────────────────────────
  function catToPax(cat: string): number {
    const c = (cat || "").toUpperCase();
    if (c === "SGL" || c.includes("SINGLE")) return 1;
    if (c.includes("TPL") || c.includes("TRIPLE")) return 3;
    if (c.includes("QUAD")) return 4;
    if (c.includes("QUIN")) return 5;
    return 2;
  }

  function syncGuests(newCats: string[]) {
    setGuestList((prev) => {
      const hotelByRoom: Record<number, GuestRow[]> = {};
      prev.filter((g) => g.type === "HOTEL").forEach((g) => {
        const r = g.room ?? 1;
        (hotelByRoom[r] ||= []).push(g);
      });
      const result: GuestRow[] = [];
      newCats.forEach((cat, i) => {
        const roomNum = i + 1;
        const pax = catToPax(cat);
        const existing = hotelByRoom[roomNum] ?? [];
        for (let j = 0; j < pax; j++) {
          result.push(existing[j] ?? { title: "Mr", name: "", type: "HOTEL", room: roomNum });
        }
      });
      const rebook = prev.filter((g) => g.type === "REBOOK");
      return [...result, ...rebook];
    });
  }

  function onNumRoomsChange(v: string) {
    set("numRooms", v);
    const n = Math.max(1, parseInt(v) || 1);
    const next = [...roomCats];
    while (next.length < n) next.push(next[0] || "DBL");
    const trimmed = next.slice(0, n);
    setRoomCats(trimmed);
    syncGuests(trimmed);
  }

  function onRoomCatChange(idx: number, cat: string) {
    const next = [...roomCats];
    next[idx] = cat;
    setRoomCats(next);
    syncGuests(next);
  }

  // ── Cost Calculation modal ──────────────────────────────────────────────────
  function openCalc() {
    const n = Math.max(1, parseInt(form.numRooms) || 1);
    const nChd1 = num(form.children) >= 1 ? "1" : "0";
    const nChd2 = num(form.children) >= 2 ? "1" : "0";
    setCalcRates(Array.from({ length: n }, (_, i) => calcRates[i] ?? { pppnDbl: "0", sglRoom: "0", pppnTpl: "0", chd1: "0", chd2: "0", nChd1, nChd2 }));
    setCalcResults(Array(n).fill(0));
    setDateSuppResults([]);
    setStaySuppResults([]);
    setCalcOpen(true);
  }

  function calculateCost() {
    const nights = derived.nights;
    const results = calcRates.map((r, i) => {
      const adults = catToPax(roomCats[i] ?? "DBL");
      const base = num(r.pppnDbl) + num(r.sglRoom) + num(r.pppnTpl);
      return (base * adults * nights) + (num(r.chd1) * num(r.nChd1) * nights) + (num(r.chd2) * num(r.nChd2) * nights);
    });
    setCalcResults(results);
    const totalAdults = roomCats.reduce((s, cat) => s + catToPax(cat), 0);
    const totalChd = calcRates.reduce((s, r) => s + num(r.nChd1) + num(r.nChd2), 0);
    setDateSuppResults(dateSupps.map((s) => (num(s.adultRate) * totalAdults) + (num(s.childRate) * totalChd)));
    setStaySuppResults(staySupps.map((s) => (num(s.adultRate) * totalAdults) + (num(s.childRate) * totalChd)));
  }

  function applyCalcTotal() {
    const nights = derived.nights;
    const totalAdults = roomCats.reduce((s, cat) => s + catToPax(cat), 0);
    const totalChd = calcRates.reduce((s, r) => s + num(r.nChd1) + num(r.nChd2), 0);

    const roomResults = calcRates.map((r, i) => {
      const adults = catToPax(roomCats[i] ?? "DBL");
      const base = num(r.pppnDbl) + num(r.sglRoom) + num(r.pppnTpl);
      return (base * adults * nights) + (num(r.chd1) * num(r.nChd1) * nights) + (num(r.chd2) * num(r.nChd2) * nights);
    });
    const dSuppTotals = dateSupps.map((s) => (num(s.adultRate) * totalAdults) + (num(s.childRate) * totalChd));
    const sSuppTotals = staySupps.map((s) => (num(s.adultRate) * totalAdults) + (num(s.childRate) * totalChd));

    const total = roomResults.reduce((a, b) => a + b, 0)
      + dSuppTotals.reduce((a, b) => a + b, 0)
      + sSuppTotals.reduce((a, b) => a + b, 0);

    const cur = form.bookingCurrency;

    const roomLines = calcRates.map((r, i) => {
      const adults = catToPax(roomCats[i] ?? "DBL");
      const base = num(r.pppnDbl) + num(r.sglRoom) + num(r.pppnTpl);
      const roomTotal = (base * adults * nights) + (num(r.chd1) * num(r.nChd1) * nights) + (num(r.chd2) * num(r.nChd2) * nights);
      const parts: string[] = [];
      if (base > 0) parts.push(`(${base}×${adults}adl×${nights}nts)`);
      if (num(r.chd1) > 0 && num(r.nChd1) > 0) parts.push(`(${r.chd1}×${r.nChd1}chd1×${nights}nts)`);
      if (num(r.chd2) > 0 && num(r.nChd2) > 0) parts.push(`(${r.chd2}×${r.nChd2}chd2×${nights}nts)`);
      return `Rm${i + 1}(${roomCats[i]}): ${parts.join("+")} = ${roomTotal.toFixed(2)}`;
    });
    const dateSuppLines = dateSupps.map((s, i) =>
      `DateSupp[${s.date || "?"}]${s.desc ? " " + s.desc : ""}: (${s.adultRate}×${totalAdults}adl)+(${s.childRate}×${totalChd}chd) = ${dSuppTotals[i].toFixed(2)}`
    );
    const staySuppLines = staySupps.map((s, i) =>
      `StaySupp${s.desc ? " " + s.desc : ""}: (${s.adultRate}×${totalAdults}adl)+(${s.childRate}×${totalChd}chd) = ${sSuppTotals[i].toFixed(2)}`
    );
    const allLines = [...roomLines, ...dateSuppLines, ...staySuppLines];
    const formula = allLines.join(" | ") + ` | Total: ${total.toFixed(2)}`;

    if (cur === "USD" || cur === "GBP") {
      setForm((f) => ({ ...f, costUsd: String(total), calculationUsd: formula }));
    } else if (cur === "EGP") {
      setForm((f) => ({ ...f, costEgp: String(total), calculationEgp: formula }));
    } else {
      setForm((f) => ({ ...f, costEur: String(total), calculationEur: formula }));
    }
    setCalcOpen(false);
  }

  function buildPayload() {
    const full: Record<string, unknown> = {
      bookingDate: form.bookingDate, hotelStatus: form.hotelStatus, toStatus: form.toStatus,
      tourOperatorId: form.tourOperatorId, marketId: form.marketId,
      toBookingRef: form.toBookingRef.trim(),
      sejourRef: optStr(form.sejourRef), fileNumber: optStr(form.fileNumber),
      resortId: form.resortId, hotelId: form.hotelId,
      hotelRoomTypeId: form.hotelRoomTypeId, arrivalDate: form.arrivalDate, departureDate: form.departureDate,
      roomCategory: roomCats[0] || form.roomCategory || "DBL",
      roomCatsJson: roomCats.length > 1 ? JSON.stringify(roomCats) : null,
      numRooms: num(form.numRooms) || 1,
      adults: num(form.adults), children: num(form.children), infants: num(form.infants),
      mealBasis: form.mealBasis,
      child1Age: optInt(form.child1Age), child1Dob: optDate(form.child1Dob),
      child2Age: optInt(form.child2Age), child2Dob: optDate(form.child2Dob),
      infantAge: optInt(form.infantAge), infantDob: optDate(form.infantDob),
      bookingCurrency: optStr(form.bookingCurrency),
      costUsd: num(form.costUsd), sellingUsd: num(form.sellingUsd),
      calculationUsd: optStr(form.calculationUsd),
      costEur: num(form.costEur), sellingEur: num(form.sellingEur),
      calculationEur: optStr(form.calculationEur),
      costEgp: num(form.costEgp), sellingEgp: num(form.sellingEgp),
      calculationEgp: optStr(form.calculationEgp),
      paymentMethod: form.paymentMethod, paymentOptionDate: optDate(form.paymentOptionDate),
      visaHandling: num(form.visaHandling),
      arrFlightNo: optStr(form.arrFlightNo), arrFlightTime: optStr(form.arrFlightTime),
      depFlightNo: optStr(form.depFlightNo), depFlightTime: optStr(form.depFlightTime),
      meetAssistVisa: optStr(form.meetAssistVisa), remarks: optStr(form.remarks), hotelRemarks: optStr(form.hotelRemarks),
      ebdPercent: ebdFraction, ebdPaymentDate: optDate(form.ebdPaymentDate),
      hasSpo: form.hasSpo === "true",
      sejourSpoCode: optStr(form.sejourSpoCode),
      spoDate: optDate(form.spoDate),
      guestList: guestList.filter((g) => g.name.trim()).map((g, i) => ({ title: g.title, name: g.name.trim(), type: g.type, room: g.room ?? 1, sortOrder: i })),
    };
    if (isAccountant && bookingId) {
      const filtered: Record<string, unknown> = {};
      for (const k of ACCOUNTANT_EDITABLE_FIELDS) filtered[k] = full[k];
      return filtered;
    }
    return full;
  }

  async function submitPayload(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const saved = bookingId
        ? await patch<any>(`/bookings/${bookingId}`, payload)
        : await post<any>("/bookings", payload);
      if (saved.internalRef) setInternalRef(saved.internalRef);
      await qc.invalidateQueries({ queryKey: ["bookings"] });
      router.push(`/bookings/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.details as any)?.conflicts) {
        setStopSaleConflict(err.details as any);
        setPendingOverride(payload);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to save booking.");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = [
      !form.resortId && "Resort",
      !form.hotelId && "Hotel",
      !form.hotelRoomTypeId && "Room Type",
      !form.tourOperatorId && "Tour Operator",
      !form.marketId && "Market",
    ].filter(Boolean);
    if (missing.length) {
      setError(`Required: ${missing.join(", ")}`);
      return;
    }
    if (!form.arrivalDate || !form.departureDate || form.departureDate <= form.arrivalDate) {
      setError("Departure date must be after arrival date.");
      return;
    }
    await submitPayload(buildPayload());
  }

  async function overrideAndSave() {
    if (!pendingOverride) return;
    setStopSaleConflict(null);
    await submitPayload({ ...pendingOverride, overrideStopSale: true });
    setPendingOverride(null);
  }

  async function onDelete() {
    if (!bookingId || !await confirm("Delete this booking?")) return;
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

  async function sendToHotel() {
    if (!bookingId) return;
    setSendingEmail(true);
    setError(null);
    try {
      // Download the composed message as a .eml file (opens in Outlook / Apple
      // Mail / Thunderbird) instead of sending it via the system.
      const res = await fetch(`${API}/bookings/${bookingId}/hotel-email.eml`, { credentials: "include" });
      if (!res.ok) {
        let msg = "Failed to generate email file.";
        try { const j = await res.json(); msg = j?.error?.message ?? msg; } catch { /* non-JSON */ }
        throw new ApiError(msg, res.status);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `Hotel-Booking-${bookingId}.eml`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify(true, "Email file downloaded.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download email.");
    } finally {
      setSendingEmail(false);
    }
  }

  async function parseEmailWithAI() {
    if (!aiFile) return;
    setAiParsing(true);
    setAiError(null);
    setAiResult(null);
    try {
      const fd = new FormData();
      fd.append("file", aiFile);
      const res = await fetch(`${API}/bookings/parse-email`, {
        method: "POST", body: fd, credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? data?.message ?? `Server error (${res.status})`);
      setAiResult(data);
    } catch (err: any) {
      setAiError(err.message ?? "Parsing failed — please try again.");
    } finally {
      setAiParsing(false);
    }
  }

  function applyAiResult() {
    if (!aiResult) return;
    const r = aiResult;
    const updates: Partial<S> = {};
    if (r.toBookingRef) updates.toBookingRef = r.toBookingRef;
    if (r.arrivalDate) updates.arrivalDate = r.arrivalDate;
    if (r.departureDate) updates.departureDate = r.departureDate;
    if (r.numRooms) updates.numRooms = String(r.numRooms);
    if (r.roomCategory) {
      updates.roomCategory = r.roomCategory;
      const n = r.numRooms ? parseInt(String(r.numRooms)) : 1;
      setRoomCats(Array.from({ length: Math.max(1, n) }, () => r.roomCategory));
    }
    if (r.adults !== undefined) updates.adults = String(r.adults);
    if (r.children !== undefined) updates.children = String(r.children);
    if (r.infants !== undefined) updates.infants = String(r.infants);
    if (r.mealBasis) updates.mealBasis = r.mealBasis;
    if (r.arrFlightNo) updates.arrFlightNo = r.arrFlightNo;
    if (r.depFlightNo) updates.depFlightNo = r.depFlightNo;
    if (r.remarks) updates.remarks = r.remarks;
    // Hotel booking status = Pending on import; operator status = Confirmed (from email)
    updates.hotelStatus = "Pending";
    updates.toStatus = "Confirmed";

    // Amount from operator email = selling price (Gemini may return sellingAmount or costAmount)
    const amount = r.sellingAmount ?? r.costAmount;
    if (r.currency && amount) {
      updates.bookingCurrency = r.currency;
      if (r.currency === "USD" || r.currency === "GBP") updates.sellingUsd = String(amount);
      else if (r.currency === "EUR") updates.sellingEur = String(amount);
      else if (r.currency === "EGP") updates.sellingEgp = String(amount);
    }

    // Market code → ID lookup (DE = West Market, etc.)
    if (r.marketCode && lookups.data?.markets) {
      const code = String(r.marketCode).toLowerCase();
      const MARKET_HINTS: Record<string, string[]> = {
        de: ["west market", "west european", "western europe", "german"],
        nl: ["west market", "dutch", "netherlands"],
        be: ["west market", "belgian", "belgium"],
        at: ["west market", "austrian", "austria"],
        ch: ["west market", "swiss", "switzerland"],
        fr: ["french", "france"],
        gb: ["british", "uk", "united kingdom"],
        it: ["italian", "italy"],
        es: ["spanish", "spain"],
        pl: ["east european", "polish", "poland"],
        cz: ["east european", "czech"],
        ru: ["russian", "russia"],
        tr: ["turkish", "turkey"],
        eg: ["egyptian", "egypt"],
      };
      const hints = MARKET_HINTS[code] ?? [code];
      const match = (lookups.data.markets as any[]).find((m: any) =>
        m.code?.toLowerCase() === code ||
        hints.some((h) => m.name?.toLowerCase().includes(h)),
      );
      if (match?.id) updates.marketId = match.id;
    }

    // Tour operator name → ID lookup (fuzzy: alias table, code, name contains)
    if (r.tourOperatorName && lookups.data?.tourOperators) {
      const OP_ALIASES: Record<string, string> = {
        jumbonline: "jumbo", "jumbo online": "jumbo", "jumbo tours": "jumbo",
      };
      const rawName = String(r.tourOperatorName).toLowerCase().trim();
      const name = OP_ALIASES[rawName] ?? rawName;
      const opMatch = (lookups.data.tourOperators as any[]).find((m: any) => {
        const mCode = (m.code ?? "").toLowerCase();
        const mName = (m.name ?? "").toLowerCase();
        return mCode === name || mName === name ||
               mName.includes(name) || name.includes(mName) ||
               (mName.length >= 3 && name.includes(mName));
      });
      if (opMatch?.id) {
        updates.tourOperatorId = opMatch.id;
        // Infer market from operator if market not already resolved
        if (!updates.marketId) {
          const OP_MARKET: Record<string, string[]> = {
            jumbo: ["west market"], myway: ["west market"],
            tui: ["west market"], dertour: ["west market"],
            fti: ["west market"], neckermann: ["west market"],
          };
          const mHints = OP_MARKET[name] ?? OP_MARKET[(opMatch.name ?? "").toLowerCase()];
          if (mHints) {
            const mMatch = (lookups.data.markets as any[] ?? []).find((m: any) =>
              mHints.some((h) => m.name?.toLowerCase().includes(h)),
            );
            if (mMatch?.id) updates.marketId = mMatch.id;
          }
        }
      }
    }

    // Hotel + resort + room type IDs from backend DB match
    if (r.resortId) updates.resortId = r.resortId;
    if (r.hotelId) updates.hotelId = r.hotelId;
    if (r.hotelRoomTypeId) updates.hotelRoomTypeId = r.hotelRoomTypeId;

    const clean: S = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)) as S;
    setForm((f) => ({ ...f, ...clean }));
    if (r.hotelId && r.hotelName) setHotelLabel(r.hotelName);
    if (r.guestNames?.length) {
      setGuestList(r.guestNames.map((g: any, i: number) => ({ title: g.title || "Mr", name: g.name, type: "HOTEL" as const, room: 1 })));
    }
    setAiOpen(false);
    setAiFile(null);
    setAiResult(null);
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
  const statusOpts = lookups.data?.bookingStatuses ?? [];
  const roomCatOpts = lookups.data?.roomCategories ?? [];
  const mealBasisOpts = lookups.data?.mealBases ?? [];
  const payMethodOpts = lookups.data?.paymentMethods ?? [];
  const currencyOpts = lookups.data?.currencies ?? [];
  const readOnlyCls = "bg-secondary/40 text-foreground";

  const cur = form.bookingCurrency;
  const showUsd = !cur || cur === "USD" || cur === "GBP";
  const showEur = !cur || cur === "EUR";
  const showEgp = !cur || cur === "EGP";

  return (
    <>
    <form onSubmit={onSubmit}>
      <PageHeader
        title={bookingId ? "Edit booking" : "New booking"}
        description={bookingId ? `${internalRef ? `#${internalRef} · ` : ""}${form.toBookingRef}` : "Create a hotel reservation."}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/bookings")}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {!bookingId && !isViewer && (
              <Button type="button" variant="outline" size="sm" onClick={() => { setAiOpen(true); setAiResult(null); setAiError(null); setAiFile(null); }}>
                <Sparkles className="size-4" /> AI Import
              </Button>
            )}
            {bookingId && !isViewer && (
              <Button type="button" variant="outline" size="sm" onClick={sendToHotel} disabled={sendingEmail}>
                {sendingEmail ? <Spinner className="size-4" /> : <Download className="size-4" />} Download Email
              </Button>
            )}
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
          <Field label="Operator Reference" className="flex-1 min-w-[220px]">
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
        {/* ── Booking & Status ── */}
        <Card>
          <CardHeader><CardTitle>Booking &amp; Status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Internal Ref">
              <Input readOnly value={internalRef ?? (bookingId ? "—" : "Auto-generated")} className={readOnlyCls} />
            </Field>
            <Field label="Booking Date">
              <DateInput value={form.bookingDate} disabled={dis("bookingDate")} onChange={(v) => set("bookingDate", v)} />
            </Field>
            <Field label="Operator Reference"><Input value={form.toBookingRef} disabled={dis("toBookingRef")} onChange={(e) => set("toBookingRef", e.target.value)} /></Field>
            <Field label="Sejour Reference"><Input value={form.sejourRef} disabled={dis("sejourRef")} onChange={(e) => set("sejourRef", e.target.value)} /></Field>
            <Field label="File No (Local Market)"><Input value={form.fileNumber} disabled={dis("fileNumber")} onChange={(e) => set("fileNumber", e.target.value)} placeholder="FT-1001-01" /></Field>
            <Field label="Has SPO?">
              <Combobox options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]}
                value={form.hasSpo} disabled={dis("hasSpo")} onChange={(v) => set("hasSpo", v)} />
            </Field>
            {form.hasSpo === "true" && (
              <>
                <Field label="SPO Code">
                  <Input value={form.sejourSpoCode} disabled={dis("sejourSpoCode")} onChange={(e) => set("sejourSpoCode", e.target.value)} placeholder="SPO-2024-01" />
                </Field>
                <Field label="SPO Date">
                  <DateInput value={form.spoDate} disabled={dis("spoDate")} onChange={(v) => set("spoDate", v)} />
                </Field>
                <div className="col-span-2 space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">SPO Document</span>
                  <div className="flex flex-wrap items-center gap-3">
                    {spoDocumentName && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL}/bookings/${bookingId}/spo-document`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        {spoDocumentName}
                      </a>
                    )}
                    {!isViewer && (
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-secondary/60">
                        {uploading ? (
                          <Spinner className="size-4" />
                        ) : (
                          <span>{spoDocumentName ? "Replace file" : "Upload file"}</span>
                        )}
                        <input
                          type="file"
                          className="sr-only"
                          accept=".eml,.doc,.docx,.pdf,.jpg,.jpeg,.png"
                          disabled={!bookingId || uploading}
                          onChange={onSpoFileChange}
                        />
                      </label>
                    )}
                    {!bookingId && !isViewer && (
                      <span className="text-xs text-muted-foreground">Save the booking first to attach a file.</span>
                    )}
                  </div>
                  {uploadStatus && (
                    <p className={`mt-1.5 text-xs font-medium ${uploadStatus.ok ? "text-success" : "text-destructive"}`}>
                      {uploadStatus.ok ? "✓" : "✕"} {uploadStatus.msg}
                    </p>
                  )}
                </div>
              </>
            )}
            <Field label="Tour Operator"><Combobox options={toOpts} value={form.tourOperatorId} disabled={dis("tourOperatorId")} onChange={(v) => set("tourOperatorId", v)} placeholder="Select" /></Field>
            <Field label="Market"><Combobox options={marketOpts} value={form.marketId} disabled={dis("marketId")} onChange={(v) => set("marketId", v)} placeholder="Select" /></Field>
            <Field label="Hotel Booking Status">
              <Combobox options={statusOpts} value={form.hotelStatus} disabled={dis("hotelStatus")} onChange={(v) => set("hotelStatus", v)} />
            </Field>
            <Field label="Operator Booking Status">
              <Combobox options={statusOpts} value={form.toStatus} disabled={dis("toStatus")} onChange={(v) => set("toStatus", v)} />
            </Field>
          </CardContent>
        </Card>

        {/* ── Hotel & Stay ── Resort → Hotel (cascade) → Room Type (cascade) ── */}
        <Card>
          <CardHeader><CardTitle>Hotel &amp; Stay</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Resort" className="col-span-2">
              <Combobox options={resortOpts} value={form.resortId} disabled={dis("resortId")}
                onChange={(v) => { set("resortId", v); set("hotelId", ""); setHotelLabel(""); set("hotelRoomTypeId", ""); }} placeholder="Select resort" />
            </Field>
            <Field label="Hotel Name" className="col-span-2" hint={!form.resortId ? "Choose a resort first" : undefined}>
              <AsyncCombobox
                fetcher={(q) => fetchHotelOptions(q, form.resortId || undefined)}
                value={form.hotelId}
                label={hotelLabel}
                disabled={dis("hotelId") || !form.resortId}
                onChange={(v, l) => { set("hotelId", v); setHotelLabel(l); set("hotelRoomTypeId", ""); }}
                placeholder="Search hotel…"
              />
            </Field>
            <Field label="Room Type" className="col-span-2" hint={!form.hotelId ? "Choose a hotel first" : undefined}>
              <Combobox options={roomTypes.data ?? []} value={form.hotelRoomTypeId}
                disabled={dis("hotelRoomTypeId") || !form.hotelId}
                onChange={(v) => set("hotelRoomTypeId", v)}
                placeholder={roomTypes.isLoading ? "Loading…" : "Select room type"} emptyText="No room types" />
            </Field>
            <Field label="No of Rooms"><Input type="number" min={1} max={20} value={form.numRooms} disabled={dis("numRooms")} onChange={(e) => onNumRoomsChange(e.target.value)} /></Field>
            {roomCats.map((cat, i) => (
              <Field key={i} label={roomCats.length === 1 ? "Room Occupancy" : `Room ${i + 1} Occupancy`}>
                <Combobox options={roomCatOpts} value={cat} disabled={dis("roomCategory")} onChange={(v) => onRoomCatChange(i, v)} />
              </Field>
            ))}
            <Field label="Arrival Date">
              <DateInput value={form.arrivalDate} disabled={dis("arrivalDate")} onChange={(v) => set("arrivalDate", v)} />
            </Field>
            <Field label="Departure Date">
              <DateInput value={form.departureDate} disabled={dis("departureDate")} onChange={(v) => set("departureDate", v)} />
            </Field>
            <Field label="Nights (computed)"><Input readOnly value={derived.nights} className={readOnlyCls} /></Field>
            <Field label="Meal Basis"><Combobox options={mealBasisOpts} value={form.mealBasis} disabled={dis("mealBasis")} onChange={(v) => set("mealBasis", v)} /></Field>
          </CardContent>
        </Card>

        {/* ── Guests & Occupancy ── */}
        <Card>
          <CardHeader><CardTitle>Guests &amp; Occupancy</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Adults"><Input type="number" min={0} value={form.adults} disabled={dis("adults")} onChange={(e) => set("adults", e.target.value)} /></Field>
              <Field label="Children"><Input type="number" min={0} value={form.children} disabled={dis("children")} onChange={(e) => set("children", e.target.value)} /></Field>
              <Field label="Infants"><Input type="number" min={0} value={form.infants} disabled={dis("infants")} onChange={(e) => set("infants", e.target.value)} /></Field>
            </div>

            {/* Child 1 */}
            {num(form.children) >= 1 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="1st CHD DOB">
                  <DateInput value={form.child1Dob} disabled={dis("child1Dob")} onChange={(v) => onChildDobChange(1, v)} />
                </Field>
                <Field label="1st CHD Age" hint={form.child1Dob && form.arrivalDate ? "Calculated from DOB" : undefined}>
                  <Input type="number" value={derived.child1Age != null ? String(derived.child1Age) : form.child1Age}
                    readOnly={!!form.child1Dob && !!form.arrivalDate}
                    disabled={dis("child1Age")}
                    className={form.child1Dob && form.arrivalDate ? readOnlyCls : undefined}
                    onChange={(e) => set("child1Age", e.target.value)} />
                </Field>
              </div>
            )}

            {/* Child 2 */}
            {num(form.children) >= 2 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="2nd CHD DOB">
                  <DateInput value={form.child2Dob} disabled={dis("child2Dob")} onChange={(v) => onChildDobChange(2, v)} />
                </Field>
                <Field label="2nd CHD Age" hint={form.child2Dob && form.arrivalDate ? "Calculated from DOB" : undefined}>
                  <Input type="number" value={derived.child2Age != null ? String(derived.child2Age) : form.child2Age}
                    readOnly={!!form.child2Dob && !!form.arrivalDate}
                    disabled={dis("child2Age")}
                    className={form.child2Dob && form.arrivalDate ? readOnlyCls : undefined}
                    onChange={(e) => set("child2Age", e.target.value)} />
                </Field>
              </div>
            )}

            {/* Infant */}
            {num(form.infants) >= 1 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Infant DOB">
                  <DateInput value={form.infantDob} disabled={dis("infantDob")} onChange={onInfantDobChange} />
                </Field>
                <Field label="Infant Age" hint={form.infantDob && form.arrivalDate ? "Calculated from DOB" : undefined}>
                  <Input type="number" value={derived.infantAge != null ? String(derived.infantAge) : form.infantAge}
                    readOnly={!!form.infantDob && !!form.arrivalDate}
                    disabled={dis("infantAge")}
                    className={form.infantDob && form.arrivalDate ? readOnlyCls : undefined}
                    onChange={(e) => set("infantAge", e.target.value)} />
                </Field>
              </div>
            )}

            {/* Hotel Guests — grouped by room */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hotel Guests</span>
                {!isViewer && <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addGuest("HOTEL")}><Plus className="size-3 mr-1" />Add</Button>}
              </div>
              {roomCats.map((cat, ri) => {
                const roomNum = ri + 1;
                const roomGuests = guestList.filter((g) => g.type === "HOTEL" && g.room === roomNum);
                return (
                  <div key={ri} className="rounded-md border border-border overflow-hidden">
                    <div className="flex items-center justify-between bg-secondary/40 px-3 py-1.5">
                      <span className="text-xs font-semibold text-foreground">Room {roomNum} — {cat}</span>
                    </div>
                    {roomGuests.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No guests for this room.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody>
                          {roomGuests.map((row) => {
                            const gi = guestList.indexOf(row);
                            return (
                              <tr key={gi} className="border-t border-border">
                                <td className="px-3 py-1 w-8 text-muted-foreground tabular-nums text-xs">{guestList.filter((g) => g.type === "HOTEL" && g.room === roomNum).indexOf(row) + 1}</td>
                                <td className="px-2 py-1 w-24">
                                  {isViewer ? <span className="text-sm">{row.title}</span> : (
                                    <select value={row.title} onChange={(e) => updateGuest(gi, "title", e.target.value)}
                                      className="h-7 w-20 rounded border border-input bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                                      {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  {isViewer ? <span className="text-sm">{row.name}</span> : (
                                    <Input value={row.name} onChange={(e) => updateGuest(gi, "name", e.target.value)} className="h-7 text-sm" placeholder="Full name" />
                                  )}
                                </td>
                                {!isViewer && (
                                  <td className="px-1 py-1 w-8">
                                    <button type="button" onClick={() => removeGuest(gi)} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                      <X className="size-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rebooking Guests */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rebooking Guest Names</span>
                {!isViewer && <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addGuest("REBOOK")}><Plus className="size-3 mr-1" />Add</Button>}
              </div>
              {(() => {
                const rebookRows = guestList.filter((g) => g.type === "REBOOK");
                if (rebookRows.length === 0) return <p className="text-xs text-muted-foreground py-1">No rebooked guests.</p>;
                return (
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {rebookRows.map((row) => {
                          const gi = guestList.indexOf(row);
                          return (
                            <tr key={gi} className="border-t border-border first:border-0">
                              <td className="px-3 py-1 w-8 text-muted-foreground tabular-nums text-xs">{rebookRows.indexOf(row) + 1}</td>
                              <td className="px-2 py-1 w-24">
                                {isViewer ? <span>{row.title}</span> : (
                                  <select value={row.title} onChange={(e) => updateGuest(gi, "title", e.target.value)}
                                    className="h-7 w-20 rounded border border-input bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                                    {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {isViewer ? <span>{row.name}</span> : (
                                  <Input value={row.name} onChange={(e) => updateGuest(gi, "name", e.target.value)} className="h-7 text-sm" placeholder="Full name" />
                                )}
                              </td>
                              {!isViewer && (
                                <td className="px-1 py-1 w-8">
                                  <button type="button" onClick={() => removeGuest(gi)} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                    <X className="size-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* ── Financials & Payment ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Financials &amp; Payment</CardTitle>
              {!isViewer && (
                <Button type="button" variant="outline" size="sm" onClick={openCalc}>
                  <Calculator className="size-4" /> Cost Calculation
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Booking Currency" className="col-span-2">
              <Combobox
                options={[{ value: "", label: "All currencies" }, ...currencyOpts]}
                value={form.bookingCurrency}
                disabled={dis("bookingCurrency")}
                onChange={onCurrencyChange}
                placeholder="Select currency"
              />
            </Field>

            {showUsd && <>
              <Field label={<><span>Cost USD</span><RateHistoryIcon history={rateHistory} /></>}><Input type="number" step="0.01" value={form.costUsd} disabled={dis("costUsd")} onChange={(e) => set("costUsd", e.target.value)} /></Field>
              <Field label="Selling USD"><Input type="number" step="0.01" value={form.sellingUsd} disabled={dis("sellingUsd")} onChange={(e) => set("sellingUsd", e.target.value)} /></Field>
              <Field label="P/L USD"><Input readOnly value={formatMoney(derived.plUsd, "USD")} className={readOnlyCls} /></Field>
              {form.calculationUsd && (
                <div className="col-span-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 font-mono leading-relaxed">
                  {form.calculationUsd}
                </div>
              )}
            </>}

            {showEur && <>
              <Field label={<><span>Cost EUR</span><RateHistoryIcon history={rateHistory} /></>}><Input type="number" step="0.01" value={form.costEur} disabled={dis("costEur")} onChange={(e) => set("costEur", e.target.value)} /></Field>
              <Field label="Selling EUR"><Input type="number" step="0.01" value={form.sellingEur} disabled={dis("sellingEur")} onChange={(e) => set("sellingEur", e.target.value)} /></Field>
              <Field label="P/L EUR" hint="Incl. Visa &amp; Handling"><Input readOnly value={formatMoney(derived.plEur, "EUR")} className={readOnlyCls} /></Field>
              {form.calculationEur && (
                <div className="col-span-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 font-mono leading-relaxed">
                  {form.calculationEur}
                </div>
              )}
            </>}

            {showEgp && <>
              <Field label={<><span>Cost EGP</span><RateHistoryIcon history={rateHistory} /></>}><Input type="number" step="0.01" value={form.costEgp} disabled={dis("costEgp")} onChange={(e) => set("costEgp", e.target.value)} /></Field>
              <Field label="Selling EGP"><Input type="number" step="0.01" value={form.sellingEgp} disabled={dis("sellingEgp")} onChange={(e) => set("sellingEgp", e.target.value)} /></Field>
              <Field label="P/L EGP"><Input readOnly value={formatMoney(derived.plEgp, "EGP")} className={readOnlyCls} /></Field>
              {form.calculationEgp && (
                <div className="col-span-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 font-mono leading-relaxed">
                  {form.calculationEgp}
                </div>
              )}
            </>}

            <Field label="Visa &amp; Handling"><Input type="number" step="0.01" value={form.visaHandling} disabled={dis("visaHandling")} onChange={(e) => set("visaHandling", e.target.value)} /></Field>
            <Field label="Payment Method"><Combobox options={payMethodOpts} value={form.paymentMethod} disabled={dis("paymentMethod")} onChange={(v) => set("paymentMethod", v)} /></Field>
            <Field label="Payment Option Date">
              <DateInput value={form.paymentOptionDate} disabled={dis("paymentOptionDate")} onChange={(v) => set("paymentOptionDate", v)} />
            </Field>
            {/* Has EBD checkbox */}
            <label className="col-span-2 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.hasEbd === "true"}
                disabled={isViewer}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((f) => ({
                    ...f,
                    hasEbd: checked ? "true" : "false",
                    ...(checked ? {} : { ebdPercent: "", ebdPaymentDate: "" }),
                  }));
                }}
                className="size-4 rounded border-input accent-primary"
              />
              <span className="text-sm font-medium">Has EBD (Early Booking Discount)</span>
            </label>

            {form.hasEbd === "true" && <>
              <Field label="EBD Pre Payment %"><Input type="number" step="0.1" value={form.ebdPercent} disabled={dis("ebdPercent")} onChange={(e) => set("ebdPercent", e.target.value)} placeholder="e.g. 5" /></Field>
              <Field label="EBD Pre Payment Date">
                <DateInput value={form.ebdPaymentDate} disabled={dis("ebdPaymentDate")} onChange={(v) => set("ebdPaymentDate", v)} />
              </Field>
              {showUsd && <Field label="EBD Pre Payment Amount USD"><Input readOnly value={formatMoney(derived.ebdUsd, "USD")} className={readOnlyCls} /></Field>}
              {showEur && <Field label="EBD Pre Payment Amount EUR"><Input readOnly value={formatMoney(derived.ebdEur, "EUR")} className={readOnlyCls} /></Field>}
              {showEgp && <Field label="EBD Pre Payment Amount EGP" className={!showUsd && !showEur ? "col-span-2" : ""}><Input readOnly value={formatMoney(derived.ebdEgp, "EGP")} className={readOnlyCls} /></Field>}
            </>}
          </CardContent>
        </Card>

        {/* ── Flights & Transfer ── */}
        <Card>
          <CardHeader><CardTitle>Flights &amp; Transfer</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Arrival Flight No."><Input value={form.arrFlightNo} disabled={dis("arrFlightNo")} onChange={(e) => set("arrFlightNo", e.target.value)} /></Field>
            <Field label="Arrival Flight Time"><Input value={form.arrFlightTime} disabled={dis("arrFlightTime")} onChange={(e) => set("arrFlightTime", e.target.value)} placeholder="14:30" /></Field>
            <Field label="Departure Flight No."><Input value={form.depFlightNo} disabled={dis("depFlightNo")} onChange={(e) => set("depFlightNo", e.target.value)} /></Field>
            <Field label="Departure Flight Time"><Input value={form.depFlightTime} disabled={dis("depFlightTime")} onChange={(e) => set("depFlightTime", e.target.value)} placeholder="09:10" /></Field>
            <Field label="Meet, Assist &amp; Visa" className="col-span-2"><Textarea rows={2} value={form.meetAssistVisa} disabled={dis("meetAssistVisa")} onChange={(e) => set("meetAssistVisa", e.target.value)} /></Field>
          </CardContent>
        </Card>

        {/* ── Remarks ── */}
        <Card>
          <CardHeader><CardTitle>Remarks</CardTitle></CardHeader>
          <CardContent>
            <Field label="Internal Remarks"><Textarea rows={3} value={form.remarks} disabled={dis("remarks")} onChange={(e) => set("remarks", e.target.value)} /></Field>
            <Field label="Hotel Remarks"><Textarea rows={3} value={form.hotelRemarks} disabled={dis("hotelRemarks")} onChange={(e) => set("hotelRemarks", e.target.value)} /></Field>
          </CardContent>
        </Card>
      </div>
    </form>

    {/* AI Email Import Dialog */}
    <Dialog open={aiOpen} onOpenChange={(open) => { if (!open) { setAiOpen(false); setAiFile(null); setAiResult(null); setAiError(null); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-500" />
            AI Email Import
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">Paste the operator email below. AI will extract booking details and pre-fill the form.</p>

        {!aiResult ? (
          <>
            <div
              className={`relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer min-h-[200px] p-8 ${aiDragging ? "border-primary bg-primary/5" : "border-border bg-secondary/20 hover:border-primary/40"}`}
              onDrop={(e) => {
                e.preventDefault();
                setAiDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) {
                  const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
                  if (ext === ".eml" || ext === ".msg") { setAiFile(f); setAiError(null); }
                  else setAiError("Only .eml and .msg files are supported.");
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setAiDragging(true); }}
              onDragLeave={() => setAiDragging(false)}
              onClick={() => document.getElementById("ai-email-input")?.click()}
            >
              <input
                id="ai-email-input"
                type="file"
                accept=".eml,.msg"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setAiFile(f); setAiError(null); }
                  e.target.value = "";
                }}
              />
              {aiFile ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                    <Mail className="size-5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-primary">{aiFile.name}</span>
                    <button
                      type="button"
                      className="ml-2 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setAiFile(null); }}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{(aiFile.size / 1024).toFixed(0)} KB — click Parse to extract booking details</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
                  <Mail className="size-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Drop your email file here</p>
                  <p className="text-xs text-muted-foreground">Supports .msg (Outlook) and .eml — or click to browse</p>
                </div>
              )}
            </div>
            {aiError && <p className="text-xs text-destructive">{aiError}</p>}
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setAiOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={parseEmailWithAI} disabled={aiParsing || !aiFile}>
                {aiParsing ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                {aiParsing ? "Parsing…" : "Parse Email"}
              </Button>
            </DialogFooter>
          </>
        ) : aiResult?._action === "cancelled" ? (
          <>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="size-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="size-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <p className="font-semibold text-green-700">Booking Cancelled</p>
                <p className="text-sm text-muted-foreground mt-1">{aiResult.message}</p>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => { setAiOpen(false); setAiResult(null); setAiFile(null); }}>Done</Button>
            </DialogFooter>
          </>
        ) : aiResult?._action === "cancellation_not_found" || aiResult?._action === "cancellation_no_ref" ? (
          <>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="size-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-700">Cancellation — Booking Not Found</p>
                <p className="text-sm text-muted-foreground mt-1">{aiResult.message}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => { setAiResult(null); setAiError(null); }}>← Back</Button>
              <Button size="sm" onClick={() => { setAiOpen(false); setAiResult(null); setAiFile(null); }}>Close</Button>
            </DialogFooter>
          </>
        ) : aiResult?._action === "duplicate" ? (
          <>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="size-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-700">Duplicate Booking Detected</p>
                <p className="text-sm text-muted-foreground mt-1">{aiResult.message}</p>
                {aiResult.internalRef && <p className="text-xs text-muted-foreground mt-1">Internal Ref: <span className="font-medium">{aiResult.internalRef}</span></p>}
                <p className="text-xs mt-1">Hotel Status: <span className="font-medium">{aiResult.hotelStatus}</span> · Operator Status: <span className="font-medium">{aiResult.toStatus}</span></p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => { setAiResult(null); setAiError(null); }}>← Back</Button>
              <Button size="sm" onClick={() => { setAiOpen(false); setAiResult(null); setAiFile(null); }}>Close</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {(() => {
              const r = aiResult;
              // compute operator/market match for preview
              const MARKET_HINTS: Record<string, string[]> = {
                de: ["west market", "west european", "western europe", "german"],
                nl: ["west market", "dutch", "netherlands"],
                be: ["west market", "belgian", "belgium"],
                at: ["west market", "austrian", "austria"],
                ch: ["west market", "swiss", "switzerland"],
                fr: ["french", "france"],
                gb: ["british", "uk", "united kingdom"],
                it: ["italian", "italy"],
                es: ["spanish", "spain"],
                pl: ["east european", "polish", "poland"],
                cz: ["east european", "czech"],
                ru: ["russian", "russia"],
                tr: ["turkish", "turkey"],
                eg: ["egyptian", "egypt"],
              };
              const code = String(r.marketCode ?? "").toLowerCase();
              const mHints = MARKET_HINTS[code] ?? [code];
              const marketMatch = r.marketCode ? (lookups.data?.markets as any[] ?? []).find((m: any) =>
                m.code?.toLowerCase() === code || mHints.some((h: string) => m.name?.toLowerCase().includes(h))
              ) : null;
              const opName = String(r.tourOperatorName ?? "").toLowerCase().trim();
              const opMatch = r.tourOperatorName ? (lookups.data?.tourOperators as any[] ?? []).find((m: any) => {
                const mc = (m.code ?? "").toLowerCase();
                const mn = (m.name ?? "").toLowerCase();
                return mc === opName || mn === opName || mn.includes(opName) || opName.includes(mn);
              }) : null;
              const needsManual = !r.hotelId || !r.hotelRoomTypeId || !r.resortId || !marketMatch || !opMatch;
              return (<>
              <div className="rounded-lg border divide-y text-sm max-h-[380px] overflow-y-auto">
                {r.toBookingRef && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Operator Ref</span><span className="font-medium">{r.toBookingRef}</span></div>}
                {r.tourOperatorName && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Tour Operator</span><span className={`font-medium ${opMatch ? "text-green-700" : "text-amber-700"}`}>{r.tourOperatorName}{!opMatch && <span className="font-normal text-muted-foreground ml-1">(select manually)</span>}</span></div>}
                {r.marketCode && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Market</span><span className={`font-medium ${marketMatch ? "text-green-700" : "text-amber-700"}`}>{r.marketCode}{marketMatch ? ` → ${marketMatch.name}` : <span className="font-normal text-muted-foreground ml-1">(select manually)</span>}</span></div>}
                {r.destinationCity && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Resort</span><span className={`font-medium ${r.resortId ? "text-green-700" : "text-amber-700"}`}>{r.destinationCity}{!r.resortId && <span className="font-normal text-muted-foreground ml-1">(select manually)</span>}</span></div>}
                {r.hotelName && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Hotel</span><span className={`font-medium ${r.hotelId ? "text-green-700" : "text-amber-700"}`}>{r.hotelName}{!r.hotelId && <span className="font-normal text-muted-foreground ml-1">(select manually)</span>}</span></div>}
                {r.roomTypeName && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Room Type</span><span className={`font-medium ${r.hotelRoomTypeId ? "text-green-700" : "text-amber-700"}`}>{r.roomTypeName}{!r.hotelRoomTypeId && <span className="font-normal text-muted-foreground ml-1">(select manually)</span>}</span></div>}
                {r.arrivalDate && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Arrival</span><span className="font-medium">{r.arrivalDate}</span></div>}
                {r.departureDate && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Departure</span><span className="font-medium">{r.departureDate}</span></div>}
                {r.numRooms && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Rooms</span><span className="font-medium">{r.numRooms}</span></div>}
                {r.roomCategory && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Room Category</span><span className="font-medium">{r.roomCategory}</span></div>}
                {(r.adults !== undefined) && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Pax</span><span className="font-medium">{r.adults} adults{r.children ? `, ${r.children} children` : ""}{r.infants ? `, ${r.infants} infants` : ""}</span></div>}
                {r.mealBasis && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Meal Basis</span><span className="font-medium">{r.mealBasis}</span></div>}
                {((r.sellingAmount ?? r.costAmount) && r.currency) && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Selling Price</span><span className="font-medium">{r.currency} {r.sellingAmount ?? r.costAmount}</span></div>}
                {r.guestNames?.length > 0 && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Guests</span><span className="font-medium">{r.guestNames.map((g: any) => `${g.title} ${g.name}`).join(", ")}</span></div>}
                {r.arrFlightNo && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Arr Flight</span><span className="font-medium">{r.arrFlightNo}</span></div>}
                {r.depFlightNo && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Dep Flight</span><span className="font-medium">{r.depFlightNo}</span></div>}
                {r.remarks && <div className="px-4 py-2 flex gap-3"><span className="w-36 text-muted-foreground shrink-0">Remarks</span><span className="font-medium">{r.remarks}</span></div>}
              </div>
              {needsManual && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 border border-amber-200">
                Fields shown in orange could not be matched — select manually after applying.
              </p>
              )}
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => { setAiResult(null); setAiError(null); }}>← Back</Button>
                <Button size="sm" onClick={applyAiResult}>
                  <Sparkles className="size-4" /> Apply to Form
                </Button>
              </DialogFooter>
              </>);
            })()}
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Cost Calculation Modal */}
    <Dialog open={calcOpen} onOpenChange={(open) => { if (!open) setCalcOpen(false); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" />
            Cost Calculation
          </DialogTitle>
        </DialogHeader>

        {/* Read-only context */}
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-secondary/30 px-4 py-3 text-sm">
          <div><span className="text-muted-foreground">Nights: </span><span className="font-semibold">{derived.nights}</span></div>
          <div><span className="text-muted-foreground">Children: </span><span className="font-semibold">{form.children}</span></div>
        </div>

        {/* Per-room rate rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">Room</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-16">Adults</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-16">CHD 1</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-16">CHD 2</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">PPPN DBL</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">SGL Room</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">PPPN TPL</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">01st CHD</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">02nd CHD</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28">Row Total</th>
              </tr>
            </thead>
            <tbody>
              {calcRates.map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-3 py-2 font-medium">Room {i + 1}<br /><span className="text-[10px] text-muted-foreground font-normal">{roomCats[i]}</span></td>
                  <td className="px-3 py-2 text-center tabular-nums font-semibold text-primary">{catToPax(roomCats[i] ?? "DBL")}</td>
                  {(["nChd1", "nChd2"] as const).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={r[field]}
                        onChange={(e) => {
                          const next = [...calcRates];
                          next[i] = { ...next[i], [field]: e.target.value };
                          setCalcRates(next);
                        }}
                        className="h-8 text-sm w-16 tabular-nums text-center"
                      />
                    </td>
                  ))}
                  {(["pppnDbl", "sglRoom", "pppnTpl", "chd1", "chd2"] as const).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={r[field]}
                        onChange={(e) => {
                          const next = [...calcRates];
                          next[i] = { ...next[i], [field]: e.target.value };
                          setCalcRates(next);
                        }}
                        className="h-8 text-sm w-28 tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {calcResults[i] != null && calcResults[i] !== 0
                      ? calcResults[i].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "—"
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Date Supplements */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date Supplements</p>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setDateSupps((d) => [...d, { desc: "", date: "", adultRate: "0", childRate: "0" }])}>
              <Plus className="size-3" /> Add
            </Button>
          </div>
          {dateSupps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-32">Date</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-28">Adult Rate</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-28">Child Rate</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground w-28">Row Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {dateSupps.map((s, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-2 py-1.5">
                        <Input value={s.desc} onChange={(e) => { const n = [...dateSupps]; n[i] = { ...n[i], desc: e.target.value }; setDateSupps(n); }} className="h-8 text-sm" placeholder="e.g. New Year's Eve Gala" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="date" value={s.date} onChange={(e) => { const n = [...dateSupps]; n[i] = { ...n[i], date: e.target.value }; setDateSupps(n); }} className="h-8 text-sm w-32" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" step="0.01" value={s.adultRate} onChange={(e) => { const n = [...dateSupps]; n[i] = { ...n[i], adultRate: e.target.value }; setDateSupps(n); }} className="h-8 text-sm w-28 tabular-nums" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" step="0.01" value={s.childRate} onChange={(e) => { const n = [...dateSupps]; n[i] = { ...n[i], childRate: e.target.value }; setDateSupps(n); }} className="h-8 text-sm w-28 tabular-nums" />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {dateSuppResults[i] != null && dateSuppResults[i] !== 0
                          ? dateSuppResults[i].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "—"
                        }
                      </td>
                      <td className="px-1 py-1.5">
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => { setDateSupps((d) => d.filter((_, j) => j !== i)); setDateSuppResults((d) => d.filter((_, j) => j !== i)); }}>
                          <X className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Per-Stay Supplements */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per-Stay Supplements</p>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setStaySupps((d) => [...d, { desc: "", adultRate: "0", childRate: "0" }])}>
              <Plus className="size-3" /> Add
            </Button>
          </div>
          {staySupps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-28">Adult Rate</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-28">Child Rate</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground w-28">Row Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {staySupps.map((s, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-2 py-1.5">
                        <Input value={s.desc} onChange={(e) => { const n = [...staySupps]; n[i] = { ...n[i], desc: e.target.value }; setStaySupps(n); }} className="h-8 text-sm" placeholder="e.g. Gosto Dinner" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" step="0.01" value={s.adultRate} onChange={(e) => { const n = [...staySupps]; n[i] = { ...n[i], adultRate: e.target.value }; setStaySupps(n); }} className="h-8 text-sm w-28 tabular-nums" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" step="0.01" value={s.childRate} onChange={(e) => { const n = [...staySupps]; n[i] = { ...n[i], childRate: e.target.value }; setStaySupps(n); }} className="h-8 text-sm w-28 tabular-nums" />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {staySuppResults[i] != null && staySuppResults[i] !== 0
                          ? staySuppResults[i].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "—"
                        }
                      </td>
                      <td className="px-1 py-1.5">
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => { setStaySupps((d) => d.filter((_, j) => j !== i)); setStaySuppResults((d) => d.filter((_, j) => j !== i)); }}>
                          <X className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Grand Total */}
        {(calcResults.some((v) => v !== 0) || dateSuppResults.some((v) => v !== 0) || staySuppResults.some((v) => v !== 0)) && (
          <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 flex justify-between items-center">
            <span className="text-sm font-medium">Grand Total ({form.bookingCurrency || "EUR"})</span>
            <span className="text-lg font-bold tabular-nums text-primary">
              {(
                calcResults.reduce((a, b) => a + b, 0) +
                dateSuppResults.reduce((a, b) => a + b, 0) +
                staySuppResults.reduce((a, b) => a + b, 0)
              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Room rates: (Base×Adults×Nights)+(CHD1 Rate×No.CHD1×Nights)+(CHD2 Rate×No.CHD2×Nights). Supplements: (Adult Rate×Total Adults)+(Child Rate×Total Children). Press Calculate first.
        </p>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setCalcOpen(false)}>Cancel</Button>
          <Button variant="outline" size="sm" onClick={calculateCost}>
            <Calculator className="size-4" /> Calculate
          </Button>
          {(calcResults.some((v) => v !== 0) || dateSuppResults.some((v) => v !== 0) || staySuppResults.some((v) => v !== 0)) && (
            <Button size="sm" onClick={applyCalcTotal}>
              Apply to Cost Field
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Stop Sale Conflict Dialog */}
    <Dialog open={!!stopSaleConflict} onOpenChange={(open) => { if (!open) { setStopSaleConflict(null); setPendingOverride(null); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="size-5 shrink-0" />
            Stop Sale Conflict
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The following stop sale{stopSaleConflict?.conflicts.length === 1 ? "" : "s"} overlap{stopSaleConflict?.conflicts.length === 1 ? "s" : ""} with this booking's hotel, room type, or stay dates:
        </p>
        <div className="rounded-md border divide-y text-sm">
          {stopSaleConflict?.conflicts.map((c) => (
            <div key={c.id} className="px-4 py-3 flex flex-col gap-0.5">
              <span className="font-semibold text-destructive">
                {c.qty < 0 ? "Full stop" : `${c.qty} room${c.qty !== 1 ? "s" : ""} blocked`}
                {c.roomTypeName ? ` — ${c.roomTypeName}` : " — All room types"}
              </span>
              <span className="text-muted-foreground">{c.fromDate} → {c.toDate}</span>
            </div>
          ))}
        </div>
        <p className="text-sm font-medium">You can override and save anyway, or cancel to adjust the booking.</p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => { setStopSaleConflict(null); setPendingOverride(null); }}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={overrideAndSave} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : <AlertTriangle className="size-4" />}
            Override &amp; Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

