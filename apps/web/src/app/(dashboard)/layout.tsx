"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { PermissionProvider } from "@/components/permission-provider";
import { AppShell } from "@/components/app-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PermissionProvider>
        <AppShell>{children}</AppShell>
      </PermissionProvider>
    </AuthProvider>
  );
}
