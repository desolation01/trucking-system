import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Car,
  Command,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Truck,
  Users,
  Wallet,
  Users2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";
import { cx } from "./ui";
import { isSameDay, startOfDay } from "date-fns";

export type PageKey =
  | "dashboard"
  | "trips"
  | "calendar"
  | "employees"
  | "vehicles"
  | "customers"
  | "diesel"
  | "payroll"
  | "settings";

const navItems: Array<{
  key: PageKey;
  label: string;
  icon: ReactNode;
  roles: Array<"owner" | "staff" | "accountant">;
  section: "ops" | "admin";
}> = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["owner", "staff", "accountant"], section: "ops" },
  { key: "trips", label: "Trips", icon: <Truck className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "employees", label: "Employees", icon: <Users className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "vehicles", label: "Vehicles", icon: <Car className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "customers", label: "Customers", icon: <Users2 className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "diesel", label: "Diesel Distribution", icon: <Fuel className="h-4 w-4" />, roles: ["owner", "staff", "accountant"], section: "ops" },
  { key: "payroll", label: "Payroll", icon: <Wallet className="h-4 w-4" />, roles: ["owner", "accountant"], section: "admin" },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, roles: ["owner"], section: "admin" },
];

const titles: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Financial overview of your operations" },
  trips: { title: "Trips", subtitle: "Log and manage all Transportify bookings" },
  calendar: { title: "Operations Calendar", subtitle: "Trip and profit overview by day" },
  employees: { title: "Employees", subtitle: "Drivers, helpers and office staff" },
  vehicles: { title: "Vehicles", subtitle: "Company fleet" },
  customers: { title: "Customers", subtitle: "Auto-tracked from trip phone numbers" },
  diesel: { title: "Diesel Distribution", subtitle: "Distribute fuel costs across trips and deduct from commissions" },
  payroll: { title: "Payroll & Commissions", subtitle: "Driver and helper earnings by period" },
  settings: { title: "Settings", subtitle: "Company profile, vehicle types, commission rules" },
};

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-on-brand shadow-glow transition-all duration-200 hover:shadow-lg">
        <Truck className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-[15px] font-bold tracking-tight text-panel-ink-strong">FastHaul Ops</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-panel-ink/70">Fleet · Dispatch · Payroll</p>
      </div>
    </div>
  );
}

interface SearchResult {
  id: string;
  kind: "page" | "trip" | "employee" | "vehicle" | "customer";
  title: string;
  sub: string;
  page: PageKey;
}

function CommandSearch({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (p: PageKey) => void;
}) {
  const data = useStore();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo<SearchResult[]>(() => {
    const query = q.trim().toLowerCase();
    const list: SearchResult[] = [];
    if (!query) {
      for (const i of navItems) {
        list.push({ id: `page-${i.key}`, kind: "page", title: i.label, sub: "Page", page: i.key });
      }
      return list;
    }
    for (const i of navItems) {
      if (i.label.toLowerCase().includes(query))
        list.push({ id: `page-${i.key}`, kind: "page", title: i.label, sub: "Page", page: i.key });
    }
    for (const t of data.trips.slice(-50).reverse()) {
      const driver = data.employees.find((e) => e.id === t.driver_id);
      if (
        t.transportify_id.toLowerCase().includes(query) ||
        t.customer_phone.includes(query) ||
        (t.customer_name ?? "").toLowerCase().includes(query) ||
        (driver?.name ?? "").toLowerCase().includes(query)
      )
        list.push({
          id: `trip-${t.id}`,
          kind: "trip",
          title: t.transportify_id,
          sub: `${driver?.name ?? "—"} · ${t.customer_phone}`,
          page: "trips",
        });
    }
    for (const e of data.employees) {
      if (e.name.toLowerCase().includes(query))
        list.push({ id: `emp-${e.id}`, kind: "employee", title: e.name, sub: e.role, page: "employees" });
    }
    for (const v of data.vehicles) {
      if (v.plate_number.toLowerCase().includes(query) || v.type.toLowerCase().includes(query))
        list.push({ id: `veh-${v.id}`, kind: "vehicle", title: v.plate_number, sub: v.type, page: "vehicles" });
    }
    for (const c of data.customers) {
      if ((c.name ?? "").toLowerCase().includes(query) || c.phone_number.includes(query))
        list.push({ id: `cust-${c.id}`, kind: "customer", title: c.name ?? c.phone_number, sub: c.phone_number, page: "customers" });
    }
    return list.slice(0, 12);
  }, [q, data]);

  const kindIcon: Record<SearchResult["kind"], string> = {
    page: "text-ink-soft",
    trip: "text-amber-500 dark:text-amber-400",
    employee: "text-sky-500",
    vehicle: "text-cyan-600 dark:text-cyan-400",
    customer: "text-emerald-500 dark:text-emerald-400",
  };

  const go = (r: SearchResult) => {
    onNavigate(r.page);
    onClose();
  };

  useEffect(() => setActive(0), [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-[10vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-edge bg-card shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge/70 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active]);
              }
            }}
            placeholder="Search trips, drivers, plates, customers, pages…"
            className="w-full bg-transparent py-3.5 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted">No matches for “{q}”</p>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => go(r)}
              onMouseEnter={() => setActive(i)}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                i === active ? "bg-brand-soft/60" : ""
              )}
            >
              <span className={cx("w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em]", kindIcon[r.kind])}>
                {r.kind}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                <span className="block truncate text-[11px] text-muted">{r.sub}</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">→ {r.page}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-edge/70 px-4 py-2.5 text-[10px] text-muted">
          <span><kbd className="rounded border border-edge bg-card-soft px-1 font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-edge bg-card-soft px-1 font-sans">↵</kbd> open</span>
          <span><kbd className="rounded border border-edge bg-card-soft px-1 font-sans">esc</kbd> close</span>
          <span className="ml-auto font-medium uppercase tracking-[0.08em]">⌘K search</span>
        </div>
      </div>
    </div>
  );
}

