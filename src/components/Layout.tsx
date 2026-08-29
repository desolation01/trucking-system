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
  Wifi,
  WifiOff,
  Truck,
  Users,
  Wallet,
  Users2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useStore, registerCloudErrorHandler } from "../lib/store";
import { useTheme } from "../lib/theme";
import { useToast } from "../lib/toast";
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
  { key: "dashboard", label: "Reports", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["owner", "staff", "accountant"], section: "ops" },
  { key: "trips", label: "Trips", icon: <Truck className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "employees", label: "Employees", icon: <Users className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "vehicles", label: "Vehicles", icon: <Car className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "customers", label: "Customers", icon: <Users2 className="h-4 w-4" />, roles: ["owner", "staff"], section: "ops" },
  { key: "diesel", label: "Diesel Distribution", icon: <Fuel className="h-4 w-4" />, roles: ["owner", "staff", "accountant"], section: "ops" },
  { key: "payroll", label: "Payroll", icon: <Wallet className="h-4 w-4" />, roles: ["owner", "accountant"], section: "admin" },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, roles: ["owner"], section: "admin" },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand shadow-sm">
        <Truck className="h-5 w-5 text-on-brand" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold tracking-tight text-ink">FastHaul</p>
        <p className="text-[11px] font-medium text-muted">Fleet Operations</p>
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
    trip: "text-amber-600",
    employee: "text-brand",
    vehicle: "text-cyan-600",
    customer: "text-emerald-600",
  };

  const go = (r: SearchResult) => {
    onNavigate(r.page);
    onClose();
  };

  useEffect(() => setActive(0), [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[10vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search FastHaul"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-card shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            aria-label="Search trips, drivers, plates, customers, or pages"
            role="combobox"
            aria-controls="command-search-results"
            aria-expanded="true"
            aria-activedescendant={results[active] ? `command-result-${results[active].id}` : undefined}
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
            className="w-full bg-transparent py-3.5 text-sm font-medium text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <div id="command-search-results" role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto p-2">
          <p className="sr-only" aria-live="polite">{results.length} result{results.length === 1 ? "" : "s"}</p>
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs font-medium text-muted">No matches for “{q}”</p>
          )}
          {results.map((r, i) => (
            <button
              id={`command-result-${r.id}`}
              key={r.id}
              role="option"
              aria-selected={i === active}
              onClick={() => go(r)}
              onMouseEnter={() => setActive(i)}
              className={cx(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                i === active ? "bg-sky-50" : ""
              )}
            >
              <span className={cx("w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em]", kindIcon[r.kind])}>
                {r.kind}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{r.title}</span>
                <span className="block truncate text-xs font-medium text-muted">{r.sub}</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">→ {r.page}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-edge px-4 py-2.5 text-[11px] font-medium text-muted">
          <span><kbd className="rounded-md bg-card-soft px-1.5 py-0.5 font-sans text-[10px] font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="rounded-md bg-card-soft px-1.5 py-0.5 font-sans text-[10px] font-semibold">↵</kbd> open</span>
          <span><kbd className="rounded-md bg-card-soft px-1.5 py-0.5 font-sans text-[10px] font-semibold">esc</kbd> close</span>
          <span className="ml-auto"><kbd className="rounded-md bg-card-soft px-1.5 py-0.5 font-sans text-[10px] font-semibold">⌘K</kbd> search</span>
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
    { label: `${scheduled} scheduled`, dot: "bg-sky-400", show: scheduled > 0 },
    { label: `${ongoing} on the road`, dot: "bg-amber-400", show: ongoing > 0 },
    { label: `${completed} completed`, dot: "bg-emerald-400", show: completed > 0 },
    { label: `${cancelled} cancelled`, dot: "bg-red-400", show: cancelled > 0 },
    { label: `${inactiveVehicles} vehicle${inactiveVehicles === 1 ? "" : "s"} offline`, dot: "bg-muted", show: inactiveVehicles > 0 },
  ].filter((c) => c.show);

  if (chips.length === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Today</span>
      {chips.map((c) => (
        <span
          key={c.label}
          className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-ink-soft shadow-card"
        >
          <span className={cx("h-2 w-2 rounded-full", c.dot)} />
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const setConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", setConnection);
    window.addEventListener("offline", setConnection);
    return () => {
      window.removeEventListener("online", setConnection);
      window.removeEventListener("offline", setConnection);
    };
  }, []);

  // Register cloud error handler to surface Supabase failures as toasts
  useEffect(() => {
    registerCloudErrorHandler((message) => {
      toast(`Cloud sync: ${message}`, "error");
    });
    return () => registerCloudErrorHandler(null);
  }, [toast]);

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
        <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
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
                "group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200", 
                active
                  ? "bg-brand text-on-brand shadow-sm"
                  : "text-ink-soft hover:bg-card-soft hover:text-ink"
              )}
            >
              <span className={cx("shrink-0", active ? "text-on-brand" : "text-muted group-hover:text-ink")}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    );

  const sidebar = (
    <div className="flex h-full flex-col border-r border-edge bg-card text-ink">
      <div className="flex items-center px-5 pb-4 pt-6">
        <Brand />
      </div>
      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
        {renderSection(opsItems, "Operations")}
        {renderSection(adminItems, "Administration")}
      </nav>
      <div className="flex items-center gap-3 border-t border-edge px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-brand">
          {user?.name?.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
          <p className="truncate text-[11px] font-medium text-muted">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-surface">
      <a href="#main-content" className="sr-only rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110]">
        Skip to main content
      </a>
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside id="mobile-navigation" className="absolute left-0 top-0 h-full w-64 shadow-dropdown">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-edge bg-card/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls={open ? "mobile-navigation" : undefined}
            className="rounded-lg p-2 text-ink transition-colors hover:bg-card-soft lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:flex lg:flex-1 lg:justify-center">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex w-full max-w-md items-center gap-2 rounded-full border border-edge bg-card-soft/70 px-4 py-2 text-sm font-medium text-muted transition-all duration-200 hover:border-brand-ring hover:text-ink-soft"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Search trips, drivers, plates…</span>
              <span className="hidden items-center gap-0.5 rounded-md bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:flex">
                <Command className="h-2.5 w-2.5" />K
              </span>
            </button>
          </div>
          <div className="flex-1 lg:hidden" />
          <span
            className={cx("hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex", online ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}
            title={online ? "Browser is online; cloud sync depends on the configured backend" : "Offline; changes use local storage until you reconnect"}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline"}
          </span>
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-card-soft hover:text-ink"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-600">
              {user?.role}
            </span>
            <button
              onClick={logout}
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-soft hover:text-ink lg:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-card-soft hover:text-ink lg:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <OperationsStrip />
            {children}
          </div>
        </main>
      </div>
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={onNavigate} />
    </div>
  );
}
