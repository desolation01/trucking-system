import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Fuel, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore, useStoreLoading, tripActions } from "../lib/store";
import { Button, EmptyState, PageHeader, Select, Td, Th, Badge, cx, statusTone, Skeleton, SkeletonTableRow } from "../components/ui";
import { useToast } from "../lib/toast";
import { TripForm } from "./TripForm";
import { fmtDateTime, peso0 } from "../lib/format";
import type { Trip } from "../lib/types";

type SortKey = "date" | "gross" | "profit" | "driver" | "status" | "vehicle";

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "gross", label: "Gross" },
  { key: "profit", label: "Profit" },
  { key: "driver", label: "Driver" },
  { key: "status", label: "Status" },
  { key: "vehicle", label: "Vehicle Type" },
];

export function Trips() {
  const data = useStore();
  const { toast } = useToast();
  const loading = useStoreLoading();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [driverFilter, setDriverFilter] = useState("");
  const [helperFilter, setHelperFilter] = useState("");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<Trip | undefined>(undefined);
  const [distributing, setDistributing] = useState<string | null>(null);
  const [distributeMsg, setDistributeMsg] = useState("");

  const indexed = useMemo(() => {
    const rows = data.trips.map((t) => {
      const driver = data.employees.find((e) => e.id === t.driver_id);
      const helpers = t.helper_ids
        .map((id) => data.employees.find((e) => e.id === id)?.name)
        .filter(Boolean)
        .join(" ");
      const vehicle = data.vehicles.find((v) => v.id === t.vehicle_id);
      return {
        trip: t,
        search: [
          driver?.name ?? "",
          helpers,
          vehicle?.plate_number ?? "",
          vehicle?.type ?? "",
          t.transportify_id,
          t.customer_phone,
          t.customer_name ?? "",
          t.pickup_address,
          t.dropoff_address,
          t.items ?? "",
          t.description ?? "",
        ].join(" "),
      };
    });
    const fuse = new Fuse(rows, {
      keys: ["search"],
      threshold: 0.35,
      ignoreLocation: true,
    });
    return { rows, fuse };
  }, [data]);

  const filtered = useMemo(() => {
    let list = indexed.rows;
    if (query.trim()) {
      list = indexed.fuse.search(query.trim()).map((r) => r.item);
    }
    list = list.filter(({ trip: t }) => {
      if (driverFilter && t.driver_id !== driverFilter) return false;
      if (helperFilter && !t.helper_ids.includes(helperFilter)) return false;
      if (vehicleTypeFilter) {
        const v = data.vehicles.find((x) => x.id === t.vehicle_id);
        if (v?.type !== vehicleTypeFilter) return false;
      }
      if (statusFilter && t.status !== statusFilter) return false;
      if (dateFrom && new Date(t.date_time) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(t.date_time) > end) return false;
      }
      return true;
    });

    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      const ta = a.trip;
      const tb = b.trip;
      switch (sortKey) {
        case "date":
          return dir * (new Date(ta.date_time).getTime() - new Date(tb.date_time).getTime());
        case "gross":
          return dir * (ta.gross - tb.gross);
        case "profit":
          return dir * ((ta.gross - ta.total_expense) - (tb.gross - tb.total_expense));
        case "driver": {
          const da = data.employees.find((e) => e.id === ta.driver_id)?.name ?? "";
          const db = data.employees.find((e) => e.id === tb.driver_id)?.name ?? "";
          return dir * da.localeCompare(db);
        }
        case "status":
          return dir * ta.status.localeCompare(tb.status);
        case "vehicle": {
          const va = data.vehicles.find((v) => v.id === ta.vehicle_id)?.type ?? "";
          const vb = data.vehicles.find((v) => v.id === tb.vehicle_id)?.type ?? "";
          return dir * va.localeCompare(vb);
        }
      }
    });
    return list;
  }, [indexed, query, driverFilter, helperFilter, vehicleTypeFilter, statusFilter, dateFrom, dateTo, sortKey, sortAsc, data]);

  const grossTotal = filtered.reduce((s, r) => s + r.trip.gross, 0);
  const profitTotal = filtered.reduce((s, r) => s + (r.trip.gross - r.trip.total_expense - r.trip.driver_commission - r.trip.helper_commission), 0);

  const activeDrivers = data.employees.filter((e) => e.role === "driver" && e.status === "active");
  const activeHelpers = data.employees.filter((e) => e.role === "helper" && e.status === "active");

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64 rounded-lg" /><Skeleton className="h-8 w-full rounded-lg" /><div className="overflow-hidden rounded-xl border border-edge bg-card"><table className="w-full"><thead><tr>{Array.from({length:10}).map((_,i)=><th key={i} className="px-3 py-2.5"><Skeleton className="h-3 w-16" /></th>)}</tr></thead><tbody>{Array.from({length:8}).map((_,i)=><SkeletonTableRow key={i} cols={10} />)}</tbody></table></div></div>;

  return (
    <div>
      <PageHeader
        title="Trips"
        subtitle={`${data.trips.length} total trips · ${filtered.length} shown`}
        actions={
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Trip
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search driver, helper, plate, Transportify ID, phone, address, items…"
            className="w-full rounded-lg border border-edge bg-card py-2.5 pl-10 pr-3 text-sm shadow-card placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring transition-all duration-150"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="w-40 py-1.5 text-xs">
            <option value="">All drivers</option>
            {activeDrivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Select value={helperFilter} onChange={(e) => setHelperFilter(e.target.value)} className="w-40 py-1.5 text-xs">
            <option value="">All helpers</option>
            {activeHelpers.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </Select>
          <Select value={vehicleTypeFilter} onChange={(e) => setVehicleTypeFilter(e.target.value)} className="w-44 py-1.5 text-xs">
            <option value="">All vehicle types</option>
            {data.vehicleTypes.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36 py-1.5 text-xs">
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink-soft transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring" />
          <span className="text-xs text-muted">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink-soft transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring" />
          <div className="ml-auto flex items-center gap-2">
            <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-32 py-1.5 text-xs">
              {sortOptions.map((o) => (
                <option key={o.key} value={o.key}>Sort: {o.label}</option>
              ))}
            </Select>
            <button
              onClick={() => setSortAsc((v) => !v)}
              className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-card-soft transition-all duration-150 active:scale-95"
              title="Toggle sort direction"
            >
              {sortAsc ? "Asc ↑" : "Desc ↓"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span>Gross total: <strong className="text-ink tnum">{peso0(grossTotal)}</strong></span>
        <span>Profit total: <strong className={cx("tnum", profitTotal >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>{peso0(profitTotal)}</strong></span>
      </div>

      <div className="overflow-hidden rounded-xl border border-edge bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-card-soft">
              <tr>
                <Th>Date & Time</Th>
                <Th>Transportify</Th>
                <Th>Driver</Th>
                <Th>Helpers</Th>
                <Th>Vehicle</Th>
                <Th>Gross</Th>
                <Th>Expense</Th>
                <Th>Company Profit</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/70">
              {filtered.slice(0, 200).map(({ trip: t }) => {
                const driver = data.employees.find((e) => e.id === t.driver_id);
                const helpers = t.helper_ids
                  .map((id) => data.employees.find((e) => e.id === id)?.name)
                  .filter(Boolean);
                const vehicle = data.vehicles.find((v) => v.id === t.vehicle_id);
                const profit = t.gross - t.total_expense - t.driver_commission - t.helper_commission;
                return (
                  <tr key={t.id} className="hover:bg-card-soft transition-colors duration-100">
                    <Td className="text-ink-soft">{fmtDateTime(t.date_time)}</Td>
                    <Td>
                      <span className="font-medium text-amber-500 dark:text-amber-400">{t.transportify_id}</span>
                    </Td>
                    <Td className="font-medium text-ink">{driver?.name ?? "—"}</Td>
                    <Td className="text-muted">{helpers.join(", ") || "—"}</Td>
                    <Td>
                      <span className="font-medium text-ink">{vehicle?.plate_number ?? "—"}</span>
                      <span className="ml-1 text-xs text-muted">{vehicle?.type}</span>
                    </Td>
                    <Td className="tnum text-ink-soft">{peso0(t.gross)}</Td>
                    <Td className="tnum text-red-500 dark:text-red-400">-{peso0(t.total_expense)}</Td>
                    <Td className={cx("tnum font-semibold", profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>{peso0(profit)}</Td>
                    <Td><Badge tone={statusTone(t.status)} dot>{t.status}</Badge></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditing(t); setFormOpen(true); }}
                          className="rounded-lg p-1.5 text-muted transition-all duration-150 hover:bg-brand-soft hover:text-amber-500 dark:hover:text-amber-400 active:scale-95"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {t.km_traveled && t.km_traveled > 0 && t.expense_items.some((e) => e.category === "Fuel" && e.amount > 0 && !e.id.startsWith("dist-fuel-")) && (
                          <button
                            onClick={() => {
                              const fuelItem = t.expense_items.find((e) => e.category === "Fuel" && !e.id.startsWith("dist-fuel-"));
                              if (fuelItem) {
                                tripActions.distributeFuel(fuelItem.id, t.id);
                                setDistributing(t.id);
                                setDistributeMsg("Fuel distributed by KM!");
                                setTimeout(() => { setDistributing(null); setDistributeMsg(""); }, 2000);
                              }
                            }}
                            className="rounded-lg p-1.5 text-muted transition-all duration-150 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400 active:scale-95"
                            title="Distribute fuel by KM"
                          >
                            <Fuel className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(t)}
                          className="rounded-lg p-1.5 text-muted transition-all duration-150 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 active:scale-95"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {distributing === t.id && distributeMsg && (
                        <span className="mt-1 block text-[10px] font-medium text-emerald-500">{distributeMsg}</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState
            title="No trips found"
            subtitle="Try adjusting your search or filters, or add a new trip."
          />
        )}
      </div>

      <TripForm key={editing?.id ?? "new"} open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-dropdown">
            <h3 className="text-base font-semibold text-ink">Delete trip?</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Delete {confirmDelete.transportify_id} by{" "}
              {data.employees.find((e) => e.id === confirmDelete.driver_id)?.name}? This affects payroll records.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(undefined)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  try {
                    tripActions.remove(confirmDelete.id);
                    toast(`Trip ${confirmDelete.transportify_id} deleted`, "success");
                    setConfirmDelete(undefined);
                  } catch (e: any) {
                    toast(e?.message ?? "Failed to delete trip", "error");
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
