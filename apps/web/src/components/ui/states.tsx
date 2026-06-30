import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "./skeleton";
import { Button } from "./button";

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="rounded-full bg-secondary p-3">
        <Inbox className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof Error ? error.message : "Something went wrong while loading data.";
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="rounded-full bg-destructive/15 p-3">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <p className="text-sm font-medium">Could not load</p>
      <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
