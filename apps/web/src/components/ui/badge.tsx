import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { BookingStatus } from "@itour/shared";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-emerald-500/15 text-emerald-300",
        warning: "border-transparent bg-amber-500/15 text-amber-300",
        danger: "border-transparent bg-red-500/15 text-red-300",
        info: "border-transparent bg-blue-500/15 text-blue-300",
        violet: "border-transparent bg-violet-500/15 text-violet-300",
        orange: "border-transparent bg-orange-500/15 text-orange-300",
        zinc: "border-transparent bg-zinc-500/15 text-zinc-300",
        primary: "border-transparent bg-primary/15 text-primary",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANT: Record<BookingStatus, BadgeProps["variant"]> = {
  Confirmed: "success",
  Pending: "warning",
  CXL: "danger",
  Sent: "info",
  NoShow: "zinc",
  Bubble: "violet",
  StopSale: "orange",
};

export function statusVariant(status: string): BadgeProps["variant"] {
  return STATUS_VARIANT[status as BookingStatus] ?? "neutral";
}

const ROLE_VARIANT: Record<string, BadgeProps["variant"]> = {
  ADMIN: "primary",
  MANAGER: "info",
  AGENT: "success",
  ACCOUNTANT: "violet",
  VIEWER: "zinc",
};

export function roleVariant(role: string): BadgeProps["variant"] {
  return ROLE_VARIANT[role] ?? "neutral";
}
