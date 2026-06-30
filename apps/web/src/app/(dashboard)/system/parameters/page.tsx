"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
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
      <Tabs defaultValue="hotels">
        <TabsList>
          <TabsTrigger value="hotels">Hotels &amp; Allotment</TabsTrigger>
          <TabsTrigger value="to">Tour Operators</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="resorts">Resorts</TabsTrigger>
        </TabsList>
        <TabsContent value="hotels"><HotelsTab /></TabsContent>
        <TabsContent value="to"><LookupTab entity="tour-operators" title="Tour Operators" /></TabsContent>
        <TabsContent value="markets"><LookupTab entity="markets" title="Markets" /></TabsContent>
        <TabsContent value="resorts"><LookupTab entity="resorts" title="Resorts" /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Lookups (TO / Market / Resort) ---------------- */

interface Lookup { id: string; code: string; name: string | null; active: boolean }

function LookupTab({ entity, title }: { entity: string; title: string }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: [entity], queryFn: () => get<Lookup[]>(`/${entity}`) });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ id: "", code: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  function openNew() { setDraft({ id: "", code: "", name: "" }); setError(null); setOpen(true); }
  function openEdit(l: Lookup) { setDraft({ id: l.id, code: l.code, name: l.name ?? "" }); setError(null); setOpen(true); }

  async function save() {
    setError(null);
    if (!draft.code.trim()) { setError("Code is required."); return; }
    try {
      const payload = { code: draft.code.trim(), name: draft.name.trim() || null };
      if (draft.id) await patch(`/${entity}/${draft.id}`, payload);
      else await post(`/${entity}`, payload);
      await qc.invalidateQueries({ queryKey: [entity] });
      await qc.invalidateQueries({ queryKey: ["lookups"] });
      setOpen(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed to save."); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    try {
      await del(`/${entity}/${id}`);
      await qc.invalidateQueries({ queryKey: [entity] });
      await qc.invalidateQueries({ queryKey: ["lookups"] });
    } catch (err) { alert(err instanceof ApiError ? err.message : "Failed to delete."); }
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
              <THead><TR><TH>Code</TH><TH>Name</TH><TH className="text-right">Actions</TH></TR></THead>
              <TBody>
                {list.data.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-medium">{l.code}</TD>
                    <TD className="text-muted-foreground">{l.name ?? "—"}</TD>
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
            <Field label="Name"><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
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

interface HotelListItem { id: string; name: string; resort?: { code: string } | null; _count?: { roomTypes: number } }
interface RoomType { id: string; name: string; allocation: number }
interface HotelDetail { id: string; name: string; resortId: string | null; roomTypes: RoomType[] }

function HotelsTab() {
  const qc = useQueryClient();
  const lookups = useLookups();
  const [selected, setSelected] = useState<string | null>(null);
  const [hotelDialog, setHotelDialog] = useState(false);
  const [hotelDraft, setHotelDraft] = useState({ id: "", name: "", resortId: "" });
  const [rtDialog, setRtDialog] = useState(false);
  const [rtDraft, setRtDraft] = useState({ id: "", name: "", allocation: "0" });
  const [error, setError] = useState<string | null>(null);

  const hotels = useQuery({ queryKey: ["hotels"], queryFn: () => get<HotelListItem[]>("/hotels") });
  const detail = useQuery({
    queryKey: ["hotel", selected],
    enabled: !!selected,
    queryFn: () => get<HotelDetail>(`/hotels/${selected}`),
  });

  const resortOpts = lookupToOptions(lookups.data?.resorts);

  function newHotel() { setHotelDraft({ id: "", name: "", resortId: "" }); setError(null); setHotelDialog(true); }
  function editHotel(h: HotelDetail) { setHotelDraft({ id: h.id, name: h.name, resortId: h.resortId ?? "" }); setError(null); setHotelDialog(true); }
  async function saveHotel() {
    setError(null);
    if (!hotelDraft.name.trim()) { setError("Name is required."); return; }
    try {
      const payload = { name: hotelDraft.name.trim(), resortId: hotelDraft.resortId || null };
      if (hotelDraft.id) await patch(`/hotels/${hotelDraft.id}`, payload);
      else { const created = await post<HotelListItem>("/hotels", payload); setSelected(created.id); }
      await qc.invalidateQueries({ queryKey: ["hotels"] });
      if (hotelDraft.id) await qc.invalidateQueries({ queryKey: ["hotel", hotelDraft.id] });
      setHotelDialog(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed to save."); }
  }
  async function deleteHotel(id: string) {
    if (!confirm("Delete this hotel and its room types?")) return;
    try {
      await del(`/hotels/${id}`);
      if (selected === id) setSelected(null);
      await qc.invalidateQueries({ queryKey: ["hotels"] });
    } catch (err) { alert(err instanceof ApiError ? err.message : "Failed to delete."); }
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
    if (!confirm("Delete this room type?")) return;
    try {
      await del(`/hotels/room-types/${id}`);
      await qc.invalidateQueries({ queryKey: ["hotel", selected] });
    } catch (err) { alert(err instanceof ApiError ? err.message : "Failed to delete."); }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Hotel list */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Hotels</CardTitle>
          <Button size="sm" onClick={newHotel}><Plus className="size-4" /> Add</Button>
        </CardHeader>
        <CardContent className="p-0">
          {hotels.isLoading ? <TableSkeleton rows={8} cols={1} />
            : hotels.isError ? <ErrorState error={hotels.error} onRetry={() => hotels.refetch()} />
            : !hotels.data?.length ? <EmptyState title="No hotels" />
            : (
              <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                {hotels.data.map((h) => (
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
            )}
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
                <p className="mt-0.5 text-xs text-muted-foreground">{detail.data.roomTypes.length} room types</p>
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
