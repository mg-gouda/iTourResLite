"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { get, patch } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CompanyPage() {
  return (
    <div>
      <PageHeader title="Company" description="Company profile and outgoing email (SMTP) settings." />
      <Tabs defaultValue="company" orientation="vertical" className="flex items-start gap-4">
        <TabsList className="h-auto w-48 shrink-0 flex-col justify-start rounded-md p-1">
          <TabsTrigger value="company" className="w-full justify-start">Company</TabsTrigger>
          <TabsTrigger value="email" className="w-full justify-start">Email Settings</TabsTrigger>
        </TabsList>
        <div className="min-w-0 flex-1">
          <TabsContent value="company" className="mt-0"><CompanyTab /></TabsContent>
          <TabsContent value="email" className="mt-0"><EmailSettingsTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ---------------- Email (SMTP) Settings ---------------- */

const SMTP_KEYS = ["smtpHost","smtpPort","smtpSecure","smtpUser","smtpPass","smtpFrom","smtpFromName"] as const;
type SmtpKey = typeof SMTP_KEYS[number];
const SMTP_DEFAULTS: Record<SmtpKey, string> = { smtpHost:"", smtpPort:"587", smtpSecure:"false", smtpUser:"", smtpPass:"", smtpFrom:"", smtpFromName:"" };

const PROVIDERS: { label: string; host: string; port: string; secure: string; note?: string }[] = [
  { label: "Custom", host: "", port: "587", secure: "false" },
  { label: "Gmail", host: "smtp.gmail.com", port: "587", secure: "false", note: "Use an App Password (Google Account → Security → App passwords)" },
  { label: "Outlook / Office 365", host: "smtp.office365.com", port: "587", secure: "false" },
  { label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: "587", secure: "false", note: "Use an App Password from Yahoo Account Security settings" },
];

function EmailSettingsTab() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ["system-config"], queryFn: () => get<Record<string, string>>("/system-config") });
  const [form, setForm] = useState<Record<SmtpKey, string>>(SMTP_DEFAULTS);
  const [seeded, setSeeded] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | undefined>(undefined);

  if (cfg.isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (cfg.isError)   return <div className="p-4 text-sm text-destructive">Failed to load config.</div>;

  if (!seeded && cfg.data) {
    setForm({ ...SMTP_DEFAULTS, ...Object.fromEntries(SMTP_KEYS.map((k) => [k, cfg.data![k] ?? SMTP_DEFAULTS[k]])) } as Record<SmtpKey,string>);
    setSeeded(true);
  }

  const field = (k: SmtpKey) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function applyProvider(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = PROVIDERS.find((x) => x.label === e.target.value);
    if (!p) return;
    setForm((f) => ({ ...f, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }));
    setProviderNote(p.note);
  }

  async function save() {
    setError(null); setSaved(false);
    try {
      await patch("/system-config", form);
      qc.invalidateQueries({ queryKey: ["system-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message ?? "Save failed."); }
  }

  const configured = !!form.smtpHost;

  return (
    <Card className="mt-4 max-w-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Email Settings (SMTP)
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${configured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {configured ? "Configured" : "Not configured"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">

        {/* Provider preset */}
        <Field label="Email Provider" className="col-span-2">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="Custom" onChange={applyProvider}>
            {PROVIDERS.map((p) => <option key={p.label}>{p.label}</option>)}
          </select>
        </Field>
        {providerNote && (
          <p className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            {providerNote}
          </p>
        )}

        <Field label="SMTP Host" className="col-span-2">
          <Input value={form.smtpHost} onChange={field("smtpHost")} placeholder="smtp.example.com" />
        </Field>
        <Field label="SMTP Port">
          <Input type="number" value={form.smtpPort} onChange={field("smtpPort")} placeholder="587" />
        </Field>
        <Field label="Encryption" className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" className="accent-primary" checked={form.smtpSecure === "true"}
              onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked ? "true" : "false" }))} />
            SSL/TLS — only for port 465
          </label>
        </Field>
        <Field label="Username / Email" className="col-span-2">
          <Input value={form.smtpUser} onChange={field("smtpUser")} placeholder="your@email.com" autoComplete="off" />
        </Field>
        <Field label="Password" className="col-span-2">
          <div className="relative">
            <Input type={showPass ? "text" : "password"} value={form.smtpPass} onChange={field("smtpPass")}
              placeholder="••••••••" autoComplete="new-password" className="pr-10" />
            <button type="button" onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field label="From Email" className="col-span-2">
          <Input value={form.smtpFrom} onChange={field("smtpFrom")} placeholder="reservations@example.com" />
        </Field>
        <Field label="From Name" className="col-span-2">
          <Input value={form.smtpFromName} onChange={field("smtpFromName")} placeholder="Fulvago Travel Reservations" />
        </Field>

        {error && <p className="col-span-2 text-xs text-destructive">{error}</p>}
        {saved && <p className="col-span-2 text-xs text-green-600">Saved successfully.</p>}
        <div className="col-span-2">
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Company Settings ---------------- */

function CompanyTab() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ["system-config"], queryFn: () => get<Record<string, string>>("/system-config") });
  const [companyName, setCompanyName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoData, setLogoData] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cfg.isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (cfg.isError)   return <div className="p-4 text-sm text-destructive">Failed to load config.</div>;

  const serverName = cfg.data?.companyName ?? "";
  const serverLogo = cfg.data?.companyLogo ?? null;
  const displayName = companyName || serverName;
  const displayLogo = logoPreview ?? serverLogo;

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { setError("Logo must be under 500 KB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setLogoData(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setError(null); setSaved(false);
    try {
      const payload: Record<string, string> = { companyName: displayName.trim() };
      if (logoData) payload.companyLogo = logoData;
      await patch("/system-config", payload);
      qc.invalidateQueries({ queryKey: ["system-config"] });
      setSaved(true); setLogoData(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message ?? "Save failed."); }
  }

  async function removeLogo() {
    try {
      await patch("/system-config", { companyLogo: "" });
      qc.invalidateQueries({ queryKey: ["system-config"] });
      setLogoPreview(null); setLogoData(null);
    } catch (e: any) { setError(e.message ?? "Failed to remove logo."); }
  }

  return (
    <Card className="mt-4 max-w-md">
      <CardHeader><CardTitle className="text-base">Company Settings</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label="Company Name">
          <Input value={displayName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Fulvago Travel" />
        </Field>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Company Logo <span className="text-xs text-muted-foreground">(used in report headers — PNG/JPG/SVG, max 500 KB)</span></label>
          {displayLogo ? (
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-40 items-center justify-center rounded-md border border-border bg-secondary/40 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayLogo} alt="Company logo" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                  Replace
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={onLogoChange} />
                </label>
                <button onClick={removeLogo} className="rounded-md px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-secondary/30 text-xs text-muted-foreground hover:bg-secondary/50">
              <span className="font-medium">Click to upload logo</span>
              <span>PNG, JPG or SVG</span>
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={onLogoChange} />
            </label>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {saved && <p className="text-xs text-green-600">Saved successfully.</p>}
        <Button size="sm" className="self-start" onClick={save}>Save</Button>
      </CardContent>
    </Card>
  );
}
