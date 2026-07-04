"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Lock, KeyRound, CheckCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { get, post } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Fetch fresh user (includes twoFactorEnabled)
  const meQuery = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => get<{ user: any }>("/auth/me").then((r) => r.user),
  });

  const me = meQuery.data;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My Profile" description="Manage your password and security settings." />

      <ChangePasswordCard />

      {me !== undefined && (
        <TwoFaCard enabled={me?.twoFactorEnabled ?? false} onChanged={() => qc.invalidateQueries({ queryKey: ["me-profile"] })} />
      )}
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) { setMsg({ ok: false, text: "New password must be at least 8 characters" }); return; }
    setLoading(true); setMsg(null);
    try {
      await post("/profile/password", { currentPassword: current, newPassword: next });
      setMsg({ ok: true, text: "Password changed successfully." });
      setCurrent(""); setNext("");
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message ?? "Failed to change password" });
    } finally { setLoading(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="size-4" /> Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current Password">
            <div className="relative">
              <Input type={showCurrent ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} required />
              <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent((v) => !v)}>
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field label="New Password" hint="Minimum 8 characters">
            <div className="relative">
              <Input type={showNext ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} required />
              <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNext((v) => !v)}>
                {showNext ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          {msg && (
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {msg.ok ? <CheckCircle className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
              {msg.text}
            </div>
          )}
          <Button type="submit" disabled={loading || !current || !next}>
            {loading && <Spinner />} Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFaCard({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function startSetup() {
    setLoading(true); setMsg(null);
    try {
      const data = await get<{ secret: string; uri: string; qrDataUrl: string }>("/profile/2fa/setup");
      setSecret(data.secret); setUri(data.uri); setQrDataUrl(data.qrDataUrl); setPhase("setup"); setCode("");
    } catch (err: any) { setMsg({ ok: false, text: err?.message ?? "Setup failed" }); }
    finally { setLoading(false); }
  }

  async function enable() {
    if (code.length !== 6) { setMsg({ ok: false, text: "Enter the 6-digit code from your authenticator" }); return; }
    setLoading(true); setMsg(null);
    try {
      await post("/profile/2fa/enable", { code });
      setMsg({ ok: true, text: "2FA enabled successfully." });
      setPhase("idle"); onChanged();
    } catch (err: any) { setMsg({ ok: false, text: err?.message ?? "Invalid code" }); }
    finally { setLoading(false); }
  }

  async function disable() {
    if (code.length !== 6) { setMsg({ ok: false, text: "Enter the 6-digit code to confirm" }); return; }
    setLoading(true); setMsg(null);
    try {
      await post("/profile/2fa/disable", { code });
      setMsg({ ok: true, text: "2FA disabled." });
      setPhase("idle"); onChanged();
    } catch (err: any) { setMsg({ ok: false, text: err?.message ?? "Invalid code" }); }
    finally { setLoading(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-4" /> Two-Factor Authentication
          {enabled && (
            <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Enabled
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === "idle" && !enabled && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security. You'll need a TOTP app like Google Authenticator, Authy, or 1Password.
            </p>
            <Button variant="outline" onClick={startSetup} disabled={loading}>
              {loading ? <Spinner /> : <KeyRound className="size-4" />} Set up 2FA
            </Button>
          </div>
        )}

        {phase === "idle" && enabled && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              2FA is active on your account. Enter your authenticator code to disable it.
            </p>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setPhase("disable"); setCode(""); setMsg(null); }}>
              Disable 2FA
            </Button>
          </div>
        )}

        {phase === "setup" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
              <p className="text-sm font-medium">Step 1 — Open your authenticator app and scan this QR code</p>
              <p className="text-xs text-muted-foreground">Scan the QR code below, or enter the secret key manually.</p>
              {qrDataUrl && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="2FA QR code"
                    width={200}
                    height={200}
                    className="rounded-md border border-border bg-white p-2"
                  />
                </div>
              )}
              <a
                href={uri}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-mono text-primary hover:bg-primary/20 transition-colors break-all"
              >
                Open in Authenticator App
              </a>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Manual entry key</p>
                <p className="font-mono text-sm tracking-widest select-all">{secret.match(/.{1,4}/g)?.join(" ")}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Step 2 — Enter the 6-digit code to confirm</p>
              <div className="flex gap-2 items-center">
                <Input
                  type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                  placeholder="000000" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-36 text-center text-lg tracking-[0.4em] font-mono"
                />
                <Button onClick={enable} disabled={loading || code.length !== 6}>
                  {loading ? <Spinner /> : <CheckCircle className="size-4" />} Verify & Enable
                </Button>
                <Button variant="ghost" onClick={() => { setPhase("idle"); setMsg(null); }}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {phase === "disable" && (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <Input
                type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                placeholder="000000" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-36 text-center text-lg tracking-[0.4em] font-mono"
              />
              <Button variant="destructive" onClick={disable} disabled={loading || code.length !== 6}>
                {loading ? <Spinner /> : null} Confirm Disable
              </Button>
              <Button variant="ghost" onClick={() => { setPhase("idle"); setMsg(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        {msg && (
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
            {msg.ok ? <CheckCircle className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
            {msg.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
