"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { get, qs } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import type { Role } from "@itour/shared";

interface AuditEntry {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}
interface Paginated<T> { data: T[]; page: number; pageSize: number; total: number; totalPages: number }

const ACTION_OPTS = [
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
];

const ENTITY_OPTS = [
  { value: "Booking", label: "Booking" },
  { value: "Hotel", label: "Hotel" },
  { value: "HotelRoomType", label: "Room Type" },
  { value: "StopSale", label: "Stop Sale" },
  { value: "User", label: "User" },
];

const ACTION_VARIANT: Record<string, string> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

function diffKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

function DiffCell({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  if (!before && !after) return <span className="text-muted-foreground">—</span>;
  if (!before) return <span className="text-xs text-emerald-400">Created</span>;
  if (!after) return <span className="text-xs text-destructive">Deleted</span>;

  const changed = diffKeys(before, after);
  if (!changed.length) return <span className="text-muted-foreground text-xs">No changes</span>;

  return (
    <div className="max-w-[28rem] space-y-0.5">
      {changed.slice(0, 5).map((k) => (
        <div key={k} className="flex items-baseline gap-1 text-xs">
          <span className="shrink-0 font-medium text-foreground/60 min-w-[6rem]">{k}</span>
          <span className="text-destructive/80 truncate max-w-[8rem]">{String(before[k] ?? "—")}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-emerald-400/90 truncate max-w-[8rem]">{String(after[k] ?? "—")}</span>
        </div>
      ))}
      {changed.length > 5 && <div className="text-xs text-muted-foreground">+{changed.length - 5} more fields</div>}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const role = (user?.role ?? "VIEWER") as Role;

  // Admin-only guard
  if (role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Shield className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Admin access required.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
      </div>
    );
  }

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const filters = { from, to, entity, action };

  const query = useQuery({
    queryKey: ["audit-log", filters, page],
    placeholderData: keepPreviousData,
    queryFn: () =>
      get<Paginated<AuditEntry>>(`/audit-log${qs({ ...filters, page, pageSize: PAGE_SIZE })}`),
  });

  function reset() { setFrom(""); setTo(""); setEntity(""); setAction(""); setPage(1); }

  const data = query.data;

  return (
    <div>
      <PageHeader title="Audit Trail" description="All create / update / delete actions — admin only." />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
          <Field label="From"><DateInput value={from} onChange={(v) => { setFrom(v); setPage(1); }} /></Field>
          <Field label="To"><DateInput value={to} onChange={(v) => { setTo(v); setPage(1); }} /></Field>
          <Field label="Entity"><Combobox options={ENTITY_OPTS} value={entity} onChange={(v) => { setEntity(v); setPage(1); }} placeholder="Any" /></Field>
          <Field label="Action"><Combobox options={ACTION_OPTS} value={action} onChange={(v) => { setAction(v); setPage(1); }} placeholder="Any" /></Field>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? <TableSkeleton rows={10} cols={6} />
            : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
            : !data?.data.length ? <EmptyState title="No audit entries" description="No actions recorded in this period." />
            : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Timestamp</TH>
                        <TH>User</TH>
                        <TH>Action</TH>
                        <TH>Entity</TH>
                        <TH>Entity ID</TH>
                        <TH>Changes</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.data.map((row) => (
                        <TR key={row.id}>
                          <TD className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(row.createdAt).toLocaleString("en-GB", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </TD>
                          <TD>
                            {row.user ? (
                              <div>
                                <p className="text-sm font-medium leading-tight">{row.user.name}</p>
                                <p className="text-xs text-muted-foreground">{row.user.email}</p>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">System</span>}
                          </TD>
                          <TD>
                            <Badge variant={ACTION_VARIANT[row.action] as any ?? "neutral"}>
                              {row.action}
                            </Badge>
                          </TD>
                          <TD className="font-medium">{row.entity}</TD>
                          <TD className="font-mono text-xs text-muted-foreground max-w-[8rem] truncate">{row.entityId}</TD>
                          <TD>
                            <DiffCell before={row.before as any} after={row.after as any} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  <span>{data.total.toLocaleString()} entries · page {data.page} of {data.totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous">
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next">
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
