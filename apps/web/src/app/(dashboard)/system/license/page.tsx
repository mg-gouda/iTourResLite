"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { get, post } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface LicenseStatus {
  result: { ok: boolean; status: string; expiresAt?: number };
  payload: {
    product: string; tenant: string; plan: string;
    domains: string[]; ips?: string[]; maxInstalls: number;
    features?: string[]; exp: number; iat: number;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active:           { label: "Active",             color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle },
  grace:            { label: "Grace Period",        color: "text-amber-600 dark:text-amber-400",    icon: AlertTriangle },
  expired:          { label: "Expired",             color: "text-red-600",                          icon: XCircle },
  revoked:          { label: "Revoked",             color: "text-red-600",                          icon: XCircle },
  invalid:          { label: "Invalid / Not set",   color: "text-muted-foreground",                 icon: Shield },
  domain_mismatch:  { label: "Domain Mismatch",     color: "text-red-600",                          icon: XCircle },
  install_blocked:  { label: "Install Blocked",     color: "text-red-600",                          icon: XCircle },
  ip_mismatch:      { label: "IP Mismatch",         color: "text-red-600",                          icon: XCircle },
  grace_expired:    { label: "Grace Expired",       color: "text-red-600",                          icon: XCircle },
};

function fmtDate(ts?: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function LicensePage() {
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const query = useQuery({
    queryKey: ["license-status"],
    queryFn: () => get<LicenseStatus>("/license/status"),
    staleTime: 60 * 1000,
  });

  const { result, payload } = query.data ?? {};
  const cfg = STATUS_CONFIG[result?.status ?? "invalid"] ?? STATUS_CONFIG.invalid;
  const Icon = cfg.icon;

  async function activate() {
    setActivating(true); setActivateMsg(null);
    try {
      const data = await post<LicenseStatus>("/license/activate", { token: token.trim() });
      if (data.result.ok) {
        setActivateMsg({ ok: true, text: `License activated! Status: ${data.result.status}` });
        setToken("");
      } else {
        setActivateMsg({ ok: false, text: `License check failed: ${data.result.status}` });
      }
      qc.invalidateQueries({ queryKey: ["license-status"] });
    } catch (err: any) {
      setActivateMsg({ ok: false, text: err?.message ?? "Activation failed" });
    } finally { setActivating(false); }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="License" description="Manage the MG application license." />

      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4" /> License Status
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["license-status"] }); get("/license/status?force=true"); }}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>
          ) : (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 text-lg font-semibold ${cfg.color}`}>
                <Icon className="size-5" /> {cfg.label}
              </div>

              {payload && (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-muted-foreground">Product</dt><dd className="font-medium">{payload.product}</dd></div>
                  <div><dt className="text-muted-foreground">Tenant</dt><dd className="font-medium">{payload.tenant}</dd></div>
                  <div><dt className="text-muted-foreground">Plan</dt><dd className="font-medium capitalize">{payload.plan}</dd></div>
                  <div><dt className="text-muted-foreground">Expires</dt><dd className="font-medium">{fmtDate(payload.exp)}</dd></div>
                  <div className="col-span-2"><dt className="text-muted-foreground">Domains</dt><dd className="font-mono text-xs">{payload.domains.join(", ")}</dd></div>
                  {payload.ips?.length ? <div className="col-span-2"><dt className="text-muted-foreground">Hosting IPs</dt><dd className="font-mono text-xs">{payload.ips.join(", ")}</dd></div> : null}
                  {payload.features?.length ? <div className="col-span-2"><dt className="text-muted-foreground">Features</dt><dd className="text-xs">{payload.features.join(", ")}</dd></div> : null}
                  <div><dt className="text-muted-foreground">Max Installs</dt><dd>{payload.maxInstalls}</dd></div>
                </dl>
              )}

              {result?.status === "grace" && (
                <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="size-4 shrink-0" />
                  Running in grace period — renew or re-activate to restore full status.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activate card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activate / Replace License</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste the license token emailed to you by MG. The token will be verified against the license server immediately.
          </p>
          <Textarea
            rows={5}
            placeholder="Paste license token here…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="font-mono text-xs"
          />
          {activateMsg && (
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${activateMsg.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {activateMsg.ok ? <CheckCircle className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
              {activateMsg.text}
            </div>
          )}
          <Button onClick={activate} disabled={activating || !token.trim()}>
            {activating ? <RefreshCw className="size-4 animate-spin" /> : <Shield className="size-4" />}
            Activate License
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
