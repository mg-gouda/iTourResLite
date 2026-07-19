"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastOptions {
  message?: string;
  /** Auto-dismiss delay in ms. Defaults to 4500 (6000 for errors). Pass 0 to keep it until closed. */
  duration?: number;
}

type ShowFn = (title: string, opts?: ToastOptions) => void;

const ToastCtx = createContext<{
  success: ShowFn;
  error: ShowFn;
  warning: ShowFn;
  info: ShowFn;
}>({
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

const VARIANTS: Record<ToastType, { icon: typeof CheckCircle2; ring: string; iconCls: string }> = {
  success: { icon: CheckCircle2, ring: "border-l-success", iconCls: "text-success" },
  error: { icon: XCircle, ring: "border-l-destructive", iconCls: "text-destructive" },
  warning: { icon: AlertTriangle, ring: "border-l-warning", iconCls: "text-warning" },
  info: { icon: Info, ring: "border-l-info", iconCls: "text-info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  // Track timers so we can clear them on unmount / manual dismiss.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback(
    (type: ToastType, title: string, opts?: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, type, title, message: opts?.message }]);
      const duration = opts?.duration ?? (type === "error" ? 6000 : 4500);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss],
  );

  // Clear any pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => clearTimeout(t)); map.clear(); };
  }, []);

  const api = useRef({
    success: (title: string, opts?: ToastOptions) => push("success", title, opts),
    error: (title: string, opts?: ToastOptions) => push("error", title, opts),
    warning: (title: string, opts?: ToastOptions) => push("warning", title, opts),
    info: (title: string, opts?: ToastOptions) => push("info", title, opts),
  });

  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const v = VARIANTS[t.type];
          const Icon = v.icon;
          return (
            <div
              key={t.id}
              role="status"
              aria-live={t.type === "error" ? "assertive" : "polite"}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-border bg-card p-3 pr-2 shadow-lg animate-toast-in",
                v.ring,
              )}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", v.iconCls)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-card-foreground">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-muted-foreground">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-sm p-0.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
