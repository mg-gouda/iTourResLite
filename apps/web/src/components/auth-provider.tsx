"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@itour/shared";
import { get, post, ApiError } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const data = await get<{ user: SessionUser }>("/auth/me");
      setUser(data.user);
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && err.status === 401 && pathname !== "/login") {
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  const logout = useCallback(async () => {
    try {
      await post("/auth/logout");
    } catch {
      /* ignore */
    }
    setUser(null);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-7 text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
