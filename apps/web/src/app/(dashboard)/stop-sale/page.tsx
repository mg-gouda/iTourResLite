"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { hasRole, type Role } from "@itour/shared";
import { get, post, patch, del, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { fetchHotelOptions, fetchRoomTypeOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Combobox } from "@/components/ui/combobox";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

interface StopSale {
  id: string;
  hotelId: string;
  hotelRoomTypeId: string | null;
  qty: number;
  fromDate: string;
  toDate: string;
  hotel?: { name?: string };
  hotelRoomType?: { name?: string } | null;
}

const blank = { id: "", hotelId: "", hotelLabel: "", hotelRoomTypeId: "", qty: "1", fromDate: "", toDate: "" };

export default function StopSalePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit = hasRole((user?.role ?? "VIEWER") as Role, "MANAGER");

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...blank });
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["stop-sales"], queryFn: () => get<StopSale[]>("/stop-sales") });
  const roomTypes = useQuery({
    queryKey: ["room-types", draft.hotelId],
    enabled: !!draft.hotelId && open,
    queryFn: () => fetchRoomTypeOptions(draft.hotelId),
  });

  function openNew() { setDraft({ ...blank }); setError(null); setOpen(true); }
  function openEdit(s: StopSale) {
    setDraft({
      id: s.id, hotelId: s.hotelId, hotelLabel: s.hotel?.name ?? "",
      hotelRoomTypeId: s.hotelRoomTypeId ?? "", qty: String(s.qty),
      fromDate: s.fromDate.slice(0, 10), toDate: s.toDate.slice(0, 10),
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    setError(null);
    if (!draft.hotelId || !draft.fromDate || !draft.toDate) { setError("Hotel, from and to dates are required."); return; }
    if (draft.toDate < draft.fromDate) { setError("To date must be on/after from date."); return; }
    const payload = {
      hotelId: draft.hotelId,
      hotelRoomTypeId: draft.hotelRoomTypeId || null,
      qty: Number(draft.qty) || 0,
      fromDate: draft.fromDate,
      toDate: draft.toDate,
    };
    try {
      if (draft.id) await patch(`/stop-sales/${draft.id}`, payload);
      else await post("/stop-sales", payload);
      await qc.invalidateQueries({ queryKey: ["stop-sales"] });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this stop-sale block?")) return;
    await del(`/stop-sales/${id}`);
    await qc.invalidateQueries({ queryKey: ["stop-sales"] });
  }

  return (
    <div>
      <PageHeader
        title="Stop Sale"
        description="Date-ranged inventory blocks per hotel / room type."
        actions={canEdit ? <Button size="sm" onClick={openNew}><Plus className="size-4" /> New block</Button> : undefined}
      />

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : !list.data || list.data.length === 0 ? (
            <EmptyState title="No stop-sale blocks" description={canEdit ? "Create one to remove inventory from sale." : undefined} />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Hotel</TH><TH>Room Type</TH><TH className="text-right">Qty</TH>
                  <TH>From</TH><TH>To</TH>{canEdit && <TH className="text-right">Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {list.data.map((s) => (
                  <TR key={s.id}>
                    <TD className="max-w-[16rem] truncate font-medium">{s.hotel?.name ?? "—"}</TD>
                    <TD className="text-muted-foreground">{s.hotelRoomType?.name ?? "All room types"}</TD>
                    <TD className="text-right tabular-nums">{s.qty < 0 ? "All" : s.qty}</TD>
                    <TD>{s.fromDate.slice(0, 10)}</TD>
                    <TD>{s.toDate.slice(0, 10)}</TD>
                    {canEdit && (
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
                        </div>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft.id ? "Edit stop-sale" : "New stop-sale"}</DialogTitle></DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hotel" className="col-span-2">
              <AsyncCombobox fetcher={fetchHotelOptions} value={draft.hotelId} label={draft.hotelLabel}
                onChange={(v, l) => setDraft((d) => ({ ...d, hotelId: v, hotelLabel: l, hotelRoomTypeId: "" }))} placeholder="Search hotel…" />
            </Field>
            <Field label="Room Type (optional)" className="col-span-2" hint="Leave empty for the whole hotel">
              <Combobox options={[{ value: "", label: "All room types" }, ...(roomTypes.data ?? [])]} value={draft.hotelRoomTypeId}
                onChange={(v) => setDraft((d) => ({ ...d, hotelRoomTypeId: v }))} placeholder="All room types" disabled={!draft.hotelId} />
            </Field>
            <Field label="Qty (rooms)"><Input type="number" value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))} /></Field>
            <div />
            <Field label="From"><Input type="date" value={draft.fromDate} onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value }))} /></Field>
            <Field label="To"><Input type="date" value={draft.toDate} onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
