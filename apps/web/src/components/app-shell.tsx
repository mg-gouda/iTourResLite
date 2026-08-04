"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
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
  ClipboardList,
  TrendingUp,
  CreditCard,
  Wallet,
  Tag,
  Car,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  UserCircle,
  KeySquare,
  Building2,
  Receipt,
  FileText,
  FileSpreadsheet,
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
  minRole?: Role;
}

const VIEWS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/overview", label: "Overview", icon: CalendarRange },
  { href: "/pl", label: "P&L", icon: LineChart },
  { href: "/breakdowns", label: "Breakdowns", icon: PieChart },
];

const MANAGE: NavItem[] = [
  { href: "/bookings", label: "Bookings", icon: BookOpen },
  { href: "/stop-sale", label: "Stop Sale", icon: Ban },
  { href: "/materialization", label: "Materialization", icon: Layers },
  { href: "/system/parameters", label: "System Parameters", icon: SlidersHorizontal, minRole: "MANAGER" },
];

const REPORTS: NavItem[] = [
  { href: "/reports/hotel-arrivals",      label: "Hotel Arrivals",       icon: ClipboardList },
  { href: "/reports/arrival-transfers",   label: "Arrival Transfers",    icon: Car },
  { href: "/reports/departure-transfers", label: "Departure Transfers",  icon: Car },
  { href: "/reports/booking-finance",     label: "Booking Finance",      icon: TrendingUp },
  { href: "/reports/invoices-review",     label: "Invoices Review",      icon: Receipt },
  { href: "/reports/jumbo-invoices",      label: "Jumbo Invoices",       icon: FileText },
  { href: "/reports/soa-statement",       label: "SOA Statement",        icon: FileSpreadsheet },
  { href: "/reports/hotel-payment",       label: "Hotel Payment",        icon: Wallet },
  { href: "/reports/payment-options",     label: "Payment Options",      icon: CreditCard },
  { href: "/reports/ebd-list",            label: "EBD List",             icon: Tag },
];

const SETTINGS: NavItem[] = [
  { href: "/system/company",     label: "Company",           icon: Building2,          adminOnly: true },
  { href: "/system/permissions", label: "Permissions",       icon: ShieldCheck,        adminOnly: true },
  { href: "/system/license",     label: "License",           icon: KeySquare,          adminOnly: true },
  { href: "/system/audit",       label: "Audit Trail",       icon: ShieldCheck,        adminOnly: true },
  { href: "/users",              label: "Users",             icon: Users,              adminOnly: true },
];

function NavGroup({
  title,
  items,
  role,
  pathname,
  onNavigate,
  collapsed,
}: {
  title: string;
  items: NavItem[];
  role: Role;
  pathname: string;
  onNavigate: () => void;
  collapsed: boolean;
}) {
  const visible = items.filter((i) =>
    (!i.adminOnly || role === "ADMIN") && (!i.minRole || hasRole(role, i.minRole)),
  );
  if (visible.length === 0) return null;

  return (
    <div className={cn("py-1", collapsed ? "px-1" : "px-2")}>
      {!collapsed && (
        <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {title}
        </p>
      )}
      {collapsed && <div className="pb-1 pt-3" />}
      <nav className="space-y-0.5">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md transition-colors",
                collapsed
                  ? "justify-center p-2.5"
                  : "gap-2.5 px-2.5 py-2 text-sm",
                active
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
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
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const sysConfig = useQuery({ queryKey: ["system-config"], queryFn: () => get<Record<string, string>>("/system-config"), staleTime: 5 * 60 * 1000 });
  const companyName = sysConfig.data?.companyName ?? "";

  // Restore persisted sidebar + theme state
  useEffect(() => {
    const c = localStorage.getItem("sidebar-collapsed");
    if (c === "true") setCollapsed(true);
    const t = localStorage.getItem("theme") as "dark" | "light" | null;
    if (t) setTheme(t);
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

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
      setSearch("");
      setMobileOpen(false);
    }
  }

  const navProps = { role, pathname, onNavigate: () => setMobileOpen(false), collapsed: false };

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand header — same height as topbar */}
      <div className={cn(
        "flex h-14 shrink-0 items-center border-b border-border",
        collapsed ? "justify-center px-2" : "gap-2 px-3",
      )}>
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={theme === "dark" ? "/favicon.svg" : "/favicon-color.svg"}
            alt="iTour"
            className="size-8 object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
            alt="iTour"
            className="h-8 min-w-0 flex-1 object-contain"
          />
        )}
        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:flex"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      {/* Scrollable nav groups */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <NavGroup title="Views"   items={VIEWS}   {...navProps} collapsed={collapsed} />
        <NavGroup title="Manage"  items={MANAGE}  {...navProps} collapsed={collapsed} />
        <NavGroup title="Reports" items={REPORTS} {...navProps} collapsed={collapsed} />
      </div>

      {/* Settings — pinned bottom, admin only */}
      {role === "ADMIN" && (
        <div className="shrink-0 border-t border-border">
          <NavGroup title="Settings" items={SETTINGS} {...navProps} collapsed={collapsed} />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-slate-200 dark:bg-card transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-slate-200 dark:bg-card shadow-xl animate-fade-in">
            <div className="flex h-full flex-col">
              <div className="flex h-14 items-center gap-3 border-b border-border px-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
                  alt="iTour"
                  className="h-8 w-auto flex-1 object-contain object-left"
                />
                <button onClick={() => setMobileOpen(false)} className="shrink-0 p-1 text-muted-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <NavGroup title="Views"   items={VIEWS}   role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} collapsed={false} />
                <NavGroup title="Manage"  items={MANAGE}  role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} collapsed={false} />
                <NavGroup title="Reports" items={REPORTS} role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} collapsed={false} />
              </div>
              {role === "ADMIN" && (
                <div className="shrink-0 border-t border-border">
                  <NavGroup title="Settings" items={SETTINGS} role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} collapsed={false} />
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-slate-100/95 dark:bg-card/95 px-3 backdrop-blur-sm sm:px-5">
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
            {companyName ? `${companyName} | iTour Reservations LITE` : "iTour Reservations LITE"}
          </span>

          <form onSubmit={onSearch} className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Operator Reference…"
              aria-label="Search by operator reference"
              className="pl-8"
            />
          </form>

          <div className="flex shrink-0 items-center gap-1">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
            >
              {theme === "dark"
                ? <Sun className="size-4" />
                : <Moon className="size-4" />
              }
            </Button>

            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-tight">{user.name}</p>
            </div>
            <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
            <Link href="/profile" title="My Profile">
              <Button variant="ghost" size="icon" aria-label="My profile">
                <UserCircle className="size-4" />
              </Button>
            </Link>
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

        <footer className="flex h-14 shrink-0 items-center justify-end gap-3 border-t border-border bg-slate-100/95 dark:bg-card/95 px-5 text-xs text-muted-foreground backdrop-blur-sm">
          <span>iTour Reservations LITE</span>
          <span className="text-border">|</span>
          <span>Developed by{" "}
            <a href="https://wa.me/+201002805139" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline">
              Mohamed Gouda
            </a>
          </span>
          <span className="text-border">|</span>
          <span>v0.1.0</span>
        </footer>
      </div>
    </div>
  );
}
