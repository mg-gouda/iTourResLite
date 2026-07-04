"use client";

import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";

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
        <DateInput
          value={value.from}
          onChange={(v) => onChange({ ...value, from: v })}
          className="w-36"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="to">To</Label>
        <DateInput
          value={value.to}
          onChange={(v) => onChange({ ...value, to: v })}
          className="w-36"
        />
      </div>
    </div>
  );
}
