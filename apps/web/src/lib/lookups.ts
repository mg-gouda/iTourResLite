"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "./api";

export interface LookupItem {
  id: string;
  code: string;
  name?: string | null;
  active?: boolean;
}

export interface LookupsResponse {
  tourOperators: LookupItem[];
  markets: LookupItem[];
  resorts: LookupItem[];
}

/** TanStack Query around GET /lookups (TO / Market / Resort tables). */
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

/** Async fetcher for the Hotel AsyncCombobox: GET /lookups/hotels?q= */
export async function fetchHotelOptions(q: string): Promise<Option[]> {
  const data = await get<{ id: string; name: string }[]>(
    `/lookups/hotels${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  );
  return data.map((h) => ({ value: h.id, label: h.name }));
}

/** Room types for a hotel (cascade). GET /hotels/:id/room-types */
export async function fetchRoomTypeOptions(hotelId: string): Promise<Option[]> {
  if (!hotelId) return [];
  const data = await get<{ id: string; name: string; allocation: number }[]>(
    `/hotels/${hotelId}/room-types`,
  );
  return data.map((rt) => ({ value: rt.id, label: rt.name }));
}
