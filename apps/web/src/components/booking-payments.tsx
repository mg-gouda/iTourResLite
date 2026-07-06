"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Paperclip, ExternalLink, X } from "lucide-react";
import { formatMoney, fmtDate } from "@itour/shared";
import { get, post, patch, del, API } from "@/lib/api";
import { useConfirm } from "@/components/dialog-provider";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DateInput } from "@/components/ui/date-input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

const TODAY = new Date().toISOString().slice(0, 10);

interface Opt { value: string; label: string }

interface Props {
  bookingId?: string;
  canPay: boolean;
  bookingCurrency: string; // "" | USD | EUR | EGP | GBP
  cost: { usd: number; eur: number; egp: number };
  currencyOpts: Opt[];
  payMethodOpts: Opt[];
  notify: (ok: boolean, msg: string) => void;
}

interface PayDraft {
  amount: string; currency: string; paidDate: string; method: string;
  reference: string; note: string; source: "CASH" | "CREDIT_NOTE"; creditNoteId: string;
}
interface CnDraft { amount: string; currency: string; noteDate: string; reference: string; remarks: string }

/** Booking's own-currency guess for defaulting new payment/credit-note currency. */
function ownCurrency(bookingCurrency: string, cost: Props["cost"]): string {
  const cur = (bookingCurrency || "").toUpperCase();
  if (cur === "GBP") return "USD";
  if (["USD", "EUR", "EGP"].includes(cur)) return cur;
  if (cost.usd) return "USD";
  if (cost.eur) return "EUR";
  if (cost.egp) return "EGP";
  return "USD";
}

const errMsg = (e: any) => e?.body?.message ?? e?.message ?? "Something went wrong — please try again.";

