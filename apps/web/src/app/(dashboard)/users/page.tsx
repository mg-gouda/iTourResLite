"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, KeyRound, Power } from "lucide-react";
import { ROLES, type Role } from "@itour/shared";
import { get, post, patch, del, ApiError } from "@/lib/api";
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
  const list = useQuery({ queryKey: ["users"], queryFn: () => get<UserRow[]>("/users") });

  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState({ email: "", name: "", role: "VIEWER" as Role, password: "" });
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      await del(`/users/${u.id}`); // deactivate
    } else {
      await patch(`/users/${u.id}`, { active: true });
    }
    await qc.invalidateQueries({ queryKey: ["users"] });
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
        description="Manage accounts, roles and access."
        actions={<Button size="sm" onClick={() => { setError(null); setCreateOpen(true); }}><Plus className="size-4" /> New user</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <TableSkeleton rows={5} cols={5} />
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
                    <TD className="text-muted-foreground">{u.lastLoginAt ? u.lastLoginAt.slice(0, 10) : "—"}</TD>
                    <TD>{u.active ? <Badge variant="success">Active</Badge> : <Badge variant="zinc">Inactive</Badge>}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Reset password" onClick={() => { setError(null); setResetFor(u); }}><KeyRound className="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Toggle active" onClick={() => toggleActive(u)}><Power className={u.active ? "size-4 text-destructive" : "size-4 text-emerald-400"} /></Button>
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
    </div>
  );
}
