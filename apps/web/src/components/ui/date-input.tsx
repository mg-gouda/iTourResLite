"use client";

import { useRef, useState } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const mi = parseInt(m, 10) - 1;
  if (isNaN(mi) || mi < 0 || mi > 11) return iso;
  return `${d}-${MONTHS[mi]}-${y.slice(2)}`;
}

function parseDdMmYy(raw: string): string | null {
  const clean = raw.replace(/\D/g, "");
  if (clean.length < 6) return null;
  const dd = parseInt(clean.slice(0, 2), 10);
  const mm = parseInt(clean.slice(2, 4), 10);
  const yy = parseInt(clean.slice(4, 6), 10);
  const year = yy <= 50 ? 2000 + yy : 1900 + yy;
  const d = new Date(year, mm - 1, dd);
  if (isNaN(d.getTime()) || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

interface DateInputProps {
  value: string;          // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

export function DateInput({ value, onChange, disabled, readOnly, className, placeholder }: DateInputProps) {
  const [raw, setRaw] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
    setRaw(v);
    if (v.length === 6) {
      const iso = parseDdMmYy(v);
      if (iso) onChange(iso);
    }
  }

  function handleBlur() {
    setFocused(false);
    if (raw.length === 6) {
      const iso = parseDdMmYy(raw);
      if (iso) { onChange(iso); setRaw(""); return; }
    }
    setRaw("");
  }

  function handleFocus() {
    setFocused(true);
    setRaw("");
  }

  const display = focused ? raw : isoToDisplay(value);

  return (
    <Input
      ref={inputRef}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={focused ? "ddmmyy" : (placeholder ?? "DD-Mon-YY")}
      maxLength={6}
      className={cn("font-mono tabular-nums", className)}
    />
  );
}
