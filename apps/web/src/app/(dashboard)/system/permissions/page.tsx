"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, RotateCcw, Shield, ChevronDown, ChevronRight } from "lucide-react";
import {
  PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS, DEFAULT_MATRIX,
  type Permission, type Role,
} from "@itour/shared";
import { get, put, del } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["ADMIN", "MANAGER", "AGENT", "ACCOUNTANT", "VIEWER"];
const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin", MANAGER: "Manager", AGENT: "Agent", ACCOUNTANT: "Accountant", VIEWER: "Viewer",
};
const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "text-rose-500",
  MANAGER: "text-violet-500",
  AGENT: "text-sky-500",
  ACCOUNTANT: "text-amber-500",
  VIEWER: "text-slate-400",
};

export default function PermissionsPage() {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const matrixQ = useQuery({
    queryKey: ["perm-matrix"],
    queryFn: () => get<Record<Role, Record<Permission, boolean>>>("/permissions/matrix"),
    staleTime: 0,
  });
  const overridesQ = useQuery({
    queryKey: ["perm-role-overrides"],
    queryFn: () => get<Record<Role, { permission: string; granted: boolean }[]>>("/permissions/role-overrides"),
    staleTime: 0,
  });

  const overrideSet = useMemo(() => {
    const s = new Set<string>();
    if (!overridesQ.data) return s;
    for (const [role, overrides] of Object.entries(overridesQ.data)) {
      for (const o of overrides) s.add(`${role}:${o.permission}`);
    }
    return s;
  }, [overridesQ.data]);

  async function toggle(role: Role, permission: Permission, current: boolean) {
    if (role === "ADMIN") return;
    const isOverridden = overrideSet.has(`${role}:${permission}`);
    const defaultVal = DEFAULT_MATRIX[role][permission];

    setSaving(true);
    try {
      if (isOverridden && current === defaultVal) {
        // cycle: override matches default → remove override (back to default)
        // actually: click when overridden → toggle to opposite override
        await put(`/permissions/role/${role}`, { permission, granted: !current });
      } else if (isOverridden) {
        // remove override, revert to default
        await put(`/permissions/role/${role}`, { permission, granted: null });
      } else {
        // no override: set override to opposite of current (which equals default)
        await put(`/permissions/role/${role}`, { permission, granted: !current });
      }
    } finally {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["perm-matrix"] });
      qc.invalidateQueries({ queryKey: ["perm-role-overrides"] });
      qc.invalidateQueries({ queryKey: ["permissions-me"] });
    }
  }

  async function resetRole(role: Role) {
    setSaving(true);
    try {
      await del(`/permissions/role/${role}`);
    } finally {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["perm-matrix"] });
      qc.invalidateQueries({ queryKey: ["perm-role-overrides"] });
      qc.invalidateQueries({ queryKey: ["permissions-me"] });
    }
  }

  function toggleGroup(label: string) {
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });
  }

  const matrix = matrixQ.data;
  const loading = matrixQ.isLoading || overridesQ.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permission Matrix"
        description="Granular role-based access control. Click any cell to toggle an override. Amber = overridden from default."
      />

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            {/* Sticky header */}
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="w-[300px] px-4 py-3 text-left font-semibold text-foreground">
                  Permission
                </th>
                {ROLES.map((role) => (
                  <th key={role} className="px-3 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={cn("font-bold text-xs tracking-wide uppercase", ROLE_COLORS[role])}>
                        {ROLE_LABELS[role]}
                      </span>
                      {role !== "ADMIN" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => resetRole(role)}
                          disabled={saving}
                          title={`Reset ${ROLE_LABELS[role]} to defaults`}
                        >
                          <RotateCcw className="size-2.5 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    Loading permissions…
                  </td>
                </tr>
              ) : (
                PERMISSION_GROUPS.map((group, gi) => {
                  const isCollapsed = collapsed.has(group.label);
                  return [
                    // Group header row
                    <tr
                      key={`g-${gi}`}
                      className="bg-muted/40 border-t border-border cursor-pointer select-none hover:bg-muted/60 transition-colors"
                      onClick={() => toggleGroup(group.label)}
                    >
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {isCollapsed
                            ? <ChevronRight className="size-3.5 text-muted-foreground" />
                            : <ChevronDown className="size-3.5 text-muted-foreground" />
                          }
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </span>
                          <span className="ml-auto text-[10px] text-muted-foreground/60">
                            {group.permissions.length} permissions
                          </span>
                        </div>
                      </td>
                    </tr>,
                    // Permission rows
                    ...(isCollapsed ? [] : group.permissions.map((perm, pi) => (
                      <tr
                        key={perm}
                        className={cn(
                          "border-t border-border/50 transition-colors",
                          pi % 2 === 0 ? "bg-background" : "bg-muted/10",
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-medium text-foreground">
                            {PERMISSION_LABELS[perm]}
                          </span>
                          <span className="block text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                            {perm}
                          </span>
                        </td>
                        {ROLES.map((role) => {
                          const granted = matrix?.[role]?.[perm] ?? false;
                          const isOverride = overrideSet.has(`${role}:${perm}`);
                          const isAdmin = role === "ADMIN";

                          return (
                            <td key={role} className="px-3 py-2.5 text-center">
                              <button
                                disabled={isAdmin || saving}
                                onClick={() => toggle(role, perm, granted)}
                                className={cn(
                                  "inline-flex items-center justify-center rounded-full transition-all",
                                  "w-8 h-8 border",
                                  isAdmin
                                    ? "cursor-default opacity-70"
                                    : "hover:scale-110 hover:shadow-md cursor-pointer",
                                  granted
                                    ? isOverride
                                      ? "bg-amber-500/20 border-amber-500/60 text-amber-500"
                                      : "bg-emerald-500/15 border-emerald-500/40 text-emerald-500"
                                    : isOverride
                                      ? "bg-rose-500/20 border-rose-500/60 text-rose-500"
                                      : "bg-muted/30 border-border text-muted-foreground/40",
                                )}
                                title={
                                  isAdmin
                                    ? "Admin always has full access"
                                    : isOverride
                                      ? `Override: ${granted ? "Granted" : "Denied"} (click to remove override)`
                                      : `Default: ${granted ? "Granted" : "Denied"} (click to override)`
                                }
                              >
                                {granted
                                  ? <CheckCircle2 className="size-4" />
                                  : <XCircle className="size-4" />
                                }
                              </button>
                              {isOverride && (
                                <div className="mt-0.5 text-[9px] font-semibold tracking-wide text-amber-500">
                                  override
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))),
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-500"><CheckCircle2 className="size-3" /></span>
          Default granted
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted/30 border border-border text-muted-foreground/40"><XCircle className="size-3" /></span>
          Default denied
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-500"><CheckCircle2 className="size-3" /></span>
          Override granted
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/60 text-rose-500"><XCircle className="size-3" /></span>
          Override denied
        </div>
        <span className="ml-auto flex items-center gap-1.5">
          <Shield className="size-3" /> Admin always has full access regardless of overrides.
        </span>
      </div>
    </div>
  );
}
