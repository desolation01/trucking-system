import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { subDays, differenceInCalendarDays } from "date-fns";
import { TrendingDown, TrendingUp, Truck, Wallet, Coins, ArrowRight, Clock3, XCircle, CheckCircle } from "lucide-react";
import { useStore, useStoreLoading } from "../lib/store";
import {
  buildSeries,
  computeKpis,
  driverLeaders,
  expenseBreakdown,
  pickGranularity,
  rangeFor,
  tripsInRange,
  vehicleBreakdown,
  type QuickRange,
  type Range,
} from "../lib/analytics";
import { Card, Delta, Select, Skeleton, SkeletonCard, Sparkline, cx, statusTone, Badge } from "../components/ui";
import { peso, peso0, fmtTime } from "../lib/format";
import type { PageKey } from "../components/Layout";

const COLORS = ["#f59e0b", "#38bdf8", "#34d399", "#a78bfa", "#f472b6", "#94a3b8"];
const GRID_STROKE = "rgba(42, 49, 66, 0.4)";
const TICK_FILL = "#6b7280";

const rangeOptions: Array<{ key: QuickRange; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
];

function prevRange(range: Range): Range {
  const days = differenceInCalendarDays(range.end, range.start) + 1;
  return { start: subDays(range.start, days), end: subDays(range.start, 1), label: `Prev ${range.label}` };
}

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const data = useStore();
  const loading = useStoreLoading();
  const [forceShow, setForceShow] = useState(false);
  const [quick, setQuick] = useState<QuickRange>("month");

  // Force show dashboard after 2s even if Supabase is still loading
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setForceShow(true), 2000);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const showSkeleton = loading && !forceShow;
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");

  const range = rangeFor(quick);
  const pRange = prevRange(range);

  const filteredTrips = useMemo(
    () =>
      tripsInRange(data, range).filter((t) => {
        if (vehicleFilter && data.vehicles.find((v) => v.id === t.vehicle_id)?.type !== vehicleFilter)
          return false;
        if (driverFilter && t.driver_id !== driverFilter) return false;
        return true;
      }),
    [data, range, vehicleFilter, driverFilter]
  );
  const prevFiltered = useMemo(
    () =>
      tripsInRange(data, pRange).filter((t) => {
        if (vehicleFilter && data.vehicles.find((v) => v.id === t.vehicle_id)?.type !== vehicleFilter)
          return false;
        if (driverFilter && t.driver_id !== driverFilter) return false;
        return true;
      }),
    [data, pRange, vehicleFilter, driverFilter]
  );

  const kpis = useMemo(() => computeKpis(filteredTrips), [filteredTrips]);
  const prevKpis = useMemo(() => computeKpis(prevFiltered), [prevFiltered]);
  const granularity = pickGranularity(range);
  const series = useMemo(() => buildSeries(filteredTrips, range, granularity), [filteredTrips, range, granularity]);
  const vBreakdown = useMemo(() => vehicleBreakdown(filteredTrips, data), [filteredTrips, data]);
  const eBreakdown = useMemo(() => expenseBreakdown(filteredTrips), [filteredTrips]);
  const leaders = useMemo(() => driverLeaders(filteredTrips, data), [filteredTrips, data]);

  const pct = (cur: number, prev: number): number | null => (prev === 0 ? null : ((cur - prev) / prev) * 100);

  const chartTooltip = (formatter: (v: number) => string) => ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-edge bg-card px-4 py-3 text-xs shadow-dropdown">
        <p className="mb-1.5 font-medium text-ink">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
            <span className="capitalize text-muted">{String(p.name).replace("_", " ")}:</span>
            <span className="tnum font-semibold text-ink">{formatter(p.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  const axisProps = { tick: { fontSize: 11, fill: TICK_FILL }, tickLine: false, axisLine: false } as const;

  return (
    <div className="space-y-5">
      {showSkeleton ? (
        <div className="space-y-5">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="h-80 rounded-lg" />
            </div>
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-edge bg-card p-1 shadow-card">
          {rangeOptions.map((o) => (
            <button
              key={o.key}
              onClick={() => setQuick(o.key)}
              className={cx(
                "tnum rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                quick === o.key
                  ? "bg-brand text-on-brand shadow-glow"
                  : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="w-44 py-1.5 text-xs">
            <option value="">All vehicle types</option>
            {data.vehicleTypes.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
          <Select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="w-48 py-1.5 text-xs">
            <option value="">All drivers</option>
            {data.employees.filter((e) => e.role === "driver" && e.status === "active").map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Coins className="h-5 w-5" />}
          label="Total Gross"
          value={peso0(kpis.gross)}
          tone="green"
          delta={pct(kpis.gross, prevKpis.gross)}
          spark={series.map((s) => s.gross)}
          sparkColor="#34d399"
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total Expense"
          value={peso0(kpis.expense)}
          delta={pct(kpis.expense, prevKpis.expense)}
          spark={series.map((s) => s.expense)}
          sparkColor="#f87171"
          tone="red"
        />
        <KpiCard
          icon={kpis.profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          label="Total Profit"
          value={peso0(kpis.profit)}
          tone="green"
          delta={pct(kpis.profit, prevKpis.profit)}
          spark={series.map((s) => s.profit)}
          sparkColor="#2dd4bf"
          sub={`${kpis.avgProfit >= 0 ? "avg" : "avg"} ${peso0(kpis.avgProfit)} / trip`}
        />
        <KpiCard
          icon={<Truck className="h-5 w-5" />}
          label="Total Trips"
          value={String(kpis.trips)}
          delta={pct(kpis.trips, prevKpis.trips)}
          spark={series.map((s) => s.trips)}
          sparkColor="#38bdf8"
          tone="cyan"
          sub={`${kpis.cancelled} cancelled`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Income vs Expense" subtitle={range.label}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => `₱${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip content={chartTooltip((v) => peso(v))} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="gross" name="Income" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Expense" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Gross by Vehicle Type" subtitle="Share of gross revenue">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={vBreakdown} dataKey="gross" nameKey="type" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {vBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={chartTooltip((v) => peso(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {vBreakdown.map((v, i) => (
              <div key={v.type} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  {v.type}
                </span>
                <span className="tnum font-medium text-ink">{peso0(v.gross)}</span>
              </div>
            ))}
            {vBreakdown.length === 0 && <p className="text-center text-xs text-muted">No data</p>}
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Profit Trend" subtitle="Profit over selected period">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => `₱${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip content={chartTooltip((v) => peso(v))} />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#2dd4bf" strokeWidth={2} fill="url(#profitGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Expense Breakdown" subtitle="By category">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={eBreakdown} dataKey="amount" nameKey="category" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {eBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={chartTooltip((v) => peso(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {eBreakdown.map((e, i) => (
              <div key={e.category} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  {e.category}
                </span>
                <span className="tnum font-medium text-ink">{peso0(e.amount)}</span>
              </div>
            ))}
            {eBreakdown.length === 0 && <p className="text-center text-xs text-muted">No expenses</p>}
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Trip Volume" subtitle="Trips over selected period">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={chartTooltip((v) => String(v))} />
                <Line type="monotone" dataKey="trips" name="Trips" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Top Drivers"
          subtitle="By profit generated"
          actions={
            <button onClick={() => onNavigate("payroll")} className="flex items-center gap-1 text-xs font-medium text-amber-500 dark:text-amber-400 hover:underline">
              Payroll <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="space-y-3">
            {leaders.slice(0, 6).map((d, i) => (
              <div key={d.id} className="flex items-center gap-3">
                <span
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold",
                    i === 0 ? "bg-brand text-on-brand" : "bg-ink/5 text-ink-soft"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                  <p className="tnum text-[11px] text-muted">{d.trips} trips · {peso0(d.gross)} gross</p>
                </div>
                <span className={cx("tnum text-sm font-semibold", d.profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                  {peso0(d.profit)}
                </span>
              </div>
            ))}
            {leaders.length === 0 && <p className="py-6 text-center text-xs text-muted">No trip data in range</p>}
          </div>
        </Card>

        <Card
          title="Active & Delayed"
          subtitle="Non-completed trips in period"
          className="lg:col-span-3"
        >
          {filteredTrips.filter((t) => t.status !== "completed").length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-center text-xs text-muted">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> All trips completed in this period.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTrips
                .filter((t) => t.status !== "completed")
                .slice(0, 9)
                .map((t) => {
                  const driver = data.employees.find((e) => e.id === t.driver_id);
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-edge/70 bg-card-soft px-3 py-2.5">
                      {t.status === "cancelled" ? (
                        <XCircle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                      ) : (
                        <Clock3 className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="tnum truncate text-sm font-medium text-ink">{t.transportify_id}</p>
                        <p className="truncate text-[11px] text-muted">
                          {driver?.name ?? "—"} · {fmtTime(t.date_time)}
                        </p>
                      </div>
                      <Badge tone={statusTone(t.status)} dot>{t.status}</Badge>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>
          </>
        )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  delta,
  spark,
  sparkColor,
  tone = "amber",
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  spark: number[];
  sparkColor: string;
  tone?: "amber" | "cyan" | "green" | "red";
  sub?: string;
}) {
  const iconTones = {
    amber: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
    cyan: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-400",
    green: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    red: "bg-red-500/15 text-red-500 dark:text-red-400",
  };
  return (
    <div className="group rounded-xl border border-edge bg-card p-5 shadow-card transition-all duration-200 hover:border-edge-strong hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconTones[tone])}>{icon}</div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
            <p className="tnum font-display text-xl font-bold tracking-tight text-ink">{value}</p>
          </div>
        </div>
        {delta !== undefined && delta !== null && <Delta value={delta} />}
      </div>
      <div className="mt-3">
        <Sparkline data={spark} stroke={sparkColor} />
      </div>
      {sub && <p className="tnum mt-2 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
