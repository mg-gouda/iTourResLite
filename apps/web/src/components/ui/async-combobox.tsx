"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command, CommandItem, CommandList } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComboOption } from "./combobox";

export interface AsyncComboboxProps {
  fetcher: (q: string) => Promise<ComboOption[]>;
  value?: string;
  /** Cached label for the current value, so we can show it without a fetch. */
  label?: string;
  onChange: (value: string, label: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function AsyncCombobox({
  fetcher,
  value,
  label,
  onChange,
  placeholder = "Search…",
  disabled,
  className,
  ...rest
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<ComboOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Debounced server search whenever the popover is open + query changes.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetcher(query)
        .then((res) => {
          if (active) setOptions(res);
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, query, fetcher]);

  const displayLabel =
    options.find((o) => o.value === value)?.label ?? label ?? "";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={rest["aria-label"] ?? placeholder}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !displayLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[14rem] rounded-md border border-border bg-popover p-0 text-popover-foreground shadow-xl data-[state=open]:animate-fade-in"
        >
          {/* shouldFilter=false: results already filtered server-side. */}
          <Command shouldFilter={false} className="overflow-hidden rounded-md">
            <div className="border-b border-border px-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandList className="max-h-60 overflow-y-auto scrollbar-thin p-1">
              {loading ? (
                <div className="space-y-1 p-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-7 animate-pulse-soft rounded-sm bg-muted" />
                  ))}
                </div>
              ) : options.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No results.
                </div>
              ) : (
                options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onChange(opt.value, opt.label);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-secondary"
                  >
                    <Check
                      className={cn(
                        "size-4",
                        opt.value === value ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))
              )}
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface AsyncMultiComboboxProps {
  fetcher: (q: string) => Promise<ComboOption[]>;
  values: string[];
  /** Cached labels for the selected values, so we can show them without a fetch. */
  labels?: Record<string, string>;
  onChange: (values: string[], labels: Record<string, string>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Multi-select variant of AsyncCombobox: server-side search, toggles values on click, stays open. */
export function AsyncMultiCombobox({
  fetcher,
  values,
  labels = {},
  onChange,
  placeholder = "Search…",
  disabled,
  className,
  ...rest
}: AsyncMultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<ComboOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Debounced server search whenever the popover is open + query changes.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetcher(query)
        .then((res) => {
          if (active) setOptions(res);
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, query, fetcher]);

  const toggle = (opt: ComboOption) => {
    if (values.includes(opt.value)) {
      onChange(values.filter((v) => v !== opt.value), labels);
    } else {
      onChange([...values, opt.value], { ...labels, [opt.value]: opt.label });
    }
  };

  const displayLabel =
    values.length === 0 ? ""
    : values.length === 1 ? (labels[values[0]] ?? options.find((o) => o.value === values[0])?.label ?? "1 selected")
    : `${values.length} selected`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={rest["aria-label"] ?? placeholder}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !displayLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[14rem] rounded-md border border-border bg-popover p-0 text-popover-foreground shadow-xl data-[state=open]:animate-fade-in"
        >
          {/* shouldFilter=false: results already filtered server-side. */}
          <Command shouldFilter={false} className="overflow-hidden rounded-md">
            <div className="border-b border-border px-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandList className="max-h-60 overflow-y-auto scrollbar-thin p-1">
              {loading ? (
                <div className="space-y-1 p-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-7 animate-pulse-soft rounded-sm bg-muted" />
                  ))}
                </div>
              ) : options.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No results.
                </div>
              ) : (
                options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => toggle(opt)}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-secondary"
                  >
                    <Check
                      className={cn(
                        "size-4",
                        values.includes(opt.value) ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))
              )}
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
