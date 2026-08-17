import { useMemo, useState } from "react";
import { Download, Wallet } from "lucide-react";
import { startOfMonth, endOfMonth, startOfDay, endOfDay, format, startOfWeek, endOfWeek, parseISO, subDays } from "date-fns";
import { useStore, useStoreLoading } from "../lib/store";
import { Badge, Button, EmptyState, PageHeader, Select, Td, Th, Skeleton, SkeletonTableRow, cx } from "../components/ui";
import { peso, peso0 } from "../lib/format";
import { useToast } from "../lib/toast";

type PeriodMode = "weekly" | "monthly" | "custom";

interface Row {
  employeeId: string;
  name: string;
  role: string;
  trips: number;
  gross: number;
  commission: number;
  entries: Array<{
    transportify: string;
    date: string;
    gross: number;
    amount: number;
  }>;
}

export function Payroll() {
  const data = useStore();
  const { toast } = useToast();
  const loading = useStoreLoading();
  const now = new Date();

  const [periodMode, setPeriodMode] = useState<PeriodMode>("monthly");
  const [month, setMonth] = useState(format(now, "yyyy-MM"));
  const [weekStart, setWeekStart] = useState(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [customStart, setCustomStart] = useState(format(subDays(now, 30), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(now, "yyyy-MM-dd"));
  const [sortBy, setSortBy] = useState<"commission" | "trips" | "gross">("commission");

  const range = useMemo(() => {
    switch (periodMode) {
      case "weekly": {
        const start = startOfDay(parseISO(weekStart));
        const end = endOfDay(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }));
        return { start, end, label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` };
      }
      case "custom": {
        const start = startOfDay(parseISO(customStart));
        const end = endOfDay(parseISO(customEnd));
        return { start, end, label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` };
      }
      default: {
        const [y, m] = month.split("-").map(Number);
        const start = startOfDay(startOfMonth(new Date(y, m - 1, 1)));
        const end = endOfDay(endOfMonth(new Date(y, m - 1, 1)));
        return { start, end, label: format(start, "MMMM yyyy") };
      }
    }
  }, [periodMode, month, weekStart, customStart, customEnd]);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    const trips = data.trips.filter((t) => {
      const d = new Date(t.date_time);
      return d >= range.start && d <= range.end && t.status === "completed";
    });

    for (const t of trips) {
      const driver = data.employees.find((e) => e.id === t.driver_id);
      if (driver) {
        const row = map.get(driver.id) ?? { employeeId: driver.id, name: driver.name, role: "Driver", trips: 0, gross: 0, commission: 0, entries: [] };
        row.trips += 1;
        row.gross += t.gross;
        row.commission += t.driver_commission;
        row.entries.push({
          transportify: t.transportify_id,
          date: t.date_time,
          gross: t.gross,
          amount: t.driver_commission,
        });
        map.set(driver.id, row);
      }
      for (const hid of t.helper_ids) {
        const helper = data.employees.find((e) => e.id === hid);
        if (!helper) continue;
        const share = t.helper_commission / t.helper_ids.length;
        const row = map.get(helper.id) ?? { employeeId: helper.id, name: helper.name, role: "Helper", trips: 0, gross: 0, commission: 0, entries: [] };
        row.trips += 1;
        row.gross += t.gross / t.helper_ids.length;
        row.commission += share;
        row.entries.push({
          transportify: t.transportify_id,
          date: t.date_time,
          gross: t.gross / t.helper_ids.length,
          amount: share,
        });
        map.set(helper.id, row);
      }
    }

    return [...map.values()].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [data, range, sortBy]);

  const months = useMemo(() => {
    const list: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      list.push(format(d, "yyyy-MM"));
      d.setMonth(d.getMonth() - 1);
    }
    return list;
  }, []);

  const weeks = useMemo(() => {
    const list: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const monday = startOfWeek(d, { weekStartsOn: 1 });
      list.push(format(monday, "yyyy-MM-dd"));
      d.setDate(d.getDate() - 7);
    }
    return list;
  }, []);

  const totalCommissions = rows.reduce((s, r) => s + r.commission, 0);
  const totalSalary = totalCommissions;

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(["Employee", "Role", "Transportify ID", "Trip Date", "Gross", "Salary"].map(esc).join(","));
    for (const r of rows) {
      for (const e of r.entries) {
        lines.push([r.name, r.role, e.transportify, format(new Date(e.date), "yyyy-MM-dd"), e.gross.toFixed(2), e.amount.toFixed(2)].map(esc).join(","));
      }
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${format(range.start, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Payroll exported", "success");
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-48 rounded-lg" /><Skeleton className="h-8 w-64 rounded-lg" /><div className="overflow-hidden rounded-xl border border-edge bg-card"><table className="w-full"><thead><tr>{Array.from({length:6}).map((_,i)=><th key={i} className="px-3 py-2.5"><Skeleton className="h-3 w-16" /></th>)}</tr></thead><tbody>{Array.from({length:5}).map((_,i)=><SkeletonTableRow key={i} cols={6} />)}</tbody></table></div></div>;

  return (
    <div>
      <PageHeader
        title="Payroll & Salary"
        subtitle="Driver and helper earnings from completed trips"
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Period mode */}
        <div className="flex rounded-lg border border-edge bg-card p-0.5">
          {(["weekly", "monthly", "custom"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPeriodMode(mode)}
              className={cx(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 capitalize",
                periodMode === mode ? "bg-brand text-on-brand shadow-glow" : "text-ink-soft hover:text-ink"
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Date inputs */}
        {periodMode === "monthly" && (
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-44">
            {months.map((m) => (
              <option key={m} value={m}>{format(new Date(`${m}-01`), "MMMM yyyy")}</option>
            ))}
          </Select>
        )}
        {periodMode === "weekly" && (
          <Select value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-52">
            {weeks.map((w) => {
              const start = parseISO(w);
              const end = endOfWeek(start, { weekStartsOn: 1 });
              return (
                <option key={w} value={w}>{format(start, "MMM d")} – {format(end, "MMM d, yyyy")}</option>
              );
            })}
          </Select>
        )}
        {periodMode === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink-soft focus:border-brand focus:outline-none" />
            <span className="text-xs text-muted">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink-soft focus:border-brand focus:outline-none" />
          </div>
        )}

        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="w-44">
          <option value="commission">Sort: Salary</option>
          <option value="trips">Sort: Trips</option>
          <option value="gross">Sort: Gross</option>
        </Select>

        <div className="ml-auto rounded-xl bg-panel px-4 py-2.5 text-right shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">Salary · {range.label}</p>
          <p className="tnum text-lg font-bold text-emerald-400">{peso(totalSalary)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-edge bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-card-soft">
              <tr>
                <Th>Employee</Th>
                <Th>Role</Th>
                <Th className="text-right">Trips</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">Salary</Th>
                <Th>Breakdown</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/70">
              {rows.map((r) => (
                <tr key={r.employeeId} className="hover:bg-card-soft transition-colors duration-100">
                  <Td className="font-medium text-ink">{r.name}</Td>
                  <Td>
                    <Badge tone={r.role === "Driver" ? "blue" : "violet"}>{r.role}</Badge>
                  </Td>
                  <Td className="tnum text-right text-ink-soft">{r.trips}</Td>
                  <Td className="tnum text-right text-ink-soft">{peso0(r.gross)}</Td>
                  <Td className="tnum text-right font-semibold text-emerald-400">{peso0(r.commission)}</Td>
                  <Td>
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-amber-500 dark:text-amber-400 hover:underline">
                        View {r.entries.length} trip{r.entries.length !== 1 ? "s" : ""}
                      </summary>
                      <div className="mt-2 max-h-60 overflow-y-auto rounded-lg bg-card-soft p-2 space-y-1.5">
                        {r.entries.slice().reverse().map((e, i) => (
                          <div key={i} className="rounded border border-edge/60 bg-card px-2.5 py-2 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-ink">{e.transportify} · {format(new Date(e.date), "MMM d")}</span>
                              <span className="tnum text-emerald-400 font-medium">{peso0(e.amount)}</span>
                            </div>
                            <div className="mt-1 text-[10px] text-muted">
                              Gross: {peso0(e.gross)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <EmptyState icon={<Wallet className="h-8 w-8" />} title="No completed trips in this period" subtitle="Salary appears here once trips are completed." />
        )}
      </div>
    </div>
  );
}