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
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { useStore, useStoreLoading } from "../lib/store";
import { Button, Modal, PageHeader, Select, Badge, cx, statusTone, Skeleton } from "../components/ui";
import { peso0, fmtTime } from "../lib/format";
import { getVehicle, getDriver } from "../lib/analytics";
import type { Trip } from "../lib/types";

type CalendarView = "month" | "week" | "agenda";

const viewOptions: CalendarView[] = ["month", "week", "agenda"];

export function CalendarPage() {
  const data = useStore();
  const loading = useStoreLoading();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
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

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const tripsByDay = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const t of data.trips) {
      if (driverFilter && t.driver_id !== driverFilter) continue;
      if (vehicleFilter && getVehicle(t, data)?.type !== vehicleFilter) continue;
      const key = format(new Date(t.date_time), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    for (const trips of map.values()) {
      trips.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
    }
    return map;
  }, [data, driverFilter, vehicleFilter]);

  const daySummary = (d: Date) => {
    const trips = tripsByDay.get(format(d, "yyyy-MM-dd")) ?? [];
    const profit = trips.reduce((s, t) => s + (t.gross - t.total_expense), 0);
    return { trips, profit };
  };

  const selectedTrips = selectedDay ? tripsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [] : [];
  const agendaDays = view === "week" ? weekDays : days.filter((d) => isSameMonth(d, monthStart));
  const agendaGroups = agendaDays
    .map((day) => ({ day, ...daySummary(day) }))
    .filter(({ trips }) => trips.length > 0);

  const nav = (dir: number) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else setCursor((c) => addDays(c, dir * 7));
  };

  const renderDayCell = (d: Date) => {
    const { trips, profit } = daySummary(d);
    const inMonth = isSameMonth(d, monthStart) || view === "week";
    const isToday = isSameDay(d, new Date());
    const hasLoss = trips.some((t) => t.gross - t.total_expense < 0);
    const hasCancelled = trips.some((t) => t.status === "cancelled");
    const tone = trips.length === 0 ? "bg-card-soft" : hasLoss ? "bg-red-500/5" : "bg-emerald-500/5";

    return (
      <button
        key={d.toISOString()}
        type="button"
        onClick={() => setSelectedDay(d)}
        aria-label={`${format(d, "EEEE, MMMM d")}: ${trips.length} trip${trips.length === 1 ? "" : "s"}, ${profit >= 0 ? "profit" : "loss"} ${peso0(Math.abs(profit))}${hasCancelled ? ", includes cancelled trips" : ""}`}
        className={cx(
          "flex min-h-[104px] flex-col gap-1.5 p-2.5 text-left transition-colors hover:bg-brand-soft/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
          tone,
          !inMonth && "opacity-40"
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cx("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", isToday ? "bg-brand text-on-brand" : "text-ink-soft")}>{format(d, "d")}</span>
          {trips.length > 0 && <span className="rounded-full bg-panel px-2 py-1 text-[10px] font-semibold text-panel-ink-strong tnum">{trips.length}</span>}
        </div>
        {trips.length > 0 ? (
          <div className="mt-auto space-y-1">
            <p className={cx("tnum text-[11px] font-semibold", profit >= 0 ? "text-emerald-600" : "text-red-600")}>{profit >= 0 ? "Profit " : "Loss "}{peso0(Math.abs(profit))}</p>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted">
              {hasCancelled && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
              <span>{hasCancelled ? "Includes cancelled" : profit >= 0 ? "Profitable day" : "Loss day"}</span>
            </div>
          </div>
        ) : (
          <span className="mt-auto text-[10px] font-medium text-muted">No trips</span>
        )}
      </button>
    );
  };

  const renderTripCard = (trip: Trip) => {
    const driver = getDriver(trip, data);
    const vehicle = getVehicle(trip, data);
    const profit = trip.gross - trip.total_expense;
    return (
      <button
        key={trip.id}
        type="button"
        onClick={() => setSelectedDay(new Date(trip.date_time))}
        className="group flex w-full flex-col gap-3 rounded-2xl bg-card p-4 text-left shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-row sm:items-center"
        aria-label={`${trip.transportify_id}, ${driver?.name ?? "unassigned"}, ${trip.status}, ${peso0(profit)} profit`}
      >
        <div className="flex items-center gap-3 sm:w-40 sm:shrink-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-brand"><Clock3 className="h-4 w-4" /></span>
          <div>
            <p className="text-xs font-semibold text-ink">{fmtTime(trip.date_time)}</p>
            <p className="text-[11px] font-medium text-brand">{trip.transportify_id}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{driver?.name ?? "Unassigned driver"}</p>
          <p className="truncate text-xs font-medium text-muted">{vehicle?.plate_number ?? "Unassigned vehicle"}{vehicle?.type ? ` · ${vehicle.type}` : ""}</p>
        </div>
        <div className="flex min-w-0 flex-1 items-start gap-2 text-xs text-muted">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate">{trip.pickup_address} → {trip.dropoff_address}</span>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className={cx("tnum text-sm font-semibold", profit >= 0 ? "text-emerald-600" : "text-red-600")}>{profit >= 0 ? "Profit " : "Loss "}{peso0(Math.abs(profit))}</span>
          <Badge tone={statusTone(trip.status)} dot>{trip.status === "ongoing" ? "In Transit" : trip.status}</Badge>
        </div>
      </button>
    );
  };

  const weekHeader = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-80 rounded-lg" /><div className="grid grid-cols-7 gap-1">{Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div></div>;

  return (
    <div>
      <PageHeader title="Operations Calendar" subtitle="Trip schedule, status, and daily profit" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" aria-label="Previous period" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="secondary" size="sm" aria-label="Next period" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <h2 className="text-lg font-bold text-ink">
          {view === "month" ? format(cursor, "MMMM yyyy") : view === "week" ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}` : `${format(agendaDays[0] ?? cursor, "MMM d")} – ${format(agendaDays[agendaDays.length - 1] ?? cursor, "MMM d, yyyy")}`}
        </h2>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
          <div className="flex w-full overflow-hidden rounded-xl border border-edge sm:w-auto" role="group" aria-label="Calendar view">
            {viewOptions.map((option) => (
              <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={cx("min-h-11 flex-1 px-3 text-xs font-medium capitalize transition-all sm:flex-none", view === option ? "bg-brand text-on-brand" : "bg-card text-ink-soft hover:bg-card-soft")}>{option}</button>
            ))}
          </div>
          <Select aria-label="Filter by driver" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="w-full py-2 text-xs sm:w-40 sm:py-1.5">
            <option value="">All drivers</option>
            {data.employees.filter((e) => e.role === "driver").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select aria-label="Filter by vehicle type" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="w-full py-2 text-xs sm:w-44 sm:py-1.5">
            <option value="">All vehicle types</option>
            {data.vehicleTypes.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </div>
      </div>

      {view === "agenda" ? (
        <section className="space-y-5" aria-label="Trip agenda">
          {agendaGroups.length === 0 ? (
            <div className="rounded-[20px] bg-card p-10 text-center shadow-card"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted" /><p className="text-sm font-semibold text-ink-soft">No trips in this period</p><p className="mt-1 text-xs text-muted">Try another period or clear a filter.</p></div>
          ) : (
            agendaGroups.map(({ day, trips, profit }) => (
              <section key={day.toISOString()} aria-labelledby={`agenda-${format(day, "yyyy-MM-dd")}`}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <h3 id={`agenda-${format(day, "yyyy-MM-dd")}`} className="text-sm font-semibold text-ink">{format(day, "EEEE, MMMM d")}</h3>
                  <span className={cx("tnum text-xs font-semibold", profit >= 0 ? "text-emerald-600" : "text-red-600")}>{trips.length} trip{trips.length === 1 ? "" : "s"} · {profit >= 0 ? "Profit " : "Loss "}{peso0(Math.abs(profit))}</span>
                </div>
                <div className="space-y-2">{trips.map(renderTripCard)}</div>
              </section>
            ))
          )}
        </section>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Profitable day</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Loss day</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted" /> No trips</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Cancelled included</span>
          </div>
          <div className="overflow-x-auto rounded-[20px] bg-card shadow-card">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-7 border-b border-edge bg-card-soft">
                {weekHeader.map((d) => <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">{(view === "month" ? days : weekDays).map(renderDayCell)}</div>
            </div>
          </div>
        </>
      )}

      <Modal open={Boolean(selectedDay)} onClose={() => setSelectedDay(null)} title={selectedDay ? format(selectedDay, "EEEE, MMMM d, yyyy") : ""} wide>
        {selectedTrips.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No trips on this day.</p>
        ) : (
          <div className="space-y-2">{selectedTrips.map(renderTripCard)}</div>
        )}
        {selectedDay && selectedTrips.length > 0 && (
          <p className="mt-4 text-right text-xs text-muted">Total daily profit: <strong className="tnum text-ink-soft">{peso0(selectedTrips.reduce((s, t) => s + (t.gross - t.total_expense), 0))}</strong></p>
        )}
      </Modal>
    </div>
  );
}
