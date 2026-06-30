"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginDto } from "@itour/shared";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Plane, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      await post("/auth/login", values);
      router.replace("/dashboard");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05070d] p-4">
      {/* Black abstract blurred background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-sky-600/30 blur-[120px]" />
        <div className="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-cyan-500/20 blur-[130px]" />
        <div className="absolute left-1/2 top-1/3 size-[22rem] -translate-x-1/2 rounded-full bg-indigo-700/20 blur-[110px]" />
        <div className="absolute inset-0 backdrop-blur-[10px]" />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Compact glass card */}
      <div className="relative z-10 w-full max-w-sm animate-fade-in rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Plane className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">iTour Reservation</h1>
            <p className="text-[11px] text-muted-foreground">Allotment & bookings admin</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@itour.app"
              {...register("email")}
            />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
            />
          </Field>

          {submitError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {submitError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner className="size-4 text-primary-foreground" /> : <Lock className="size-4" />}
            Sign in
          </Button>
        </form>

        <div className="mt-5 rounded-lg border border-white/5 bg-black/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="mb-1 font-medium text-foreground/80">Demo accounts</p>
          <p>admin@itour.app · manager@itour.app · agent@itour.app</p>
          <p>accountant@itour.app · viewer@itour.app</p>
          <p className="mt-1">
            Password: <code className="rounded bg-white/10 px-1">Passw0rd!</code>
          </p>
        </div>
      </div>
    </div>
  );
}
