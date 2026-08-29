import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { subDays, differenceInCalendarDays } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle,
  Download,
  Truck,
  TrendingUp,
  Wallet,
  Receipt,
} from "lucide-react";
import { useStore, useStoreLoading } from "../lib/store";
import { buildSeries, computeKpis, driverLeaders, expenseBreakdown, pickGranularity, rangeFor, tripsInRange, vehicleBreakdown, type QuickRange, type Range } from "../lib/analytics";
import { Badge, Button, Field, Select, Skeleton, SkeletonCard, Td, Th, statusTone, cx } from "../components/ui";
import { peso, peso0 } from "../lib/format";
import type { PageKey } from "../components/Layout";

const rangeOptions: Array<{ key: QuickRange; label: string }> = [
  { key: "today", label: "Today" }, { key: "week", label: "This Week" }, { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" }, { key: "year", label: "This Year" },
];

const DONUT_COLORS = [
  "var(--chart-blue)",
  "var(--chart-amber)",
  "var(--chart-teal)",
  "var(--chart-red)",
  "#8fb3f5",
  "#c3c6d4",
];

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--edge)",
  borderRadius: 12,
  boxShadow: "var(--shadow-dropdown)",
  color: "var(--ink)",
  fontSize: 12,
  fontWeight: 600,
  padding: "8px 12px",
};

