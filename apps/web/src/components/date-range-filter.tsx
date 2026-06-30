"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DateRange {
  from: string;
  to: string;
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  className?: string;
}) {
  return (
    <div className={"flex flex-wrap items-end gap-3 " + (className ?? "")}>
      <div className="flex flex-col gap-1">
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="w-40"
        />
      </div>
    </div>
  );
}
