"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No results.",
  disabled,
  className,
  ...rest
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

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
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[12rem] rounded-md border border-border bg-popover p-0 text-popover-foreground shadow-xl data-[state=open]:animate-fade-in"
        >
          <Command className="overflow-hidden rounded-md">
            <div className="border-b border-border px-2">
              <CommandInput
                placeholder="Search…"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandList className="max-h-60 overflow-y-auto scrollbar-thin p-1">
              <CommandEmpty className="px-2 py-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt.value);
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
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Helper to build options from an enum-style array + optional label map. */
export function enumOptions(
  values: readonly string[],
  labels?: Record<string, string>,
): ComboOption[] {
  return values.map((v) => ({ value: v, label: labels?.[v] ?? v }));
}
