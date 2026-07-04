"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, KeyRound, Power, ShieldCheck, RotateCcw, Check, X, Trash2 } from "lucide-react";
import {
  ROLES, fmtDate, type Role,
  PERMISSION_GROUPS, PERMISSION_LABELS, DEFAULT_MATRIX,
  type Permission,
} from "@itour/shared";
import { get, post, patch, put, del, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useConfirm } from "@/components/dialog-provider";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Combobox, enumOptions } from "@/components/ui/combobox";
import { Badge, roleVariant } from "@/components/ui/badge";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const list = useQuery({ queryKey: ["users"], queryFn: () => get<UserRow[]>("/users") });

  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState({ email: "", name: "", role: "VIEWER" as Role, password: "" });
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [permUser, setPermUser] = useState<UserRow | null>(null);

  async function doCreate() {
    setError(null);
    try {
      await post("/users", create);
      await qc.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      setCreate({ email: "", name: "", role: "VIEWER", password: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user.");
    }
  }

  async function changeRole(u: UserRow, role: Role) {
    await patch(`/users/${u.id}`, { role });
    await qc.invalidateQueries({ queryKey: ["users"] });
  }

  async function toggleActive(u: UserRow) {
    if (u.active) {
      await del(`/users/${u.id}`);
    } else {
      await patch(`/users/${u.id}`, { active: true });
    }
    await qc.invalidateQueries({ queryKey: ["users"] });
  }

  async function hardDelete(u: UserRow) {
    setError(null);
    const ok = await confirm(
      `Permanently delete ${u.name} (${u.email})? This cannot be undone. Their bookings and audit history are kept but detached from this account.`,
    );
    if (!ok) return;
    try {
      await del(`/users/${u.id}/hard`);
      await qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user.");
    }
  }

  async function doReset() {
    if (!resetFor) return;
    setError(null);
    try {
      await post(`/users/${resetFor.id}/reset-password`, { password: newPassword });
      setResetFor(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage accounts, roles, access and per-user permission overrides."
        actions={<Button size="sm" onClick={() => { setError(null); setCreateOpen(true); }}><Plus className="size-4" /> New user</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : !list.data || list.data.length === 0 ? (
            <EmptyState title="No users" />
          ) : (
            <Table>
              <THead>
                <TR><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Last login</TH><TH>Status</TH><TH className="text-right">Actions</TH></TR>
              </THead>
              <TBody>
                {list.data.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-medium">{u.name}</TD>
                    <TD className="text-muted-foreground">{u.email}</TD>
                    <TD>
                      <div className="w-40">
                        <Combobox options={enumOptions(ROLES)} value={u.role} onChange={(v) => changeRole(u, v as Role)} />
                      </div>
                    </TD>
                    <TD className="text-muted-foreground">{fmtDate(u.lastLoginAt)}</TD>
                    <TD>{u.active ? <Badge variant="success">Active</Badge> : <Badge variant="zinc">Inactive</Badge>}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Per-user permissions" title="Manage permissions" onClick={() => { setError(null); setPermUser(u); }}>
                          <ShieldCheck className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Reset password" onClick={() => { setError(null); setResetFor(u); }}>
                          <KeyRound className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Toggle active" onClick={() => toggleActive(u)}>
                          <Power className={u.active ? "size-4 text-destructive" : "size-4 text-emerald-400"} />
                        </Button>
                        {u.id !== me?.id && (
                          <Button variant="ghost" size="icon" aria-label="Delete user permanently" title="Delete permanently" onClick={() => hardDelete(u)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New user</DialogTitle></DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2"><Input value={create.name} onChange={(e) => setCreate((c) => ({ ...c, name: e.target.value }))} /></Field>
            <Field label="Email" className="col-span-2"><Input type="email" value={create.email} onChange={(e) => setCreate((c) => ({ ...c, email: e.target.value }))} /></Field>
            <Field label="Role"><Combobox options={enumOptions(ROLES)} value={create.role} onChange={(v) => setCreate((c) => ({ ...c, role: v as Role }))} /></Field>
            <Field label="Password" hint="Min 8 characters"><Input type="password" value={create.password} onChange={(e) => setCreate((c) => ({ ...c, password: e.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={doCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password — {resetFor?.name}</DialogTitle></DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Field label="New password" hint="Min 8 characters">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={doReset}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-user permission overrides */}
      {permUser && (
        <UserPermDialog user={permUser} onClose={() => setPermUser(null)} />
      )}
    </div>
  );
}

function UserPermDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const overridesQ = useQuery({
    queryKey: ["user-perms", user.id],
    queryFn: () => get<{ permission: string; granted: boolean }[]>(`/permissions/user/${user.id}`),
    staleTime: 0,
  });

  const overrideMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const o of overridesQ.data ?? []) m.set(o.permission, o.granted);
    return m;
  }, [overridesQ.data]);

  async function toggle(perm: Permission) {
    if (user.role === "ADMIN") return;
    const hasOverride = overrideMap.has(perm);
    const defaultVal = DEFAULT_MATRIX[user.role][perm];
    const currentEffective = hasOverride ? overrideMap.get(perm)! : defaultVal;

    setSaving(true);
    try {
      if (hasOverride && currentEffective === defaultVal) {
        // override matches default → flip to opposite
        await put(`/permissions/user/${user.id}`, { permission: perm, granted: !currentEffective });
      } else if (hasOverride) {
        // remove override (revert to role default)
        await put(`/permissions/user/${user.id}`, { permission: perm, granted: null });
      } else {
        // set override to opposite of default
        await put(`/permissions/user/${user.id}`, { permission: perm, granted: !currentEffective });
      }
    } finally {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["user-perms", user.id] });
      qc.invalidateQueries({ queryKey: ["permissions-me"] });
    }
  }

  async function resetAll() {
    setSaving(true);
    try {
      await del(`/permissions/user/${user.id}`);
    } finally {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["user-perms", user.id] });
      qc.invalidateQueries({ queryKey: ["permissions-me"] });
    }
  }

  const overrideCount = overrideMap.size;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Permissions — {user.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Role baseline: <span className="font-semibold">{user.role}</span>
            {overrideCount > 0 && (
              <span className="ml-2 text-amber-500 font-medium">· {overrideCount} override{overrideCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {user.role === "ADMIN" ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              Admin role has full access to all permissions. Individual overrides are not applicable.
            </div>
          ) : (
            PERMISSION_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2 px-1">
                  {group.label}
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {group.permissions.map((perm, i) => {
                    const hasOverride = overrideMap.has(perm);
                    const defaultVal = DEFAULT_MATRIX[user.role][perm];
                    const effective = hasOverride ? overrideMap.get(perm)! : defaultVal;

                    return (
                      <div
                        key={perm}
                        className={cn(
                          "flex items-center justify-between px-4 py-2.5 transition-colors",
                          i > 0 && "border-t border-border/50",
                          i % 2 === 0 ? "bg-background" : "bg-muted/10",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{PERMISSION_LABELS[perm]}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/50">{perm}</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Default indicator */}
                          <span className={cn(
                            "text-[10px] font-medium",
                            defaultVal ? "text-emerald-500/70" : "text-muted-foreground/50",
                          )}>
                            default: {defaultVal ? "granted" : "denied"}
                          </span>

                          {/* Override badge */}
                          {hasOverride && (
                            <span className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                              effective
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                                : "bg-rose-500/15 border-rose-500/40 text-rose-500",
                            )}>
                              override
                            </span>
                          )}

                          {/* Toggle button */}
                          <button
                            onClick={() => toggle(perm)}
                            disabled={saving || overridesQ.isLoading}
                            className={cn(
                              "inline-flex items-center justify-center rounded-full w-8 h-8 border transition-all",
                              "hover:scale-110 hover:shadow-md",
                              effective
                                ? hasOverride
                                  ? "bg-amber-500/20 border-amber-500/60 text-amber-500"
                                  : "bg-emerald-500/15 border-emerald-500/40 text-emerald-500"
                                : hasOverride
                                  ? "bg-rose-500/20 border-rose-500/60 text-rose-500"
                                  : "bg-muted/30 border-border text-muted-foreground/40",
                            )}
                            title={
                              hasOverride
                                ? `Override: ${effective ? "granted" : "denied"} — click to cycle`
                                : `Default ${effective ? "granted" : "denied"} — click to override`
                            }
                          >
                            {effective
                              ? <Check className="size-3.5" />
                              : <X className="size-3.5" />
                            }
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3 mt-2">
          {overrideCount > 0 && user.role !== "ADMIN" && (
            <Button variant="outline" size="sm" onClick={resetAll} disabled={saving}>
              <RotateCcw className="size-3.5 mr-1" /> Reset all overrides
            </Button>
          )}
          <DialogClose asChild>
            <Button size="sm">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
