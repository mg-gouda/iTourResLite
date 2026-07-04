"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfirm, useAlert } from "@/components/dialog-provider";
import { Plus, Pencil, Trash2, ChevronRight, Eye, EyeOff, Search } from "lucide-react";
import { get, post, patch, del, ApiError } from "@/lib/api";
import { useLookups, lookupToOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function SystemParametersPage() {
  return (
    <div>
      <PageHeader title="System Parameters" description="Master / reference data — admin only." />
      <Tabs defaultValue="hotels" orientation="vertical" className="flex items-start gap-4">
        <TabsList className="h-auto w-48 shrink-0 flex-col justify-start rounded-md p-1">
          <TabsTrigger value="hotels" className="w-full justify-start">Hotels &amp; Allotment</TabsTrigger>
          <TabsTrigger value="to" className="w-full justify-start">Tour Operators</TabsTrigger>
          <TabsTrigger value="markets" className="w-full justify-start">Markets</TabsTrigger>
          <TabsTrigger value="resorts" className="w-full justify-start">Resorts</TabsTrigger>
          <TabsTrigger value="statuses" className="w-full justify-start">Booking Statuses</TabsTrigger>
          <TabsTrigger value="roomcats" className="w-full justify-start">Room Categories</TabsTrigger>
          <TabsTrigger value="mealbases" className="w-full justify-start">Meal Bases</TabsTrigger>
          <TabsTrigger value="paymethods" className="w-full justify-start">Payment Methods</TabsTrigger>
          <TabsTrigger value="currencies" className="w-full justify-start">Currencies</TabsTrigger>
          <TabsTrigger value="spos" className="w-full justify-start">SPO</TabsTrigger>
          <TabsTrigger value="company" className="w-full justify-start">Company</TabsTrigger>
          <TabsTrigger value="email" className="w-full justify-start">Email Settings</TabsTrigger>
        </TabsList>
        <div className="min-w-0 flex-1">
          <TabsContent value="hotels" className="mt-0"><HotelsTab /></TabsContent>
          <TabsContent value="to" className="mt-0"><LookupTab entity="tour-operators" title="Tour Operators" /></TabsContent>
          <TabsContent value="markets" className="mt-0"><LookupTab entity="markets" title="Markets" /></TabsContent>
          <TabsContent value="resorts" className="mt-0"><LookupTab entity="resorts" title="Resorts" /></TabsContent>
          <TabsContent value="statuses" className="mt-0"><LookupTab entity="params/booking-statuses" title="Booking Statuses" hasLabel /></TabsContent>
          <TabsContent value="roomcats" className="mt-0"><LookupTab entity="params/room-categories" title="Room Categories" hasLabel /></TabsContent>
          <TabsContent value="mealbases" className="mt-0"><LookupTab entity="params/meal-bases" title="Meal Bases" hasLabel /></TabsContent>
          <TabsContent value="paymethods" className="mt-0"><LookupTab entity="params/payment-methods" title="Payment Methods" hasLabel /></TabsContent>
          <TabsContent value="currencies" className="mt-0"><LookupTab entity="params/currencies" title="Currencies" hasLabel /></TabsContent>
          <TabsContent value="spos" className="mt-0"><LookupTab entity="params/spos" title="SPO" hasLabel /></TabsContent>
          <TabsContent value="company" className="mt-0"><CompanyTab /></TabsContent>
          <TabsContent value="email" className="mt-0"><EmailSettingsTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ---------------- Lookups (TO / Market / Resort) ---------------- */

interface Lookup { id: string; code: string; name?: string | null; label?: string | null; active: boolean; sortOrder?: number }

function LookupTab({ entity, title, hasLabel }: { entity: string; title: string; hasLabel?: boolean }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const list = useQuery({ queryKey: [entity], queryFn: () => get<Lookup[]>(`/${entity}`) });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ id: "", code: "", name: "", label: "", sortOrder: "0" });
  const [error, setError] = useState<string | null>(null);

  function openNew() { setDraft({ id: "", code: "", name: "", label: "", sortOrder: "0" }); setError(null); setOpen(true); }
  function openEdit(l: Lookup) {
    setDraft({ id: l.id, code: l.code, name: l.name ?? "", label: l.label ?? "", sortOrder: String(l.sortOrder ?? 0) });
    setError(null); setOpen(true);
  }

  async function save() {
    setError(null);
    if (!draft.code.trim()) { setError("Code is required."); return; }
    try {
      const payload: Record<string, unknown> = { code: draft.code.trim(), active: true };
      if (hasLabel) {
        payload.label = draft.label.trim() || null;
        payload.sortOrder = Number(draft.sortOrder) || 0;
      } else {
        payload.name = draft.name.trim() || null;
      }
      if (draft.id) await patch(`/${entity}/${draft.id}`, payload);
      else await post(`/${entity}`, payload);
      await qc.invalidateQueries({ queryKey: [entity] });
      await qc.invalidateQueries({ queryKey: ["lookups"] });
      setOpen(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed to save."); }
  }
  async function remove(id: string) {
    if (!await confirm("Delete this entry?")) return;
    try {
      await del(`/${entity}/${id}`);
      await qc.invalidateQueries({ queryKey: [entity] });
      await qc.invalidateQueries({ queryKey: ["lookups"] });
    } catch (err) { await showAlert(err instanceof ApiError ? err.message : "Failed to delete."); }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> Add</Button>
      </CardHeader>
      <CardContent className="p-0">
        {list.isLoading ? <TableSkeleton rows={5} cols={3} />
          : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} />
          : !list.data?.length ? <EmptyState title="No entries" />
          : (
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>{hasLabel ? "Label" : "Name"}</TH>
                  {hasLabel && <TH className="text-right">Order</TH>}
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {list.data.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-medium">{l.code}</TD>
                    <TD className="text-muted-foreground">{hasLabel ? (l.label ?? "—") : (l.name ?? "—")}</TD>
                    {hasLabel && <TD className="text-right tabular-nums text-muted-foreground">{l.sortOrder ?? 0}</TD>}
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(l)}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(l.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft.id ? "Edit" : "Add"} — {title}</DialogTitle></DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid gap-3">
            <Field label="Code"><Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} /></Field>
            {hasLabel ? (
              <>
                <Field label="Display Label"><Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} /></Field>
                <Field label="Sort Order"><Input type="number" value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} /></Field>
              </>
            ) : (
              <Field label="Name"><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Hotels & Allotment ---------------- */

interface HotelListItem { id: string; name: string; email?: string | null; resort?: { code: string } | null; _count?: { roomTypes: number } }
interface RoomType { id: string; name: string; allocation: number }
interface HotelDetail { id: string; name: string; email?: string | null; resortId: string | null; roomTypes: RoomType[] }

function HotelsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const lookups = useLookups();
  const [selected, setSelected] = useState<string | null>(null);
  const [hotelDialog, setHotelDialog] = useState(false);
  const [hotelDraft, setHotelDraft] = useState({ id: "", name: "", email: "", resortId: "" });
  const [rtDialog, setRtDialog] = useState(false);
  const [rtDraft, setRtDraft] = useState({ id: "", name: "", allocation: "0" });
  const [error, setError] = useState<string | null>(null);

  const [hotelSearch, setHotelSearch] = useState("");
  const hotels = useQuery({ queryKey: ["hotels"], queryFn: () => get<HotelListItem[]>("/hotels") });
  const detail = useQuery({
    queryKey: ["hotel", selected],
    enabled: !!selected,
    queryFn: () => get<HotelDetail>(`/hotels/${selected}`),
  });

  const resortOpts = lookupToOptions(lookups.data?.resorts);

  function newHotel() { setHotelDraft({ id: "", name: "", email: "", resortId: "" }); setError(null); setHotelDialog(true); }
  function editHotel(h: HotelDetail) { setHotelDraft({ id: h.id, name: h.name, email: h.email ?? "", resortId: h.resortId ?? "" }); setError(null); setHotelDialog(true); }
  async function saveHotel() {
    setError(null);
    if (!hotelDraft.name.trim()) { setError("Name is required."); return; }
    try {
      const payload = { name: hotelDraft.name.trim(), email: hotelDraft.email.trim() || null, resortId: hotelDraft.resortId || null };
      if (hotelDraft.id) await patch(`/hotels/${hotelDraft.id}`, payload);
      else { const created = await post<HotelListItem>("/hotels", payload); setSelected(created.id); }
      await qc.invalidateQueries({ queryKey: ["hotels"] });
      if (hotelDraft.id) await qc.invalidateQueries({ queryKey: ["hotel", hotelDraft.id] });
      setHotelDialog(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed to save."); }
  }
  async function deleteHotel(id: string) {
    if (!await confirm("Delete this hotel and its room types?")) return;
    try {
      await del(`/hotels/${id}`);
      if (selected === id) setSelected(null);
      await qc.invalidateQueries({ queryKey: ["hotels"] });
    } catch (err) { await showAlert(err instanceof ApiError ? err.message : "Failed to delete."); }
  }

  function newRt() { setRtDraft({ id: "", name: "", allocation: "0" }); setError(null); setRtDialog(true); }
  function editRt(rt: RoomType) { setRtDraft({ id: rt.id, name: rt.name, allocation: String(rt.allocation) }); setError(null); setRtDialog(true); }
  async function saveRt() {
    setError(null);
    if (!selected || !rtDraft.name.trim()) { setError("Name is required."); return; }
    try {
      const payload = { name: rtDraft.name.trim(), allocation: Number(rtDraft.allocation) || 0 };
      if (rtDraft.id) await patch(`/hotels/room-types/${rtDraft.id}`, payload);
      else await post(`/hotels/${selected}/room-types`, payload);
      await qc.invalidateQueries({ queryKey: ["hotel", selected] });
      setRtDialog(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed to save."); }
  }
  async function deleteRt(id: string) {
    if (!await confirm("Delete this room type?")) return;
    try {
      await del(`/hotels/room-types/${id}`);
      await qc.invalidateQueries({ queryKey: ["hotel", selected] });
    } catch (err) { await showAlert(err instanceof ApiError ? err.message : "Failed to delete."); }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Hotel list */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Hotels</CardTitle>
          <Button size="sm" onClick={newHotel}><Plus className="size-4" /> Add</Button>
        </CardHeader>
        <div className="border-b border-border px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={hotelSearch}
              onChange={(e) => setHotelSearch(e.target.value)}
              placeholder="Search hotels…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <CardContent className="p-0">
          {hotels.isLoading ? <TableSkeleton rows={8} cols={1} />
            : hotels.isError ? <ErrorState error={hotels.error} onRetry={() => hotels.refetch()} />
            : !hotels.data?.length ? <EmptyState title="No hotels" />
            : (() => {
                const filtered = hotels.data.filter((h) =>
                  h.name.toLowerCase().includes(hotelSearch.toLowerCase()),
                );
                return filtered.length === 0 ? (
                  <EmptyState title="No matches" />
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                    {filtered.map((h) => (
                      <button key={h.id} onClick={() => setSelected(h.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/50",
                          selected === h.id && "bg-primary/10 text-primary",
                        )}>
                        <span className="min-w-0 truncate">{h.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {h._count?.roomTypes ?? 0} RT <ChevronRight className="size-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
        </CardContent>
      </Card>

      {/* Room types for selected hotel */}
      <Card>
        {!selected ? (
          <CardContent><EmptyState title="Select a hotel" description="Pick a hotel to manage its room types and allocations." /></CardContent>
        ) : detail.isLoading ? (
          <CardContent><TableSkeleton rows={5} cols={3} /></CardContent>
        ) : detail.isError ? (
          <CardContent><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></CardContent>
        ) : detail.data ? (
          <>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{detail.data.name}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {detail.data.roomTypes.length} room types
                  {detail.data.email && <> · <span className="text-primary/80">{detail.data.email}</span></>}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => editHotel(detail.data!)}><Pencil className="size-4" /> Edit hotel</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteHotel(detail.data!.id)}><Trash2 className="size-4" /></Button>
                <Button size="sm" onClick={newRt}><Plus className="size-4" /> Room type</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {detail.data.roomTypes.length === 0 ? (
                <EmptyState title="No room types" description="Add the hotel's contracted room products and daily allocation." />
              ) : (
                <Table>
                  <THead><TR><TH>Room Type</TH><TH className="text-right">Allocation / day</TH><TH className="text-right">Actions</TH></TR></THead>
                  <TBody>
                    {detail.data.roomTypes.map((rt) => (
                      <TR key={rt.id}>
                        <TD className="font-medium">{rt.name}</TD>
                        <TD className="text-right tabular-nums">{rt.allocation}</TD>
                        <TD className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => editRt(rt)}><Pencil className="size-4" /></Button>
                            <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => deleteRt(rt.id)}><Trash2 className="size-4 text-destructive" /></Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </>
        ) : null}
      </Card>

      {/* Hotel dialog */}
      <Dialog open={hotelDialog} onOpenChange={setHotelDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{hotelDraft.id ? "Edit hotel" : "New hotel"}</DialogTitle></DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid gap-3">
            <Field label="Hotel name"><Input value={hotelDraft.name} onChange={(e) => setHotelDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
            <Field label="Hotel Email" hint="Used for Send to Hotel mailto link">
              <Input type="email" value={hotelDraft.email} placeholder="reservations@hotel.com" onChange={(e) => setHotelDraft((d) => ({ ...d, email: e.target.value }))} />
            </Field>
            <Field label="Resort"><Combobox options={[{ value: "", label: "— None —" }, ...resortOpts]} value={hotelDraft.resortId} onChange={(v) => setHotelDraft((d) => ({ ...d, resortId: v }))} placeholder="Select resort" /></Field>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={saveHotel}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room type dialog */}
      <Dialog open={rtDialog} onOpenChange={setRtDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{rtDraft.id ? "Edit room type" : "New room type"}</DialogTitle></DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2"><Input value={rtDraft.name} onChange={(e) => setRtDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
            <Field label="Allocation / day"><Input type="number" min={0} value={rtDraft.allocation} onChange={(e) => setRtDraft((d) => ({ ...d, allocation: e.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={saveRt}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Email Settings Tab ---------------- */

const SMTP_KEYS = ["smtpHost","smtpPort","smtpSecure","smtpUser","smtpPass","smtpFrom","smtpFromName"] as const;
type SmtpKey = typeof SMTP_KEYS[number];
const SMTP_DEFAULTS: Record<SmtpKey, string> = { smtpHost:"", smtpPort:"587", smtpSecure:"false", smtpUser:"", smtpPass:"", smtpFrom:"", smtpFromName:"" };

const PROVIDERS: { label: string; host: string; port: string; secure: string; note?: string }[] = [
  { label: "Custom", host: "", port: "587", secure: "false" },
  { label: "Gmail", host: "smtp.gmail.com", port: "587", secure: "false", note: "Use an App Password (Google Account → Security → App passwords)" },
  { label: "Outlook / Office 365", host: "smtp.office365.com", port: "587", secure: "false" },
  { label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: "587", secure: "false", note: "Use an App Password from Yahoo Account Security settings" },
];

function EmailSettingsTab() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ["system-config"], queryFn: () => get<Record<string, string>>("/system-config") });
  const [form, setForm] = useState<Record<SmtpKey, string>>(SMTP_DEFAULTS);
  const [seeded, setSeeded] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | undefined>(undefined);

  if (cfg.isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (cfg.isError)   return <div className="p-4 text-sm text-destructive">Failed to load config.</div>;

  if (!seeded && cfg.data) {
    setForm({ ...SMTP_DEFAULTS, ...Object.fromEntries(SMTP_KEYS.map((k) => [k, cfg.data![k] ?? SMTP_DEFAULTS[k]])) } as Record<SmtpKey,string>);
    setSeeded(true);
  }

  const field = (k: SmtpKey) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function applyProvider(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = PROVIDERS.find((x) => x.label === e.target.value);
    if (!p) return;
    setForm((f) => ({ ...f, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }));
    setProviderNote(p.note);
  }

  async function save() {
    setError(null); setSaved(false);
    try {
      await patch("/system-config", form);
      qc.invalidateQueries({ queryKey: ["system-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message ?? "Save failed."); }
  }

  const configured = !!form.smtpHost;

  return (
    <Card className="mt-4 max-w-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Email Settings (SMTP)
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${configured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {configured ? "Configured" : "Not configured"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">

        {/* Provider preset */}
        <Field label="Email Provider" className="col-span-2">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="Custom" onChange={applyProvider}>
            {PROVIDERS.map((p) => <option key={p.label}>{p.label}</option>)}
          </select>
        </Field>
        {providerNote && (
          <p className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            {providerNote}
          </p>
        )}

        <Field label="SMTP Host" className="col-span-2">
          <Input value={form.smtpHost} onChange={field("smtpHost")} placeholder="smtp.example.com" />
        </Field>
        <Field label="SMTP Port">
          <Input type="number" value={form.smtpPort} onChange={field("smtpPort")} placeholder="587" />
        </Field>
        <Field label="Encryption" className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" className="accent-primary" checked={form.smtpSecure === "true"}
              onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked ? "true" : "false" }))} />
            SSL/TLS — only for port 465
          </label>
        </Field>
        <Field label="Username / Email" className="col-span-2">
          <Input value={form.smtpUser} onChange={field("smtpUser")} placeholder="your@email.com" autoComplete="off" />
        </Field>
        <Field label="Password" className="col-span-2">
          <div className="relative">
            <Input type={showPass ? "text" : "password"} value={form.smtpPass} onChange={field("smtpPass")}
              placeholder="••••••••" autoComplete="new-password" className="pr-10" />
            <button type="button" onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field label="From Email" className="col-span-2">
          <Input value={form.smtpFrom} onChange={field("smtpFrom")} placeholder="reservations@example.com" />
        </Field>
        <Field label="From Name" className="col-span-2">
          <Input value={form.smtpFromName} onChange={field("smtpFromName")} placeholder="Fulvago Travel Reservations" />
        </Field>

        {error && <p className="col-span-2 text-xs text-destructive">{error}</p>}
        {saved && <p className="col-span-2 text-xs text-green-600">Saved successfully.</p>}
        <div className="col-span-2">
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Company Settings Tab ---------------- */

function CompanyTab() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ["system-config"], queryFn: () => get<Record<string, string>>("/system-config") });
  const [companyName, setCompanyName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoData, setLogoData] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cfg.isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (cfg.isError)   return <div className="p-4 text-sm text-destructive">Failed to load config.</div>;

  const serverName = cfg.data?.companyName ?? "";
  const serverLogo = cfg.data?.companyLogo ?? null;
  const displayName = companyName || serverName;
  const displayLogo = logoPreview ?? serverLogo;

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { setError("Logo must be under 500 KB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setLogoData(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setError(null); setSaved(false);
    try {
      const payload: Record<string, string> = { companyName: displayName.trim() };
      if (logoData) payload.companyLogo = logoData;
      await patch("/system-config", payload);
      qc.invalidateQueries({ queryKey: ["system-config"] });
      setSaved(true); setLogoData(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message ?? "Save failed."); }
  }

  async function removeLogo() {
    try {
      await patch("/system-config", { companyLogo: "" });
      qc.invalidateQueries({ queryKey: ["system-config"] });
      setLogoPreview(null); setLogoData(null);
    } catch (e: any) { setError(e.message ?? "Failed to remove logo."); }
  }

  return (
    <Card className="mt-4 max-w-md">
      <CardHeader><CardTitle className="text-base">Company Settings</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label="Company Name">
          <Input value={displayName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Fulvago Travel" />
        </Field>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Company Logo <span className="text-xs text-muted-foreground">(used in report headers — PNG/JPG/SVG, max 500 KB)</span></label>
          {displayLogo ? (
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-40 items-center justify-center rounded-md border border-border bg-secondary/40 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayLogo} alt="Company logo" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                  Replace
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={onLogoChange} />
                </label>
                <button onClick={removeLogo} className="rounded-md px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-secondary/30 text-xs text-muted-foreground hover:bg-secondary/50">
              <span className="font-medium">Click to upload logo</span>
              <span>PNG, JPG or SVG</span>
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={onLogoChange} />
            </label>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {saved && <p className="text-xs text-green-600">Saved successfully.</p>}
        <Button size="sm" className="self-start" onClick={save}>Save</Button>
      </CardContent>
    </Card>
  );
}
