import { useMemo, useState } from "react";
import {
  addMonths,
  startOfMonth,
  startOfWeek,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameDay,
  addDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore, useStoreLoading } from "../lib/store";
import { Button, Modal, Select, Badge, cx, statusTone, Skeleton } from "../components/ui";
import { peso0, fmtTime } from "../lib/format";
import { getVehicle, getDriver } from "../lib/analytics";
import type { Trip } from "../lib/types";

export function CalendarPage() {
  const data = useStore();
  const loading = useStoreLoading();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [driverFilter, setDriverFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(cursor));

  const days = useMemo(() => {
    const list: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      list.push(d);
      d = addDays(d, 1);
    }
    return list;
  }, [gridStart, gridEnd]);

  const tripsByDay = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const t of data.trips) {
      if (driverFilter && t.driver_id !== driverFilter) continue;
      if (vehicleFilter) {
        const v = getVehicle(t, data);
        if (v?.type !== vehicleFilter) continue;
      }
      const key = format(new Date(t.date_time), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [data, driverFilter, vehicleFilter]);

  const daySummary = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    const trips = tripsByDay.get(key) ?? [];
    const profit = trips.reduce((s, t) => s + (t.gross - t.total_expense), 0);
    return { trips, profit };
  };

  const selectedTrips = selectedDay ? tripsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [] : [];

  const weekDays = useMemo(() => {
    if (view !== "week") return [];
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  const nav = (dir: number) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else setCursor((c) => addDays(c, dir * 7));
  };

  const renderDayCell = (d: Date) => {
    const { trips, profit } = daySummary(d);
    const inMonth = isSameMonth(d, monthStart) || view === "week";
    const isToday = isSameDay(d, new Date());
    const tone = trips.length === 0 ? "bg-card-soft" : profit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10";
    const indicator = trips.length === 0 ? "bg-muted" : profit >= 0 ? "bg-emerald-500" : "bg-red-500";

    return (
      <button
        key={d.toISOString()}
        onClick={() => setSelectedDay(d)}
        className={cx(
          "flex min-h-[74px] flex-col gap-1 p-2 text-left transition-colors hover:bg-brand-soft/60",
          tone,
          !inMonth && "opacity-40"
        )}
      >
        <div className="flex items-center justify-between">
          <span
            className={cx(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
              isToday ? "bg-brand text-on-brand" : "text-ink-soft"
            )}
          >
            {format(d, "d")}
          </span>
          {trips.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-panel px-1.5 text-[10px] font-semibold text-panel-ink-strong tnum">
              {trips.length}
            </span>
          )}
        </div>
        {trips.length > 0 && (
          <div className="mt-auto">
            <p className={cx("tnum text-[11px] font-semibold", profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
              {peso0(profit)}
            </p>
          </div>
        )}
        <span className={cx("h-1 w-4 rounded-full", indicator)} />
      </button>
    );
  };

  const weekHeader = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-80 rounded-lg" /><div className="grid grid-cols-7 gap-1">{Array.from({length:35}).map((_,i)=><Skeleton key={i} className="h-24 rounded-lg" />)}</div></div>;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="secondary" size="sm" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <h2 className="text-lg font-bold text-ink">
          {view === "month"
            ? format(cursor, "MMMM yyyy")
            : `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d")}, ${format(cursor, "yyyy")}`}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-edge">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cx(
                  "px-3 py-1.5 text-xs font-medium capitalize transition-all duration-150",
                  view === v ? "bg-brand text-on-brand" : "bg-card text-ink-soft hover:bg-card-soft"
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="w-40 py-1.5 text-xs">
            <option value="">All drivers</option>
            {data.employees.filter((e) => e.role === "driver").map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="w-44 py-1.5 text-xs">
            <option value="">All vehicle types</option>
            {data.vehicleTypes.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Profitable day</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Loss day</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted" /> No trips</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-edge bg-card shadow-card">
        <div className="grid grid-cols-7 border-b border-edge bg-card-soft">
          {weekHeader.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {(view === "month" ? days : weekDays).map((d) => renderDayCell(d))}
        </div>
      </div>

      <Modal
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay, "EEEE, MMMM d, yyyy") : ""}
        wide
      >
        {selectedTrips.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No trips on this day.</p>
        ) : (
          <div className="space-y-2">
            {selectedTrips.map((t) => {
              const driver = getDriver(t, data);
              const vehicle = getVehicle(t, data);
              const profit = t.gross - t.total_expense;
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-edge/70 bg-card-soft px-3 py-2.5">
                  <div className="min-w-[90px]">
                    <p className="text-xs font-semibold text-ink">{fmtTime(t.date_time)}</p>
                    <p className="text-[11px] font-medium text-amber-500 dark:text-amber-400">{t.transportify_id}</p>
                  </div>
                  <div className="min-w-[110px]">
                    <p className="text-sm font-medium text-ink-soft">{driver?.name ?? "—"}</p>
                    <p className="text-[11px] text-muted">
                      {vehicle?.plate_number} · {vehicle?.type}
                    </p>
                  </div>
                  <div className="hidden min-w-[160px] md:block">
                    <p className="truncate text-xs text-muted">{t.pickup_address}</p>
                    <p className="truncate text-xs text-muted">→ {t.dropoff_address}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="text-right">
                      <p className="tnum text-xs text-muted">Gross {peso0(t.gross)}</p>
                      <p className={cx("tnum text-xs font-semibold", profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                        Profit {peso0(profit)}
                      </p>
                    </div>
                    <Badge tone={statusTone(t.status)} dot>{t.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {selectedDay && selectedTrips.length > 0 && (
          <p className="mt-3 text-right text-xs text-muted">
            Total profit for the day:{" "}
            <strong className="tnum text-ink-soft">
              {peso0(selectedTrips.reduce((s, t) => s + (t.gross - t.total_expense), 0))}
            </strong>
          </p>
        )}
      </Modal>
    </div>
  );
}
