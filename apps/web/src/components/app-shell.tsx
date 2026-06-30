"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  PieChart,
  Layers,
  CalendarRange,
  BookOpen,
  Ban,
  SlidersHorizontal,
  Users,
  Menu,
  X,
  LogOut,
  Search,
  Plane,
} from "lucide-react";
import { hasRole, type Role } from "@itour/shared";
import { useAuth } from "@/components/auth-provider";
import { Badge, roleVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const VIEWS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/overview", label: "Overview", icon: CalendarRange },
  { href: "/pl", label: "P&L", icon: LineChart },
  { href: "/breakdowns", label: "Breakdowns", icon: PieChart },
  { href: "/materialization", label: "Materialization", icon: Layers },
];

const MANAGE: NavItem[] = [
  { href: "/bookings", label: "Bookings", icon: BookOpen },
  { href: "/stop-sale", label: "Stop Sale", icon: Ban },
  { href: "/system/parameters", label: "System Parameters", icon: SlidersHorizontal, adminOnly: true },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
];

function NavGroup({
  title,
  items,
  role,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  role: Role;
  pathname: string;
  onNavigate: () => void;
}) {
  const visible = items.filter((i) => !i.adminOnly || role === "ADMIN");
  if (visible.length === 0) return null;
  return (
    <div className="px-2 py-1">
      <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </p>
      <nav className="space-y-0.5">
        {visible.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Guard: no user -> bounce to login.
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  const role = user.role as Role;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const ref = search.trim();
    if (ref) {
      router.push(`/bookings?ref=${encodeURIComponent(ref)}`);
      setMobileOpen(false);
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary/20 text-primary">
          <Plane className="size-4" />
        </div>
        <span className="text-sm font-semibold">iTour</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <NavGroup title="Views" items={VIEWS} role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        <NavGroup title="Manage" items={MANAGE} role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      </div>
      <div className="border-t border-border p-3 text-[11px] text-muted-foreground">
        {hasRole(role, "AGENT") ? "Full access" : "Read access"}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card shadow-xl animate-fade-in">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — legacy slate-900 aesthetic */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-[rgb(15,23,42)] px-3 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <span className="hidden text-sm font-semibold sm:block">
            iTour Reservation App
          </span>

          <form onSubmit={onSearch} className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search T/O Booking Ref…"
              aria-label="Search by tour operator booking reference"
              className="pl-8"
            />
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-tight">{user.name}</p>
            </div>
            <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* close icon helper for a11y on mobile (rendered offscreen if needed) */}
      <span className="sr-only">
        <X />
      </span>
    </div>
  );
}
