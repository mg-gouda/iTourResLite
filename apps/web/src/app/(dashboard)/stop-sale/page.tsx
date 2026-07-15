"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { hasRole, fmtDate, type Role } from "@itour/shared";
import { get, post, patch, del, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useConfirm } from "@/components/dialog-provider";
import { fetchHotelOptions, fetchRoomTypeOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { Combobox, MultiCombobox } from "@/components/ui/combobox";
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
  createdAt: string;
  hotel?: { name?: string };
  hotelRoomType?: { name?: string } | null;
}

type Period = { qty: string; fullStop: boolean; fromDate: string; toDate: string };
const blankPeriod = (): Period => ({ qty: "1", fullStop: false, fromDate: "", toDate: "" });
const freshDraft = () => ({ id: "", hotelId: "", hotelLabel: "", hotelRoomTypeIds: [] as string[], periods: [blankPeriod()] });

export default function StopSalePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const confirm = useConfirm();
  const canEdit = hasRole((user?.role ?? "VIEWER") as Role, "MANAGER");

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(freshDraft());
  const [error, setError] = useState<string | null>(null);

  // List filters + column sort (applied client-side over the full list).
  const [hotelIdFilter, setHotelIdFilter] = useState("");
  const [hotelLabelFilter, setHotelLabelFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [sortKey, setSortKey] = useState<"fromDate" | "toDate" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const list = useQuery({ queryKey: ["stop-sales"], queryFn: () => get<StopSale[]>("/stop-sales") });

  const rows = useMemo(() => {
    const data = list.data ?? [];
    const filtered = data.filter((s) => {
      if (hotelIdFilter && s.hotelId !== hotelIdFilter) return false;
      // Overlap: keep blocks whose period intersects the selected range.
      if (fromFilter && s.toDate.slice(0, 10) < fromFilter) return false;
      if (toFilter && s.fromDate.slice(0, 10) > toFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [list.data, hotelIdFilter, fromFilter, toFilter, sortKey, sortDir]);

  function toggleSort(key: "fromDate" | "toDate" | "createdAt") {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); }
    else { setSortKey(key); setSortDir("asc"); }
  }

  const hasFilters = !!(hotelIdFilter || fromFilter || toFilter);
  function clearFilters() { setHotelIdFilter(""); setHotelLabelFilter(""); setFromFilter(""); setToFilter(""); }
  const roomTypes = useQuery({
    queryKey: ["room-types", draft.hotelId],
    enabled: !!draft.hotelId && open,
    queryFn: () => fetchRoomTypeOptions(draft.hotelId),
  });

  function openNew() { setDraft(freshDraft()); setError(null); setOpen(true); }
  function openEdit(s: StopSale) {
    setDraft({
      id: s.id, hotelId: s.hotelId, hotelLabel: s.hotel?.name ?? "",
      hotelRoomTypeIds: s.hotelRoomTypeId ? [s.hotelRoomTypeId] : [],
      periods: [{
        fullStop: s.qty < 0,
        qty: s.qty < 0 ? "1" : String(s.qty),
        fromDate: s.fromDate.slice(0, 10), toDate: s.toDate.slice(0, 10),
      }],
    });
    setError(null);
    setOpen(true);
  }

  function updatePeriod(i: number, changes: Partial<Period>) {
    setDraft((d) => ({ ...d, periods: d.periods.map((p, idx) => (idx === i ? { ...p, ...changes } : p)) }));
  }
  function addPeriod() { setDraft((d) => ({ ...d, periods: [...d.periods, blankPeriod()] })); }
  function removePeriod(i: number) { setDraft((d) => ({ ...d, periods: d.periods.filter((_, idx) => idx !== i) })); }

  async function save() {
    setError(null);
    if (!draft.hotelId) { setError("Hotel is required."); return; }
    for (let i = 0; i < draft.periods.length; i++) {
      const p = draft.periods[i];
      const prefix = draft.periods.length > 1 ? `Period ${i + 1}: ` : "";
      if (!p.fromDate || !p.toDate) { setError(`${prefix}from and to dates are required.`); return; }
      if (p.toDate < p.fromDate) { setError(`${prefix}to date must be on/after from date.`); return; }
    }
    // Empty selection = whole hotel (one null-room-type row); otherwise fan out one row per room type.
    const roomTypeTargets: (string | null)[] = draft.hotelRoomTypeIds.length ? draft.hotelRoomTypeIds : [null];
    const items = draft.periods.flatMap((p) =>
      roomTypeTargets.map((rtId) => ({
        hotelId: draft.hotelId,
        hotelRoomTypeId: rtId,
        qty: p.fullStop ? -1 : (Number(p.qty) || 1),
        fromDate: p.fromDate,
        toDate: p.toDate,
      })),
    );
    if (!draft.id && items.length > 100) {
      setError(`Too many blocks (${items.length}). Reduce room types or periods to 100 or fewer.`);
      return;
    }
    try {
      if (draft.id) await patch(`/stop-sales/${draft.id}`, items[0]);
      else await post("/stop-sales/bulk", { items });
      await qc.invalidateQueries({ queryKey: ["stop-sales"] });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    }
  }

  async function remove(id: string) {
    if (!await confirm("Delete this stop-sale block?")) return;
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

      <Card className="mb-4">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <Field label="Hotel name" hint="Search for a hotel to filter">
            <AsyncCombobox fetcher={fetchHotelOptions} value={hotelIdFilter} label={hotelLabelFilter}
              onChange={(v, l) => { setHotelIdFilter(v); setHotelLabelFilter(l); }} placeholder="Search hotel…" />
          </Field>
          <Field label="Period from" hint="Blocks active on/after this date">
            <DateInput value={fromFilter} onChange={setFromFilter} />
          </Field>
          <Field label="Period to" hint="Blocks active on/before this date">
            <DateInput value={toFilter} onChange={setToFilter} />
          </Field>
          <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasFilters}>Clear filters</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : !list.data || list.data.length === 0 ? (
            <EmptyState title="No stop-sale blocks" description={canEdit ? "Create one to remove inventory from sale." : undefined} />
          ) : rows.length === 0 ? (
            <EmptyState title="No matching blocks" description="No stop-sale blocks match the current filters." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Hotel</TH><TH>Room Type</TH><TH className="text-right">Qty</TH>
                  {([["fromDate", "From"], ["toDate", "To"], ["createdAt", "Created"]] as const).map(([key, label]) => (
                    <TH key={key}>
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        aria-label={`Sort by ${label} ${sortKey === key && sortDir === "asc" ? "descending" : "ascending"}`}
                      >
                        {label}
                        {sortKey === key && (sortDir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
                      </button>
                    </TH>
                  ))}
                  {canEdit && <TH className="text-right">Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {rows.map((s) => (
                  <TR key={s.id}>
                    <TD className="max-w-[16rem] truncate font-medium">{s.hotel?.name ?? "—"}</TD>
                    <TD className="text-muted-foreground">{s.hotelRoomType?.name ?? "All room types"}</TD>
                    <TD className="text-right tabular-nums">{s.qty < 0 ? "All" : s.qty}</TD>
                    <TD>{fmtDate(s.fromDate)}</TD>
                    <TD>{fmtDate(s.toDate)}</TD>
                    <TD className="text-muted-foreground">{s.createdAt ? fmtDate(s.createdAt) : "—"}</TD>
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
                onChange={(v, l) => setDraft((d) => ({ ...d, hotelId: v, hotelLabel: l, hotelRoomTypeIds: [] }))} placeholder="Search hotel…" />
            </Field>
            {draft.id ? (
              <Field label="Room Type (optional)" className="col-span-2" hint="Leave empty for the whole hotel">
                <Combobox options={[{ value: "", label: "All room types" }, ...(roomTypes.data ?? [])]} value={draft.hotelRoomTypeIds[0] ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, hotelRoomTypeIds: v ? [v] : [] }))} placeholder="All room types" disabled={!draft.hotelId} />
              </Field>
            ) : (
              <Field label="Room Types (optional)" className="col-span-2" hint="Leave empty to block the whole hotel; pick several to block multiple">
                <MultiCombobox options={roomTypes.data ?? []} values={draft.hotelRoomTypeIds}
                  onChange={(vs) => setDraft((d) => ({ ...d, hotelRoomTypeIds: vs }))} placeholder="All room types" disabled={!draft.hotelId} />
              </Field>
            )}
          </div>

          <div className="mt-3 space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {draft.periods.map((p, i) => (
              <div key={i} className="rounded-md border p-3">
                {!draft.id && draft.periods.length > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Period {i + 1}</span>
                    <Button variant="ghost" size="icon" aria-label="Remove period" onClick={() => removePeriod(i)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From"><DateInput value={p.fromDate} onChange={(v) => updatePeriod(i, { fromDate: v })} /></Field>
                  <Field label="To"><DateInput value={p.toDate} onChange={(v) => updatePeriod(i, { toDate: v })} /></Field>
                  <Field label="Qty (rooms)">
                    {p.fullStop ? (
                      <p className="text-sm font-semibold text-destructive py-2">Full Stop — all rooms blocked</p>
                    ) : (
                      <Input type="number" min={1} value={p.qty} onChange={(e) => updatePeriod(i, { qty: e.target.value })} />
                    )}
                  </Field>
                  <Field label="Full Stop" className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input type="checkbox" className="accent-destructive size-4" checked={p.fullStop}
                        onChange={(e) => updatePeriod(i, { fullStop: e.target.checked })} />
                      Block all rooms
                    </label>
                  </Field>
                </div>
              </div>
            ))}
          </div>

          {!draft.id && (
            <Button variant="outline" size="sm" onClick={addPeriod} className="mt-2 w-full">
              <Plus className="size-4" /> Add another period
            </Button>
          )}

          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={save}>
              {(() => {
                if (draft.id) return "Save";
                const blocks = draft.periods.length * (draft.hotelRoomTypeIds.length || 1);
                return blocks > 1 ? `Save ${blocks} blocks` : "Save";
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
