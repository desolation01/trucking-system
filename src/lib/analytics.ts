import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addDays, subDays, differenceInCalendarDays, format, isWithinInterval } from "date-fns";
import type { AppData, Trip } from "./types";

export type QuickRange = "today" | "week" | "month" | "quarter" | "year";

export interface Range {
  start: Date;
  end: Date;
  label: string;
}

export function rangeFor(quick: QuickRange): Range {
  const now = new Date();
  switch (quick) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
    case "week":
      return { start: startOfWeek(now), end: endOfWeek(now), label: "This Week" };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now), label: "This Month" };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now), label: "This Quarter" };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now), label: "This Year" };
  }
}

export function customRange(daysBack: number, label: string): Range {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(new Date(), daysBack));
  return { start, end, label };
}

export function tripsInRange(data: AppData, range: Range): Trip[] {
  return data.trips.filter((t) =>
    isWithinInterval(new Date(t.date_time), { start: range.start, end: range.end })
  );
}

export interface Filters {
  vehicleType?: string;
  driverId?: string;
  status?: Trip["status"];
}

export function getVehicle(trip: Trip, data: AppData) {
  return data.vehicles.find((v) => v.id === trip.vehicle_id);
}

export function getDriver(trip: Trip, data: AppData) {
  return data.employees.find((e) => e.id === trip.driver_id);
}

export function getEmployee(id: string, data: AppData) {
  return data.employees.find((e) => e.id === id);
}

export interface Kpis {
  gross: number;
  expense: number;
  profit: number;
  trips: number;
  cancelled: number;
  avgProfit: number;
}

export function computeKpis(trips: Trip[]): Kpis {
  const gross = trips.reduce((s, t) => s + t.gross, 0);
  const expense = trips.reduce((s, t) => s + t.total_expense, 0);
  const profit = gross - expense - trips.reduce((s, t) => s + t.driver_commission + t.helper_commission, 0);
  const completed = trips.filter((t) => t.status === "completed");
  return {
    gross,
    expense,
    profit,
    trips: trips.length,
    cancelled: trips.filter((t) => t.status === "cancelled").length,
    avgProfit: completed.length ? profit / completed.length : 0,
  };
}

export type Granularity = "day" | "week" | "month";

export function pickGranularity(range: Range): Granularity {
  const days = differenceInCalendarDays(range.end, range.start);
  if (days <= 14) return "day";
  if (days <= 75) return "week";
  return "month";
}

export interface SeriesPoint {
  key: string;
  label: string;
  gross: number;
  expense: number;
  profit: number;
  trips: number;
  tripsCompleted: number;
}

export function buildSeries(trips: Trip[], range: Range, granularity: Granularity): SeriesPoint[] {
  const map = new Map<string, SeriesPoint>();
  const bucket = (d: Date): { key: string; label: string } => {
    if (granularity === "day")
      return { key: format(d, "yyyy-MM-dd"), label: format(d, "MMM d") };
    if (granularity === "week") {
      const s = startOfWeek(d);
      return { key: format(s, "yyyy-MM-dd"), label: `Wk of ${format(s, "MMM d")}` };
    }
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM yyyy") };
  };

  for (let d = startOfDay(range.start); d <= range.end; d = addDays(d, 1)) {
    const b = bucket(d);
    if (!map.has(b.key)) {
      map.set(b.key, { key: b.key, label: b.label, gross: 0, expense: 0, profit: 0, trips: 0, tripsCompleted: 0 });
    }
  }

  for (const t of trips) {
    const b = bucket(new Date(t.date_time));
    const pt = map.get(b.key);
    if (!pt) continue;
    pt.gross += t.gross;
    pt.expense += t.total_expense;
    pt.profit += t.gross - t.total_expense - t.driver_commission - t.helper_commission;
    pt.trips += 1;
    if (t.status === "completed") pt.tripsCompleted += 1;
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface VehicleBreakdown {
  type: string;
  gross: number;
  trips: number;
}

export function vehicleBreakdown(trips: Trip[], data: AppData): VehicleBreakdown[] {
  const map = new Map<string, VehicleBreakdown>();
  for (const t of trips) {
    const type = getVehicle(t, data)?.type ?? "Unknown";
    const cur = map.get(type) ?? { type, gross: 0, trips: 0 };
    cur.gross += t.gross;
    cur.trips += 1;
    map.set(type, cur);
  }
  return [...map.values()].sort((a, b) => b.gross - a.gross);
}

export interface ExpenseBreakdown {
  category: string;
  amount: number;
}

export function expenseBreakdown(trips: Trip[]): ExpenseBreakdown[] {
  const map = new Map<string, number>();
  for (const t of trips) {
    for (const e of t.expense_items) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export interface DriverLeader {
  id: string;
  name: string;
  trips: number;
  gross: number;
  profit: number;
  commission: number;
}

export function driverLeaders(trips: Trip[], data: AppData): DriverLeader[] {
  const map = new Map<string, DriverLeader>();
  for (const t of trips) {
    const d = getDriver(t, data);
    if (!d) continue;
    const cur = map.get(d.id) ?? { id: d.id, name: d.name, trips: 0, gross: 0, profit: 0, commission: 0 };
    cur.trips += 1;
    cur.gross += t.gross;
    cur.profit += t.gross - t.total_expense - t.driver_commission - t.helper_commission;
    cur.commission += t.driver_commission;
    map.set(d.id, cur);
  }
  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

export function daySummaries(trips: Trip[]): Map<string, { profit: number; count: number }> {
  const map = new Map<string, { profit: number; count: number }>();
  for (const t of trips) {
    const key = format(new Date(t.date_time), "yyyy-MM-dd");
    const cur = map.get(key) ?? { profit: 0, count: 0 };
    cur.profit += t.gross - t.total_expense - t.driver_commission - t.helper_commission;
    cur.count += 1;
    map.set(key, cur);
  }
  return map;
}