function prevRange(range: Range): Range {
  const days = differenceInCalendarDays(range.end, range.start) + 1;
  return { start: subDays(range.start, days), end: subDays(range.start, 1), label: `Prev ${range.label}` };
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const data = useStore();
  const loading = useStoreLoading();
  const [forceShow, setForceShow] = useState(false);
  const [quick, setQuick] = useState<QuickRange>("month");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  useEffect(() => {
    if (!loading) { setForceShow(false); return; }
    const timer = setTimeout(() => setForceShow(true), 2000);
    return () => clearTimeout(timer);
  }, [loading]);

  const range = rangeFor(quick);
  const previous = prevRange(range);
  const filterTrips = (r: Range) => tripsInRange(data, r).filter((t) => {
    const vehicle = data.vehicles.find((v) => v.id === t.vehicle_id);
    return (!vehicleFilter || vehicle?.type === vehicleFilter) && (!driverFilter || t.driver_id === driverFilter);
  });
  const filteredTrips = useMemo(() => filterTrips(range), [data, range, vehicleFilter, driverFilter]);
  const previousTrips = useMemo(() => filterTrips(previous), [data, previous, vehicleFilter, driverFilter]);
  const kpis = useMemo(() => computeKpis(filteredTrips), [filteredTrips]);
  const previousKpis = useMemo(() => computeKpis(previousTrips), [previousTrips]);
  const series = useMemo(() => buildSeries(filteredTrips, range, pickGranularity(range)), [filteredTrips, range]);
  const vehicles = useMemo(() => vehicleBreakdown(filteredTrips, data), [filteredTrips, data]);
  const expenses = useMemo(() => expenseBreakdown(filteredTrips), [filteredTrips]);
  const leaders = useMemo(() => driverLeaders(filteredTrips, data), [filteredTrips, data]);
  const completedTrips = useMemo(() => filteredTrips.filter((t) => t.status === "completed"), [filteredTrips]);
  const previousCompletedTrips = useMemo(() => previousTrips.filter((t) => t.status === "completed"), [previousTrips]);
  const completedProfit = useMemo(() => completedTrips.reduce((sum, t) => sum + t.gross - t.total_expense - t.driver_commission - t.helper_commission, 0), [completedTrips]);
  const averageCompletedProfit = completedTrips.length ? completedProfit / completedTrips.length : 0;
  const pct = (current: number, previousValue: number) => previousValue === 0 ? null : ((current - previousValue) / previousValue) * 100;
  const showSkeleton = loading && !forceShow;

  const recentTrips = useMemo(
    () => [...filteredTrips].sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()).slice(0, 6),
    [filteredTrips]
  );

  const donutData = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
    if (sorted.length <= 4) return sorted;
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3).reduce((sum, e) => sum + e.amount, 0);
    return [...top, { category: "Other", amount: rest }];
  }, [expenses]);

  const attention = useMemo(() => {
    const items: Array<{ id: string; label: string; detail: string; action: string; page: PageKey; tone: "amber" | "red" | "slate" }> = [];
    const delayed = filteredTrips.filter((t) => t.status === "ongoing");
    if (delayed.length > 0) items.push({ id: "ongoing", label: `${delayed.length} trip${delayed.length === 1 ? "" : "s"} on the road`, detail: "Review active deliveries", action: "Open trips", page: "trips", tone: "amber" });
    const cancelled = filteredTrips.filter((t) => t.status === "cancelled");
    if (cancelled.length > 0) items.push({ id: "cancelled", label: `${cancelled.length} cancelled trip${cancelled.length === 1 ? "" : "s"}`, detail: "Follow up with customer or driver", action: "Review trips", page: "trips", tone: "red" });
    const offline = data.vehicles.filter((v) => v.status === "inactive");
    if (offline.length > 0) items.push({ id: "offline", label: `${offline.length} vehicle${offline.length === 1 ? "" : "s"} offline`, detail: "Check fleet availability", action: "View fleet", page: "vehicles", tone: "slate" });
    const unassigned = filteredTrips.filter((t) => !t.driver_id || !t.vehicle_id);
    if (unassigned.length > 0) items.push({ id: "unassigned", label: `${unassigned.length} trip${unassigned.length === 1 ? "" : "s"} missing assignment`, detail: "Assign a driver and vehicle", action: "Assign trips", page: "trips", tone: "amber" });
    return items.slice(0, 4);
  }, [data, filteredTrips]);

  const downloadReport = () => {
    const rows = [["Trip ID", "Date", "Status", "Gross", "Expense", "Profit"], ...filteredTrips.map((t) => [t.transportify_id, t.date_time, t.status, t.gross, t.total_expense, t.gross - t.total_expense - t.driver_commission - t.helper_commission])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `fast haul-report-${quick}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  if (showSkeleton) return <div className="space-y-6"><div className="flex gap-2"><Skeleton className="h-10 w-28 rounded-xl" /><Skeleton className="h-10 w-28 rounded-xl" /><Skeleton className="h-10 w-28 rounded-xl" /></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div><Skeleton className="h-96 rounded-[20px]" /></div>;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">Reports</h1>
          <p className="mt-1 text-sm font-medium text-muted">Financial overview of your operations</p>
        </div>
        <Button onClick={downloadReport} disabled={!filteredTrips.length}>
          <Download className="h-4 w-4" /> Download Report
        </Button>
      </div>

      {/* Filter row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Reporting Period">
          <Select id="filter-period" aria-label="Reporting period" value={quick} onChange={(e) => setQuick(e.target.value as QuickRange)}>
            {rangeOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Vehicle Type">
          <Select id="filter-vehicle" aria-label="Vehicle type" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="">All Types</option>
            {data.vehicleTypes.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Driver">
          <Select id="filter-driver" aria-label="Driver" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
            <option value="">All Drivers</option>
            {data.employees.filter((e) => e.role === "driver" && e.status === "active").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>
      </div>

      {attention.length > 0 && (
        <section className="rounded-[20px] bg-card p-5 shadow-card" aria-labelledby="attention-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle className="h-4 w-4" /></span>
              <div>
                <h2 id="attention-heading" className="text-base font-semibold text-ink">Attention needed</h2>
                <p className="text-xs font-medium text-muted">Operational items worth reviewing</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">{attention.length} open</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {attention.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-card-soft px-3.5 py-3">
                <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", item.tone === "red" ? "bg-red-500" : item.tone === "amber" ? "bg-amber-500" : "bg-muted")} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.label}</p>
                  <p className="truncate text-xs font-medium text-muted">{item.detail}</p>
                </div>
                <button type="button" onClick={() => onNavigate(item.page)} className="min-h-11 rounded-lg px-3 text-xs font-semibold text-brand transition-colors hover:bg-card hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{item.action}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Gross"
          value={peso0(kpis.gross)}
          delta={pct(kpis.gross, previousKpis.gross)}
          icon={<Wallet className="h-5 w-5" />}
          tile="bg-sky-50 text-brand"
          caption={`vs previous ${range.label.toLowerCase()}`}
        />
        <MetricCard
          label="Net Profit"
          value={peso0(kpis.profit)}
          delta={pct(kpis.profit, previousKpis.profit)}
          icon={<TrendingUp className="h-5 w-5" />}
          tile="bg-emerald-50 text-emerald-600"
          caption={`avg ${peso0(averageCompletedProfit)} / completed trip`}
        />
        <MetricCard
          label="Total Expense"
          value={peso0(kpis.expense)}
          delta={pct(kpis.expense, previousKpis.expense)}
          icon={<Receipt className="h-5 w-5" />}
          tile="bg-amber-50 text-amber-600"
          caption={kpis.expense === 0 ? "No expenses recorded" : `${expenses.length} categor${expenses.length === 1 ? "y" : "ies"}`}
        />
        <MetricCard
          label="Total Trips"
          value={String(kpis.trips)}
          delta={pct(completedTrips.length, previousCompletedTrips.length)}
          icon={<Truck className="h-5 w-5" />}
          tile="bg-violet-50 text-violet-600"
          caption={`${completedTrips.length} completed · ${kpis.cancelled} cancelled`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Income vs Expense */}
        <div className="flex min-h-0 flex-col rounded-[20px] bg-card p-5 shadow-card lg:col-span-2 lg:h-[420px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">Income vs Expense</h3>
              <p className="mt-0.5 text-xs font-medium text-muted">{range.label}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex rounded-lg bg-card-soft p-0.5" role="group" aria-label="Chart type">
                {(["line", "bar"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setChartType(type)}
                    aria-pressed={chartType === type}
                    className={cx(
                      "min-h-11 rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      chartType === type ? "bg-card text-brand shadow-sm" : "text-muted hover:text-ink-soft"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <span className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-blue)]" /> Gross
                </span>
                <span className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-teal)]" /> Expenses
                </span>
              </div>
            </div>
          </div>
          {series.length === 0 || !filteredTrips.length ? (
            <Empty message="No trip activity in this period." />
          ) : (
            <div className="min-h-0 flex-1 pt-4" role="img" aria-label={`Activity chart showing ${filteredTrips.length} trips, ${peso0(kpis.gross)} gross revenue and ${peso0(kpis.expense)} expenses`}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)", fontWeight: 500 }} tickLine={false} axisLine={false} dy={8} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <Tooltip formatter={(v: number) => peso(v)} contentStyle={tooltipStyle} cursor={{ stroke: "var(--edge-strong)", strokeDasharray: "4 4" }} />
                    <Line type="monotone" dataKey="gross" name="Gross revenue" stroke="var(--chart-blue)" strokeWidth={3} strokeLinecap="round" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
                    <Line type="monotone" dataKey="expense" name="Expense" stroke="var(--chart-teal)" strokeWidth={3} strokeLinecap="round" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
                  </LineChart>
                ) : (
                  <BarChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)", fontWeight: 500 }} tickLine={false} axisLine={false} dy={8} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <Tooltip formatter={(v: number) => peso(v)} contentStyle={tooltipStyle} cursor={{ fill: "var(--brand-soft)" }} />
                    <Bar dataKey="gross" name="Gross revenue" fill="var(--chart-blue)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="expense" name="Expense" fill="var(--chart-teal)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Expense Breakdown donut */}
        <div className="flex min-h-0 flex-col rounded-[20px] bg-card p-5 shadow-card">
          <div>
            <h3 className="text-base font-semibold text-ink">Expense Breakdown</h3>
            <p className="mt-0.5 text-xs font-medium text-muted">{range.label} allocation</p>
          </div>
          {donutData.length === 0 ? (
            <Empty message="No expenses recorded in this period." />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 pt-2">
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius="70%"
                      outerRadius="96%"
                      paddingAngle={3}
                      cornerRadius={8}
                      strokeWidth={0}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="tnum text-lg font-bold text-ink">{peso0(kpis.expense)}</span>
                  <span className="text-[11px] font-medium text-muted">Total Expense</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {donutData.map((e, i) => (
                  <span key={e.category} className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="truncate">{e.category}</span>
                    <span className="tnum ml-auto text-muted">{kpis.expense ? Math.round((e.amount / kpis.expense) * 100) : 0}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard title="Top Drivers" subtitle="Ranked by profit" actions={
          <button onClick={() => onNavigate("payroll")} className="text-xs font-semibold text-brand hover:underline">
            View Payroll
          </button>
        }>
          {leaders.length === 0 ? (
            <Empty message="No driver data in this period." />
          ) : (
            <div className="flex flex-col">
              {leaders.slice(0, 4).map((leader, index) => (
                <div key={leader.id} className="flex items-center gap-3 border-b border-edge py-3 transition-colors last:border-b-0">
                  <span className={cx(
                    "tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    index === 0 ? "bg-sky-50 text-brand" : "bg-card-soft text-muted"
                  )}>
                    {index + 1}
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-soft text-xs font-semibold text-ink-soft">
                    {initials(leader.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{leader.name}</p>
                    <p className="truncate text-xs font-medium text-muted">{leader.trips} trips · {peso0(leader.gross)} gross</p>
                  </div>
                  <span className={cx("tnum text-sm font-semibold", leader.profit >= 0 ? "text-emerald-600" : "text-red-600")}>{peso0(leader.profit)}</span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard title="Strongest Vehicle Types" subtitle="Ranked by gross revenue">
          {vehicles.length === 0 ? (
            <Empty message="No vehicle data in this period." />
          ) : (
            <div className="flex flex-col gap-4 pt-1">
              {[...vehicles].sort((a, b) => b.gross - a.gross).slice(0, 4).map((v) => (
                <div key={v.type}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-4 text-xs">
                    <span className="font-medium text-ink">{v.type}</span>
                    <span className="tnum font-medium text-muted">{peso0(v.gross)}</span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-card-soft"
                    role="progressbar"
                    aria-label={`${v.type}: ${kpis.gross ? Math.round((v.gross / kpis.gross) * 100) : 0} percent of gross revenue`}
                    aria-valuenow={Math.round(kpis.gross ? (v.gross / kpis.gross) * 100 : 0)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${kpis.gross ? Math.min((v.gross / kpis.gross) * 100, 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      {/* Recent Trips */}
      <PanelCard
        title="Recent Trips"
        actions={
          <button onClick={() => onNavigate("trips")} className="text-xs font-semibold text-brand hover:underline">
            View All
          </button>
        }
      >
        {recentTrips.length === 0 ? (
          <Empty icon={<CheckCircle className="h-5 w-5" />} message="No trips in this period." />
        ) : (
          <div className="-mx-2 overflow-x-auto">
             <table className="w-full min-w-[560px] border-separate border-spacing-0" aria-label="Recent trips">
              <thead>
                <tr>
                  <Th>Trip ID</Th>
                  <Th>Driver</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {recentTrips.map((t) => {
                  const driver = data.employees.find((e) => e.id === t.driver_id);
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-card-soft/60">
                      <Td className="rounded-l-xl font-semibold text-brand">{t.transportify_id}</Td>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-soft text-[11px] font-semibold text-ink-soft">
                            {driver ? initials(driver.name) : "—"}
                          </span>
                          <span className="text-ink">{driver?.name ?? "Unassigned"}</span>
                        </span>
                      </Td>
                      <Td>{t.customer_name ?? t.customer_phone}</Td>
                      <Td>
                        <Badge tone={statusTone(t.status)} dot>{t.status === "ongoing" ? "In Transit" : t.status === "completed" ? "Completed" : t.status === "scheduled" ? "Scheduled" : "Cancelled"}</Badge>
                      </Td>
                      <Td className="tnum rounded-r-xl text-right font-semibold text-ink">{peso0(t.gross)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function MetricCard({ label, value, delta, icon, tile, caption }: { label: string; value: string; delta: number | null; icon: React.ReactNode; tile: string; caption: string }) {
  return (
    <div className="flex flex-col justify-between rounded-[20px] bg-card p-5 shadow-card transition-shadow duration-300 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <h3 className={cx("text-[11px] font-semibold uppercase tracking-[0.08em]", "text-muted")}>{label}</h3>
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}>{icon}</span>
      </div>
      <div className="mt-4">
        <div className="tnum font-display text-3xl font-bold tracking-tight text-ink">{value}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {delta !== null && (
            <span className={cx(
              "tnum inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
              delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
          <span className="font-medium text-muted">{caption}</span>
        </div>
      </div>
    </div>
  );
}

function PanelCard({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-[20px] bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3 pb-2">
        <div>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs font-medium text-muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Empty({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex min-h-28 flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm font-medium text-muted">
      {icon || <ArrowUpRight className="h-5 w-5" />}
      <span>{message}</span>
    </div>
  );
}
