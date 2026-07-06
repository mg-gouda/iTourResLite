"use client";

// A row of "Total" cards, one per currency, shown above a report table.
// Each card lists that currency's summed figures (e.g. Cost / Selling). Only
// currencies that carry a non-zero figure are rendered.

import { formatMoney } from "@itour/shared";
import { Card, CardContent } from "@/components/ui/card";

export interface CurrencyTotalRow { label: string; value: number }
export interface CurrencyTotal { currency: string; rows: CurrencyTotalRow[] }

export function ReportCurrencyTotals({ totals }: { totals: CurrencyTotal[] }) {
  const visible = totals.filter((t) => t.rows.some((r) => Math.abs(r.value) > 0.005));
  if (!visible.length) return null;
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((t) => (
        <Card key={t.currency}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total · {t.currency}</p>
            <div className="mt-2 space-y-1">
              {t.rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="tabular-nums font-medium">{formatMoney(r.value, t.currency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
