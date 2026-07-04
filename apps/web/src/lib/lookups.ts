"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "./api";

export interface LookupItem {
  id: string;
  code: string;
  name?: string | null;
  active?: boolean;
}

export interface EnumOption {
  value: string;
  label: string;
}

export interface LookupsResponse {
  tourOperators: LookupItem[];
  markets: LookupItem[];
  resorts: LookupItem[];
  bookingStatuses: EnumOption[];
  roomCategories: EnumOption[];
  mealBases: EnumOption[];
  paymentMethods: EnumOption[];
  currencies: EnumOption[];
  spos: EnumOption[];
}

/** TanStack Query around GET /lookups — all select options in one call. */
export function useLookups() {
  return useQuery({
    queryKey: ["lookups"],
    queryFn: () => get<LookupsResponse>("/lookups"),
    staleTime: 5 * 60 * 1000,
  });
}

export type Option = { value: string; label: string };

export function lookupToOptions(items: LookupItem[] | undefined): Option[] {
  if (!items) return [];
  return items.map((i) => ({
    value: i.id,
    label: i.name ? `${i.code} — ${i.name}` : i.code,
  }));
}

/** Async fetcher for the Hotel AsyncCombobox: GET /lookups/hotels?q=&resortId= */
export async function fetchHotelOptions(q: string, resortId?: string): Promise<Option[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (resortId) params.set("resortId", resortId);
  const qs = params.toString();
  const data = await get<{ data: { id: string; name: string }[] }>(`/lookups/hotels${qs ? `?${qs}` : ""}`);
  return (data.data ?? (data as any)).map((h: any) => ({ value: h.id, label: h.name }));
}

/** Room types for a hotel (cascade). GET /hotels/:id/room-types */
export async function fetchRoomTypeOptions(hotelId: string): Promise<Option[]> {
  if (!hotelId) return [];
  const data = await get<{ id: string; name: string; allocation: number }[]>(
    `/hotels/${hotelId}/room-types`,
  );
  return data.map((rt) => ({ value: rt.id, label: rt.name }));
}