function OperationsStrip() {
  const data = useStore();
  const today = startOfDay(new Date());
  const todayTrips = data.trips.filter((t) => isSameDay(new Date(t.date_time), today));
  const scheduled = todayTrips.filter((t) => t.status === "scheduled").length;
  const ongoing = todayTrips.filter((t) => t.status === "ongoing").length;
  const completed = todayTrips.filter((t) => t.status === "completed").length;
  const cancelled = todayTrips.filter((t) => t.status === "cancelled").length;
  const inactiveVehicles = data.vehicles.filter((v) => v.status === "inactive").length;

  const chips = [
    { label: `${scheduled} scheduled`, tone: "bg-sky-500", show: scheduled > 0 },
    { label: `${ongoing} on the road`, tone: "bg-amber-500", show: ongoing > 0 },
    { label: `${completed} completed`, tone: "bg-emerald-500", show: completed > 0 },
    { label: `${cancelled} cancelled`, tone: "bg-red-500", show: cancelled > 0 },
    { label: `${inactiveVehicles} vehicle${inactiveVehicles === 1 ? "" : "s"} offline`, tone: "bg-slate-400", show: inactiveVehicles > 0 },
  ].filter((c) => c.show);

  if (chips.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-edge/80 bg-card px-3 py-2.5 shadow-sm">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Today</span>
      {chips.map((c) => (
        <span key={c.label} className="flex items-center gap-1.5 rounded-full bg-card-soft px-2.5 py-1 text-[11px] font-medium text-ink-soft">
          <span className={cx("h-1.5 w-1.5 rounded-full", c.tone)} />
          <span className="tnum">{c.label}</span>
        </span>
      ))}
    </div>
  );
}

export function Layout({
  page,
  onNavigate,
  children,
}: {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  children: ReactNode;
}) {
  const { user, logout, can } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = navItems.filter((i) => can(...i.roles));
  const opsItems = items.filter((i) => i.section === "ops");
  const adminItems = items.filter((i) => i.section === "admin");

  const renderSection = (list: typeof opsItems, label: string) =>
    list.length > 0 && (
      <div className="mt-0.5">
        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-panel-ink/50">{label}</p>
        {list.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                onNavigate(item.key);
                setOpen(false);
              }}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group relative flex w-full items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-all duration-150",
                active
                  ? "text-amber-500 dark:text-amber-400"
                  : "text-panel-ink hover:bg-panel-ink/5 hover:text-panel-ink-strong"
              )}
            >
              <span className={cx(
                "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-all duration-150",
                active ? "bg-amber-500 dark:bg-amber-400 opacity-100" : "opacity-0"
              )} />
              <span className={cx(
                "shrink-0 transition-colors duration-150",
                active ? "text-amber-500 dark:text-amber-400" : "text-panel-ink/60 group-hover:text-panel-ink-strong"
              )}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    );

  const sidebar = (
    <div className="flex h-full flex-col bg-panel text-panel-ink">
      <div className="flex items-center px-5 pt-5 pb-4">
        <Brand />
      </div>
      <div className="mx-5 h-[2px] rounded-full bg-panel-edge" />
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {renderSection(opsItems, "Operations")}
        {renderSection(adminItems, "Administration")}
      </nav>
      <div className="border-t border-panel-edge px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg bg-panel-soft px-3 py-2.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 font-display text-sm font-bold text-amber-500 dark:text-amber-400">
            {user?.name?.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-panel-ink-strong">{user?.name}</p>
            <p className="truncate text-[11px] text-panel-ink/70">
              {user?.role === "owner" ? "Owner / Admin" : user?.role === "staff" ? "Office Staff" : "Accountant"}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-2 text-panel-ink/60 transition-all duration-150 hover:bg-panel-ink/10 hover:text-panel-ink-strong active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 shadow-2xl">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-edge bg-card/80 backdrop-blur-sm px-4 py-2.5 lg:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-ink-soft transition-all duration-150 hover:bg-ink/5 active:scale-95 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden min-w-0 lg:block">
            <h1 className="font-display text-base font-bold tracking-tight text-ink">{titles[page].title}</h1>
            <p className="truncate text-[11px] text-muted">{titles[page].subtitle}</p>
          </div>
          <div className="hidden lg:flex lg:flex-1 lg:justify-center">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex w-full max-w-md items-center gap-2 rounded-lg border border-edge bg-card-soft px-3 py-1.5 text-sm text-muted transition-all duration-150 hover:border-edge-strong hover:text-ink-soft"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Search trips, drivers, plates…</span>
              <span className="hidden items-center gap-0.5 rounded border border-edge bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted sm:flex">
                <Command className="h-2.5 w-2.5" />K
              </span>
            </button>
          </div>
          <div className="flex-1 lg:hidden" />
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-lg p-1.5 text-ink-soft transition-all duration-150 hover:bg-ink/5 hover:text-ink active:scale-95"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="rounded-full border border-edge bg-card-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              {user?.role}
            </span>
            <button
              onClick={logout}
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-muted transition-all duration-150 hover:bg-ink/5 hover:text-ink active:scale-95 lg:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          {/* Mobile search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-1.5 text-ink-soft transition-all duration-150 hover:bg-ink/5 active:scale-95 lg:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <OperationsStrip />
            {children}
          </div>
        </main>
      </div>
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={onNavigate} />
    </div>
  );
}
