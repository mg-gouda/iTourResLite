import { Injectable, Logger } from "@nestjs/common";

/**
 * USD → EUR reference rate for the report "Currency Converted from USD to EUR"
 * cards.
 *
 * Primary source is the **Central Bank of Egypt**, which is what the business
 * actually settles against. The CBE only publishes EGP legs, so USD→EUR is
 * derived as a cross rate from the two mid-prices:
 *
 *     rate = mid(USD/EGP) / mid(EUR/EGP)
 *
 * The CBE has no JSON API — the rates are server-rendered into an HTML table on
 * the public statistics page, so we parse it. It also serves a 269-byte stub to
 * anything without a browser User-Agent, hence the explicit UA header.
 *
 * If the CBE is unreachable or the page shape changes under us, we fall back to
 * the ECB daily reference rate (frankfurter.dev), which is a direct USD→EUR
 * quote. Both agreed to within ~0.1% when this was written.
 */

export type FxSource = "CBE" | "ECB";

export interface UsdEurRate {
  /** EUR per 1 USD. */
  rate: number;
  /** The date the rate is quoted for, ISO `yyyy-mm-dd`. */
  date: string;
  source: FxSource;
  /** True when both upstreams failed and this is a stale cached value. */
  stale?: boolean;
}

const CBE_URL = "https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates";
const ECB_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR";

// The CBE page is served only to browser-looking clients.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 10_000;
/** Central banks publish once a day; re-checking every 6h is plenty. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Don't hammer a failing upstream on every report render. */
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

/**
 * USD and EUR trade far too close for a correct cross rate to ever leave this
 * band. Anything outside it means we parsed the wrong cells, so we reject it
 * rather than show a wildly wrong total.
 */
const MIN_PLAUSIBLE_RATE = 0.5;
const MAX_PLAUSIBLE_RATE = 1.5;

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  private cached: UsdEurRate | null = null;
  private cachedAt = 0;
  private lastFailureAt = 0;
  /** De-dupes concurrent refreshes so N parallel report loads cause one fetch. */
  private inFlight: Promise<UsdEurRate | null> | null = null;

  async getUsdEur(): Promise<UsdEurRate> {
    const now = Date.now();
    const fresh = this.cached && now - this.cachedAt < CACHE_TTL_MS;
    const backingOff = now - this.lastFailureAt < FAILURE_BACKOFF_MS;

    if (!fresh && !(backingOff && this.cached)) {
      const next = await (this.inFlight ??= this.refresh().finally(() => {
        this.inFlight = null;
      }));
      if (next) return next;
    }

    if (this.cached) {
      // Serve the last good rate rather than breaking the report; the flag lets
      // the UI say so.
      return fresh ? this.cached : { ...this.cached, stale: true };
    }
    throw new Error("USD→EUR rate is unavailable from both the CBE and the ECB");
  }

  private async refresh(): Promise<UsdEurRate | null> {
    const fromCbe = await this.fetchCbe();
    if (fromCbe) return this.store(fromCbe);

    const fromEcb = await this.fetchEcb();
    if (fromEcb) return this.store(fromEcb);

    this.lastFailureAt = Date.now();
    return null;
  }

  private store(rate: UsdEurRate): UsdEurRate {
    this.cached = rate;
    this.cachedAt = Date.now();
    this.lastFailureAt = 0;
    return rate;
  }

  private async fetchCbe(): Promise<UsdEurRate | null> {
    try {
      const res = await fetch(CBE_URL, {
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      const usd = midRate(html, "US Dollar");
      const eur = midRate(html, "Euro");
      if (!usd || !eur) throw new Error("USD/EUR rows not found in the CBE rate table");

      const rate = usd / eur;
      if (!isPlausible(rate)) throw new Error(`implausible cross rate ${rate}`);

      return { rate: round6(rate), date: cbeDate(html), source: "CBE" };
    } catch (err) {
      this.logger.warn(`CBE rate lookup failed, falling back to the ECB: ${msg(err)}`);
      return null;
    }
  }

  private async fetchEcb(): Promise<UsdEurRate | null> {
    try {
      const res = await fetch(ECB_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { date?: string; rates?: { EUR?: number } };

      const rate = body?.rates?.EUR;
      if (typeof rate !== "number" || !isPlausible(rate)) throw new Error(`bad payload rate ${rate}`);

      return { rate: round6(rate), date: body.date ?? today(), source: "ECB" };
    } catch (err) {
      this.logger.error(`ECB rate lookup failed: ${msg(err)}`);
      return null;
    }
  }
}

/**
 * Pulls one currency's mid-price out of the CBE table. Each row is
 * `<td>currency</td><td>buy</td><td>sell</td>`; we average buy and sell so the
 * cross rate is spread-neutral.
 */
function midRate(html: string, currency: string): number | null {
  const re = new RegExp(
    `<td[^>]*>\\s*${currency}\\s*</td>\\s*<td[^>]*>\\s*([\\d.,]+)\\s*</td>\\s*<td[^>]*>\\s*([\\d.,]+)\\s*</td>`,
    "i",
  );
  const m = re.exec(html);
  if (!m) return null;

  const buy = Number(m[1].replace(/,/g, ""));
  const sell = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) return null;

  return (buy + sell) / 2;
}

/** The page states "Rates for Date: dd/mm/yyyy"; fall back to today if absent. */
function cbeDate(html: string): string {
  const m = /Rates for Date:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(html);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : today();
}

const isPlausible = (r: number) =>
  Number.isFinite(r) && r >= MIN_PLAUSIBLE_RATE && r <= MAX_PLAUSIBLE_RATE;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const today = () => new Date().toISOString().slice(0, 10);
const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));
