"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginDto } from "@itour/shared";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Lock, Shield, ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");

  // 2FA state
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/system-config/company-name`)
      .then((r) => r.json())
      .then((d) => { if (d.companyName) setCompanyName(d.companyName); })
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginDto) {
    setSubmitError(null);
    try {
      const res = await post<any>("/auth/login", values);
      if (res.requires2fa) {
        setPreAuthToken(res.preAuthToken);
        setTotpCode("");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function onTotp(e: React.FormEvent) {
    e.preventDefault();
    if (totpCode.length !== 6 || !preAuthToken) return;
    setTotpLoading(true); setSubmitError(null);
    try {
      await post("/auth/2fa/verify", { preAuthToken, code: totpCode });
      router.replace("/dashboard");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Invalid code");
    } finally { setTotpLoading(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05070d] p-4">
      {/* Brand SVG background */}
      <div className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/login-bg.svg" alt="" className="h-full w-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* Compact glass card */}
      <div className="relative z-10 w-full max-w-sm animate-fade-in rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.svg" alt="iTour Reservations LITE" className="h-14 w-full object-contain" />
          <p className="text-xs font-medium tracking-widest text-white/50">iTour Reservations LITE</p>
        </div>

        {/* Step 1: email + password */}
        {!preAuthToken && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" placeholder="you@itour.app" {...register("email")} />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
            </Field>

            {submitError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{submitError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="size-4 text-primary-foreground" /> : <Lock className="size-4" />}
              Sign in
            </Button>
          </form>
        )}

        {/* Step 2: 2FA code */}
        {preAuthToken && (
          <form onSubmit={onTotp} className="space-y-4">
            <div className="flex items-center gap-2 text-white/80 mb-1">
              <Shield className="size-4 text-primary shrink-0" />
              <span className="text-sm font-medium">Two-Factor Verification</span>
            </div>
            <p className="text-xs text-white/50">Enter the 6-digit code from your authenticator app.</p>

            <Input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              placeholder="000000" value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em] font-mono h-12"
              autoFocus
            />

            {submitError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{submitError}</p>
            )}

            <Button type="submit" className="w-full" disabled={totpLoading || totpCode.length !== 6}>
              {totpLoading ? <Spinner className="size-4 text-primary-foreground" /> : <Shield className="size-4" />}
              Verify
            </Button>
            <button
              type="button"
              className="w-full text-xs text-white/40 hover:text-white/60 flex items-center justify-center gap-1 mt-1"
              onClick={() => { setPreAuthToken(null); setSubmitError(null); setTotpCode(""); }}
            >
              <ArrowLeft className="size-3" /> Back to login
            </button>
          </form>
        )}

        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-white/50">
          <p className="font-semibold text-white/70">Authorized Personnel Only</p>
          <p className="mt-1">
            This software is licensed to{" "}
            <span className="font-medium text-white/80">{companyName || "your organization"}</span>.
          </p>
          <p className="mt-1">
            Contact system developer{" "}
            <a href="https://wa.me/+201002805139" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-400 hover:underline">
              Mohamed Gouda
            </a>{" "}
            for access.
          </p>
        </div>
      </div>
    </div>
  );
}
