import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/** Labelled form field with optional inline error message. */
export function Field({
  label,
  htmlFor,
  error,
  children,
  className,
  hint,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
