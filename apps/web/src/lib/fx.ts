"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export interface UsdEurRate {
  /** EUR per 1 USD. */
  rate: number;
  /** Date the rate is quoted for, ISO `yyyy-mm-dd`. */
  date: string;
  source: "CBE" | "ECB";
  /** Set when both upstreams were unreachable and this is a cached value. */
  stale?: boolean;
}

/**
 * USD → EUR reference rate, shared by every report's conversion card. The API
 * caches upstream for 6h, so this is cheap; we keep it fresh for an hour
 * client-side and retry once on failure.
 */
export function useUsdEurRate(enabled = true) {
  return useQuery({
    queryKey: ["fx-usd-eur"],
    queryFn: () => get<UsdEurRate>("/fx/usd-eur"),
    staleTime: 60 * 60 * 1000,
    retry: 1,
    enabled,
  });
}

export const FX_SOURCE_LABEL: Record<UsdEurRate["source"], string> = {
  CBE: "Central Bank of Egypt",
  ECB: "European Central Bank",
};
