import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold tabular-nums tracking-tight",
              accent && "text-primary",
            )}
          >
            {value}
          </p>
        </div>
        {icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