export function BookingPaymentsSection(props: Props) {
  const { bookingId, canPay, bookingCurrency, cost, currencyOpts, payMethodOpts, notify } = props;
  const qc = useQueryClient();
  const confirm = useConfirm();
  const defaultCurrency = ownCurrency(bookingCurrency, cost);

  const payments = useQuery({
    queryKey: ["booking-payments", bookingId],
    enabled: !!bookingId,
    queryFn: () => get<any>(`/bookings/${bookingId}/payments`),
  });
  const creditNotes = useQuery({
    queryKey: ["booking-credit-notes", bookingId],
    enabled: !!bookingId,
    queryFn: () => get<any>(`/bookings/${bookingId}/credit-notes`),
  });
  const availableCn = useQuery({
    queryKey: ["booking-available-cn", bookingId],
    enabled: !!bookingId,
    queryFn: () => get<any>(`/bookings/${bookingId}/available-credit-notes`),
  });

  const totals = payments.data?.totals;
  const payRows: any[] = payments.data?.payments ?? [];
  const cnRows: any[] = creditNotes.data?.creditNotes ?? [];
  const availRows: any[] = availableCn.data?.creditNotes ?? [];

  const [payForm, setPayForm] = useState<PayDraft | null>(null);
  const [payEditId, setPayEditId] = useState<string | null>(null);
  const [cnForm, setCnForm] = useState<CnDraft | null>(null);
  const [cnEditId, setCnEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const curOptions = useMemo(
    () => (currencyOpts.length ? currencyOpts : ["USD", "EUR", "EGP", "GBP"].map((c) => ({ value: c, label: c }))),
    [currencyOpts],
  );

  function refresh() {
    qc.invalidateQueries({ queryKey: ["booking-payments", bookingId] });
    qc.invalidateQueries({ queryKey: ["booking-credit-notes", bookingId] });
    qc.invalidateQueries({ queryKey: ["booking-available-cn", bookingId] });
    // Paid status on the booking itself is server-derived — refresh the header too.
    qc.invalidateQueries({ queryKey: ["booking", bookingId] });
  }

  // ── Payments ────────────────────────────────────────────────────────────

  function openAddPayment() {
    setPayEditId(null);
    setPayForm({ amount: "", currency: defaultCurrency, paidDate: TODAY, method: "", reference: "", note: "", source: "CASH", creditNoteId: "" });
  }
  function openEditPayment(p: any) {
    setPayEditId(p.id);
    setPayForm({
      amount: String(p.amount ?? ""), currency: p.currency, paidDate: p.paidDate?.slice(0, 10) ?? TODAY,
      method: p.method ?? "", reference: p.reference ?? "", note: p.note ?? "",
      source: p.source ?? "CASH", creditNoteId: p.creditNoteId ?? "",
    });
  }

  async function submitPayment() {
    if (!bookingId || !payForm) return;
    if (!payForm.amount || Number(payForm.amount) <= 0) { notify(false, "Enter a payment amount greater than zero."); return; }
    if (payForm.source === "CREDIT_NOTE" && !payForm.creditNoteId) { notify(false, "Select a credit note to redeem."); return; }
    setBusy(true);
    try {
      if (payEditId) {
        // Only descriptive fields are editable server-side.
        await patch(`/bookings/${bookingId}/payments/${payEditId}`, {
          amount: Number(payForm.amount), currency: payForm.currency, paidDate: payForm.paidDate,
          method: payForm.method || null, reference: payForm.reference || null, note: payForm.note || null,
        });
      } else {
        await post(`/bookings/${bookingId}/payments`, {
          amount: Number(payForm.amount), currency: payForm.currency, paidDate: payForm.paidDate,
          method: payForm.method || null, reference: payForm.reference || null, note: payForm.note || null,
          source: payForm.source, creditNoteId: payForm.source === "CREDIT_NOTE" ? payForm.creditNoteId : null,
        });
      }
      setPayForm(null); setPayEditId(null);
      refresh();
      notify(true, "Payment saved.");
    } catch (e: any) {
      notify(false, errMsg(e));
    } finally { setBusy(false); }
  }

  async function deletePayment(p: any) {
    if (!bookingId || !await confirm("Delete this payment?")) return;
    try { await del(`/bookings/${bookingId}/payments/${p.id}`); refresh(); notify(true, "Payment deleted."); }
    catch (e: any) { notify(false, errMsg(e)); }
  }

  // ── Credit notes ──────────────────────────────────────────────────────────

  function openAddCn() {
    setCnEditId(null);
    setCnForm({ amount: "", currency: defaultCurrency, noteDate: TODAY, reference: "", remarks: "" });
  }
  function openEditCn(cn: any) {
    setCnEditId(cn.id);
    setCnForm({ amount: String(cn.amount ?? ""), currency: cn.currency, noteDate: cn.noteDate?.slice(0, 10) ?? TODAY, reference: cn.reference ?? "", remarks: cn.remarks ?? "" });
  }

  async function submitCn() {
    if (!bookingId || !cnForm) return;
    if (!cnForm.amount || Number(cnForm.amount) <= 0) { notify(false, "Enter a credit-note amount greater than zero."); return; }
    setBusy(true);
    try {
      const body = { amount: Number(cnForm.amount), currency: cnForm.currency, noteDate: cnForm.noteDate, reference: cnForm.reference || null, remarks: cnForm.remarks || null };
      if (cnEditId) await patch(`/bookings/${bookingId}/credit-notes/${cnEditId}`, body);
      else await post(`/bookings/${bookingId}/credit-notes`, body);
      setCnForm(null); setCnEditId(null);
      refresh();
      notify(true, "Credit note saved.");
    } catch (e: any) {
      notify(false, errMsg(e));
    } finally { setBusy(false); }
  }

  async function deleteCn(cn: any) {
    if (!bookingId || !await confirm("Delete this credit note?")) return;
    try { await del(`/bookings/${bookingId}/credit-notes/${cn.id}`); refresh(); notify(true, "Credit note deleted."); }
    catch (e: any) { notify(false, errMsg(e)); }
  }

  // ── Proof upload (per payment / credit note) ──────────────────────────────

  async function uploadProof(kind: "payments" | "credit-notes", id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bookingId) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".jpeg", ".jpg", ".bmp", ".png"].includes(ext)) {
      notify(false, `File type "${ext}" is not allowed. Accepted: .pdf .jpeg .jpg .bmp .png`);
      e.target.value = ""; return;
    }
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/bookings/${bookingId}/${kind}/${id}/proof`, { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `Server error (${res.status})`);
      refresh();
      notify(true, `"${data.name}" attached.`);
    } catch (err: any) {
      notify(false, err.message ?? "Upload failed — please try again.");
    } finally { setUploadingId(null); e.target.value = ""; }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!bookingId) {
    return (
      <div className="col-span-2 rounded-md border border-border bg-secondary/20 p-3">
        <p className="text-sm font-medium">Payments &amp; Credit Notes</p>
        <p className="mt-1 text-xs text-muted-foreground">Save the booking first to record payments and credit notes.</p>
      </div>
    );
  }

  const paid = totals?.paid ?? 0;
  const balance = totals?.balance ?? 0;
  const totCost = totals?.cost ?? 0;
  const payCur = totals?.currency ?? defaultCurrency;
  const isPaid = !!totals?.isPaid;
  const statusVariant = isPaid ? "success" : paid > 0 ? "warning" : "neutral";
  const statusLabel = isPaid ? "Paid" : paid > 0 ? "Partial" : "Unpaid";

  const proofCell = (kind: "payments" | "credit-notes", row: any) => (
    <div className="flex items-center gap-1.5">
      {row.proofName && (
        <a href={`${API}/bookings/${bookingId}/${kind}/${row.id}/proof`} target="_blank" rel="noopener noreferrer"
          title={`Open ${row.proofName}`} className="inline-flex items-center text-primary hover:text-primary/80">
          <ExternalLink className="size-4" />
        </a>
      )}
      {canPay && (
        <label className="inline-flex cursor-pointer items-center text-muted-foreground hover:text-foreground" title={row.proofName ? "Replace proof" : "Attach proof"}>
          {uploadingId === row.id ? <Spinner className="size-4" /> : <Paperclip className="size-4" />}
          <input type="file" className="sr-only" accept=".pdf,.jpeg,.jpg,.bmp,.png"
            disabled={uploadingId === row.id} onChange={(e) => uploadProof(kind, row.id, e)} />
        </label>
      )}
      {!row.proofName && !canPay && <span className="text-muted-foreground">—</span>}
    </div>
  );

  return (
    <div className="col-span-2 space-y-4 rounded-md border border-border bg-secondary/20 p-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
        <span className="text-sm font-medium">Payments &amp; Credit Notes</span>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        <span className="text-xs text-muted-foreground">Cost <span className="font-semibold text-foreground tabular-nums">{formatMoney(totCost, payCur)}</span></span>
        <span className="text-xs text-muted-foreground">Paid <span className="font-semibold text-foreground tabular-nums">{formatMoney(paid, payCur)}</span></span>
        <span className="text-xs text-muted-foreground">Balance <span className={`font-semibold tabular-nums ${balance > 0.005 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{formatMoney(balance, payCur)}</span></span>
      </div>

      {/* Payments list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</span>
          {canPay && !payForm && <Button type="button" variant="outline" size="sm" onClick={openAddPayment}><Plus className="size-4" /> Add payment</Button>}
        </div>
        {payments.isLoading ? <Spinner className="size-4" /> : payRows.length === 0 && !payForm ? (
          <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60 text-left">
                  <th className="py-1 pr-3 font-medium">Date</th>
                  <th className="py-1 pr-3 text-right font-medium">Amount</th>
                  <th className="py-1 pr-3 font-medium">Source</th>
                  <th className="py-1 pr-3 font-medium">Method</th>
                  <th className="py-1 pr-3 font-medium">Reference</th>
                  <th className="py-1 pr-3 font-medium">Note</th>
                  <th className="py-1 pr-3 font-medium">Proof</th>
                  {canPay && <th className="py-1 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {payRows.map((p) => (
                  <tr key={p.id} className="border-b border-border/40">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(p.paidDate)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{formatMoney(p.amount, p.currency)}</td>
                    <td className="py-1.5 pr-3">{p.source === "CREDIT_NOTE" ? <Badge variant="violet">Credit note</Badge> : <span className="text-muted-foreground">Cash</span>}</td>
                    <td className="py-1.5 pr-3">{p.method || "—"}</td>
                    <td className="py-1.5 pr-3">{p.reference || "—"}</td>
                    <td className="py-1.5 pr-3 max-w-[10rem] truncate" title={p.note || ""}>{p.note || "—"}</td>
                    <td className="py-1.5 pr-3">{proofCell("payments", p)}</td>
                    {canPay && (
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => openEditPayment(p)} title="Edit" className="text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                          <button type="button" onClick={() => deletePayment(p)} title="Delete" className="text-muted-foreground hover:text-red-500"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add / edit payment form */}
        {payForm && (
          <div className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">{payEditId ? "Edit payment" : "New payment"}</span>
              <button type="button" onClick={() => { setPayForm(null); setPayEditId(null); }} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {!payEditId && (
                <Field label="Source">
                  <Combobox
                    options={[{ value: "CASH", label: "Cash / bank" }, { value: "CREDIT_NOTE", label: "Redeem credit note" }]}
                    value={payForm.source}
                    onChange={(v) => setPayForm((f) => f && ({ ...f, source: v as PayDraft["source"], creditNoteId: "" }))}
                  />
                </Field>
              )}
              {!payEditId && payForm.source === "CREDIT_NOTE" && (
                <Field label="Credit note" className="col-span-2">
                  <Combobox
                    placeholder={availRows.length ? "Select credit note" : "None available at this hotel"}
                    options={availRows.map((cn) => ({ value: cn.id, label: `${cn.reference || "Credit note"} · ${formatMoney(cn.remaining, cn.currency)} left${cn.booking?.toBookingRef ? ` · from ${cn.booking.toBookingRef}` : ""}` }))}
                    value={payForm.creditNoteId}
                    onChange={(v) => {
                      const cn = availRows.find((c) => c.id === v);
                      setPayForm((f) => f && ({ ...f, creditNoteId: v, currency: cn?.currency ?? f.currency }));
                    }}
                  />
                </Field>
              )}
              <Field label="Amount"><Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((f) => f && ({ ...f, amount: e.target.value }))} /></Field>
              <Field label="Currency">
                <Combobox options={curOptions} value={payForm.currency}
                  disabled={!payEditId && payForm.source === "CREDIT_NOTE"}
                  onChange={(v) => setPayForm((f) => f && ({ ...f, currency: v }))} />
              </Field>
              <Field label="Paid date"><DateInput value={payForm.paidDate} onChange={(v) => setPayForm((f) => f && ({ ...f, paidDate: v }))} /></Field>
              <Field label="Method">
                <Combobox options={[{ value: "", label: "—" }, ...payMethodOpts]} value={payForm.method} onChange={(v) => setPayForm((f) => f && ({ ...f, method: v }))} />
              </Field>
              <Field label="Reference"><Input value={payForm.reference} onChange={(e) => setPayForm((f) => f && ({ ...f, reference: e.target.value }))} /></Field>
              <Field label="Note" className="col-span-2 sm:col-span-1"><Input value={payForm.note} onChange={(e) => setPayForm((f) => f && ({ ...f, note: e.target.value }))} /></Field>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPayForm(null); setPayEditId(null); }}>Cancel</Button>
              <Button type="button" size="sm" onClick={submitPayment} disabled={busy}>{busy ? <Spinner className="size-4" /> : "Save payment"}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Credit notes list */}
      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit Notes held at this hotel</span>
          {canPay && !cnForm && <Button type="button" variant="outline" size="sm" onClick={openAddCn}><Plus className="size-4" /> Add credit note</Button>}
        </div>
        {creditNotes.isLoading ? <Spinner className="size-4" /> : cnRows.length === 0 && !cnForm ? (
          <p className="text-xs text-muted-foreground">No credit notes recorded for this booking.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60 text-left">
                  <th className="py-1 pr-3 font-medium">Date</th>
                  <th className="py-1 pr-3 text-right font-medium">Amount</th>
                  <th className="py-1 pr-3 text-right font-medium">Redeemed</th>
                  <th className="py-1 pr-3 text-right font-medium">Remaining</th>
                  <th className="py-1 pr-3 font-medium">Reference</th>
                  <th className="py-1 pr-3 font-medium">Remarks</th>
                  <th className="py-1 pr-3 font-medium">Proof</th>
                  {canPay && <th className="py-1 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {cnRows.map((cn) => (
                  <tr key={cn.id} className="border-b border-border/40">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(cn.noteDate)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{formatMoney(cn.amount, cn.currency)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{formatMoney(cn.redeemed, cn.currency)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400">{formatMoney(cn.remaining, cn.currency)}</td>
                    <td className="py-1.5 pr-3">{cn.reference || "—"}</td>
                    <td className="py-1.5 pr-3 max-w-[10rem] truncate" title={cn.remarks || ""}>{cn.remarks || "—"}</td>
                    <td className="py-1.5 pr-3">{proofCell("credit-notes", cn)}</td>
                    {canPay && (
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => openEditCn(cn)} title="Edit" className="text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                          <button type="button" onClick={() => deleteCn(cn)} title="Delete" className="text-muted-foreground hover:text-red-500"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add / edit credit note form */}
        {cnForm && (
          <div className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">{cnEditId ? "Edit credit note" : "New credit note"}</span>
              <button type="button" onClick={() => { setCnForm(null); setCnEditId(null); }} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="Amount"><Input type="number" step="0.01" value={cnForm.amount} onChange={(e) => setCnForm((f) => f && ({ ...f, amount: e.target.value }))} /></Field>
              <Field label="Currency">
                <Combobox options={curOptions} value={cnForm.currency} onChange={(v) => setCnForm((f) => f && ({ ...f, currency: v }))} />
              </Field>
              <Field label="Note date"><DateInput value={cnForm.noteDate} onChange={(v) => setCnForm((f) => f && ({ ...f, noteDate: v }))} /></Field>
              <Field label="Reference"><Input value={cnForm.reference} onChange={(e) => setCnForm((f) => f && ({ ...f, reference: e.target.value }))} /></Field>
              <Field label="Remarks" className="col-span-2"><Input value={cnForm.remarks} onChange={(e) => setCnForm((f) => f && ({ ...f, remarks: e.target.value }))} /></Field>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCnForm(null); setCnEditId(null); }}>Cancel</Button>
              <Button type="button" size="sm" onClick={submitCn} disabled={busy}>{busy ? <Spinner className="size-4" /> : "Save credit note"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
