"use client";

import {
  createContext, useContext, useCallback, type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Permission } from "@itour/shared";

interface PermContextValue {
  can: (perm: Permission) => boolean;
  loading: boolean;
  perms: Record<string, boolean> | null;
}

const PermContext = createContext<PermContextValue>({
  can: () => false,
  loading: true,
  perms: null,
});

export function usePermissions() { return useContext(PermContext); }
export function useCan(perm: Permission) { return useContext(PermContext).can(perm); }

export function PermissionProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["permissions-me"],
    queryFn: () => get<Record<string, boolean>>("/permissions/me"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const can = useCallback(
    (perm: Permission) => {
      if (!query.data) return false;
      return query.data[perm] === true;
    },
    [query.data],
  );

  return (
    <PermContext.Provider value={{ can, loading: query.isLoading, perms: query.data ?? null }}>
      {children}
    </PermContext.Provider>
  );
}

/** Renders children only when the permission is granted */
export function Guard({ perm, children, fallback = null }: {
  perm: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, loading } = useContext(PermContext);
  if (loading) return null;
  return can(perm) ? <>{children}</> : <>{fallback}</>;
}
