"use client";

// A row of "Total" cards, one per currency, shown above a report table.
// Each card lists that currency's summed figures (e.g. Cost / Selling). Only
// currencies that carry a non-zero figure are rendered.
//
// Above them sits a combined card that restates the USD figures in EUR and adds
// them to the native EUR figures, so a mixed-currency report can be read as a
// single EUR bottom line.

import { formatMoney, round2 } from "@itour/shared";
import { Card, CardContent } from "@/components/ui/card";
import { useUsdEurRate, FX_SOURCE_LABEL } from "@/lib/fx";

export interface CurrencyTotalRow { label: string; value: number }
export interface CurrencyTotal { currency: string; rows: CurrencyTotalRow[] }

const isNonZero = (v: number) => Math.abs(v) > 0.005;

export function ReportCurrencyTotals({ totals }: { totals: CurrencyTotal[] }) {
  const visible = totals.filter((t) => t.rows.some((r) => isNonZero(r.value)));

  const usd = totals.find((t) => t.currency === "USD");
  const eur = totals.find((t) => t.currency === "EUR");
  // Nothing to convert unless the report actually carries a USD figure.
  const hasUsd = !!usd?.rows.some((r) => isNonZero(r.value));

  if (!visible.length) return null;

  return (
    <div className="mb-4 space-y-3">
      {hasUsd && usd && <ConvertedToEurCard usd={usd} eur={eur} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

/**
 * Restates every USD figure in EUR at the reference rate and folds it into the
 * matching native-EUR figure, giving one combined EUR total per row label.
 */
function ConvertedToEurCard({ usd, eur }: { usd: CurrencyTotal; eur?: CurrencyTotal }) {
  const fx = useUsdEurRate();

  // USD row order wins; any EUR-only label is appended so nothing is dropped.
  const labels = [
    ...usd.rows.map((r) => r.label),
    ...(eur?.rows ?? []).map((r) => r.label).filter((l) => !usd.rows.some((r) => r.label === l)),
  ];

  const valueOf = (t: CurrencyTotal | undefined, label: string) =>
    Number(t?.rows.find((r) => r.label === label)?.value ?? 0);

  const rate = fx.data;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Currency Converted from USD to EUR
          </p>
          {rate && (
            <p className="text-xs text-muted-foreground">
              {FX_SOURCE_LABEL[rate.source]} · 1 USD = {rate.rate.toFixed(4)} EUR · {rate.date}
              {rate.stale && " · cached"}
            </p>
          )}
        </div>

        {fx.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading exchange rate…</p>
        ) : !rate ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Exchange rate unavailable — USD totals could not be converted.
          </p>
        ) : (
          <>
            <div className="mt-2 space-y-1">
              {labels.map((label) => {
                const combined = round2(valueOf(usd, label) * rate.rate + valueOf(eur, label));
                return (
                  <div key={label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular-nums font-semibold">{formatMoney(combined, "EUR")}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              USD totals converted at the rate above and added to the native EUR totals. EGP is not included.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
