"use client";

import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Resets a report's filters. Disabled when no filter is active.
export function ClearFiltersButton({ onClear, disabled }: { onClear: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClear} disabled={disabled}>
      <FilterX className="size-4" /> Clear
    </Button>
  );
}
