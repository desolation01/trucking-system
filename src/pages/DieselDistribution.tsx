import { useMemo, useState } from "react";
import { Fuel, Search, Check, X, History } from "lucide-react";
import { useStore, tripActions, undoDieselDist, hasDieselDist, getDieselDistLogs, type DieselDistLog } from "../lib/store";
import { Button, Card, Field, Input, PageHeader, cx, Badge, statusTone } from "../components/ui";
import { peso0, fmtDateTime } from "../lib/format";
import { useToast } from "../lib/toast";

export function DieselDistribution() {
  const data = useStore();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [totalFuel, setTotalFuel] = useState("");

  const logs = useMemo(() => getDieselDistLogs(), [showLogs]);

  // Split trips: available vs already distributed
  const { available, distributed } = useMemo(() => {
    const avail: typeof data.trips = [];
    const dist: typeof data.trips = [];
    for (const t of data.trips) {
      if (hasDieselDist(t)) dist.push(t);
      else avail.push(t);
    }
    return { available: avail, distributed: dist };
  }, [data]);

  // Filter available trips by search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = available;
    if (q) {
      list = available.filter((t) => {
        const driver = data.employees.find((e) => e.id === t.driver_id)?.name ?? "";
        return (
          t.transportify_id.toLowerCase().includes(q) ||
          driver.toLowerCase().includes(q) ||
          t.customer_phone.includes(q) ||
          (t.customer_name ?? "").toLowerCase().includes(q)
        );
      });
    }
    return list.slice(0, 200);
  }, [available, data, query]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };

  const openModal = () => {
    if (selected.size === 0) {
      toast("Select at least one trip first", "info");
      return;
    }

    // Validate selected trips have KM and helpers
    const trips = data.trips.filter((t) => selected.has(t.id));
    const noKm = trips.filter((t) => !t.km_traveled || t.km_traveled <= 0);
    const noHelpers = trips.filter((t) => t.helper_ids.length === 0);

    if (noKm.length > 0 || noHelpers.length > 0) {
      const issues: string[] = [];
      if (noKm.length > 0) {
        issues.push(`${noKm.length} trip${noKm.length > 1 ? "s" : ""} missing KM: ${noKm.map((t) => t.transportify_id).join(", ")}`);
      }
      if (noHelpers.length > 0) {
        issues.push(`${noHelpers.length} trip${noHelpers.length > 1 ? "s" : ""} with no helpers`);
      }
      toast(issues.join(" · "), "error");
      return;
    }

    setShowModal(true);
  };

  const runDistribution = () => {
    const fuel = parseFloat(totalFuel);
    if (fuel <= 0) { toast("Enter a valid fuel cost", "error"); return; }

    // Remove any old diesel-dist expenses from the selected trips first
    undoDieselDist([...selected]);

    // Apply the new distribution
    tripActions.distributeDiesel([...selected], fuel);

    toast(`Diesel distributed across ${selected.size} trip${selected.size > 1 ? "s" : ""}`, "success");
    setShowModal(false);
    setSelected(new Set());
    setTotalFuel("");
  };

  const editLog = (log: DieselDistLog) => {
    // Pre-fill the modal with the log's data
    setSelected(new Set(log.tripIds));
    setTotalFuel(log.totalFuelCost.toString());
    setShowLogs(false);
    setShowModal(true);
  };

  // Preview calculations
  const preview = useMemo(() => {
    if (!showModal || !totalFuel) return null;
    const fuel = parseFloat(totalFuel);
    if (fuel <= 0 || selected.size === 0) return null;

    const trips = data.trips.filter((t) => selected.has(t.id));
    const totalKm = trips.reduce((s, t) => s + (t.km_traveled ?? 0), 0);
    if (totalKm <= 0) return null;

    let totalDriverShare = 0;

    const tripShares = trips.map((t) => {
      const km = t.km_traveled ?? 0;
      const share = Math.round((km / totalKm) * fuel * 100) / 100;
      const driver = data.employees.find((e) => e.id === t.driver_id);

      totalDriverShare += share;

      return {
        id: t.id,
        label: t.transportify_id,
        driverName: driver?.name ?? "—",
        km, share, numHelpers: t.helper_ids.length,
      };
    });

    const totalShare = tripShares.reduce((s, t) => s + t.share, 0);
    return { tripShares, totalKm, totalShare, numTrips: trips.length };
  }, [showModal, totalFuel, selected, data]);

  const selectedTrips = useMemo(
    () => data.trips.filter((t) => selected.has(t.id)),
    [data, selected]
  );

  return (
    <div>
      <PageHeader
        title="Diesel Distribution"
        subtitle={`${available.length} available · ${distributed.length} distributed · ${selected.size} selected`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowLogs((v) => !v)}>
              <History className="h-4 w-4" /> History
              {logs.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-500 dark:text-amber-400">{logs.length}</span>
              )}
            </Button>
            <Button onClick={openModal} disabled={selected.size === 0}>
              <Fuel className="h-4 w-4" /> Distribute Diesel
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-4">
        <label htmlFor="diesel-search" className="sr-only">Search diesel trips</label>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id="diesel-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by Transportify ID, driver, customer…"
          className="w-full rounded-lg border border-edge bg-card py-2.5 pl-10 pr-3 text-sm shadow-card placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring transition-all duration-150"
        />
      </div>

      {/* Select all / clear */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={selectAll}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-card-soft transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          {selected.size === filtered.length ? "Deselect all" : "Select all"}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-soft transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
        <span className="text-xs text-muted ml-auto">
          {filtered.length} trips · {distributed.length} already distributed
        </span>
      </div>

      {/* Trip list */}
      <div className="overflow-hidden rounded-xl border border-edge bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-card-soft">
              <tr>
                <th className="w-10 px-3 py-3"><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={selectAll} className="rounded border-edge text-brand focus:ring-brand" /></th>
                <Th>Date & Time</Th>
                <Th>Transportify</Th>
                <Th>Driver</Th>
                <Th>Vehicle</Th>
                <Th>Gross</Th>
                <Th>Profit</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/70">
              {/* Available trips */}
              {filtered.map((t) => {
                const driver = data.employees.find((e) => e.id === t.driver_id);
                const vehicle = data.vehicles.find((v) => v.id === t.vehicle_id);
                const profit = t.gross - t.total_expense - t.driver_commission - t.helper_commission;
                return (
                  <tr
                    key={t.id}
                    onClick={() => toggleSelect(t.id)}
                    className={cx(
                      "cursor-pointer transition-colors duration-100 hover:bg-card-soft",
                      selected.has(t.id) && "bg-brand/5"
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-edge text-brand focus:ring-brand"
                      />
                    </td>
                    <Td className="text-ink-soft">{fmtDateTime(t.date_time)}</Td>
                    <Td><span className="font-medium text-amber-500 dark:text-amber-400">{t.transportify_id}</span></Td>
                    <Td className="font-medium text-ink">{driver?.name ?? "—"}</Td>
                    <Td className="text-muted">{vehicle?.plate_number ?? "—"}</Td>
                    <Td className="tnum text-ink-soft">{peso0(t.gross)}</Td>
                    <Td className={cx("tnum font-semibold", profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>{peso0(profit)}</Td>
                    <Td><Badge tone={statusTone(t.status)} dot>{t.status}</Badge></Td>
                  </tr>
                );
              })}

              {/* Already distributed trips (disabled, muted) */}
              {distributed.length > 0 && query.trim() === "" && (
                <>
                  <tr className="bg-card-soft/50">
                    <td colSpan={8} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Already distributed ({distributed.length})
                    </td>
                  </tr>
                  {distributed.slice(0, 50).map((t) => {
                    const driver = data.employees.find((e) => e.id === t.driver_id);
                    const vehicle = data.vehicles.find((v) => v.id === t.vehicle_id);
                    const profit = t.gross - t.total_expense - t.driver_commission - t.helper_commission;
                    return (
                      <tr key={t.id} className="opacity-50">
                        <td className="px-3 py-3">
                          <input type="checkbox" disabled className="rounded border-edge opacity-30" />
                        </td>
                        <Td className="text-muted">{fmtDateTime(t.date_time)}</Td>
                        <Td><span className="text-muted">{t.transportify_id}</span></Td>
                        <Td className="text-muted">{driver?.name ?? "—"}</Td>
                        <Td className="text-muted">{vehicle?.plate_number ?? "—"}</Td>
                        <Td className="tnum text-muted">{peso0(t.gross)}</Td>
                        <Td className="tnum text-muted">{peso0(profit)}</Td>
                        <Td><Badge tone="slate" dot>Distributed</Badge></Td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && available.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <Fuel className="mb-3 h-8 w-8 text-emerald-500/50" />
            <p className="text-sm font-medium text-ink-soft">All trips have been distributed</p>
            <p className="mt-1 text-xs text-muted">Every trip has already been through diesel distribution</p>
          </div>
        )}
      </div>

      {/* History Panel */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[8vh] backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-edge bg-card shadow-dropdown">
            <div className="flex items-center justify-between border-b border-edge/70 px-5 py-4">
              <h3 className="font-display text-base font-semibold text-ink">
                <History className="mr-2 inline h-4 w-4" />
                Distribution History ({logs.length})
              </h3>
              <button onClick={() => setShowLogs(false)} className="rounded-md p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {logs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No distributions yet.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => {
                    const tripLabels = log.tripIds.map((id) => {
                      const t = data.trips.find((tr) => tr.id === id);
                      return t?.transportify_id ?? id.slice(0, 8);
                    });
                    return (
                      <button
                        key={log.id}
                        onClick={() => editLog(log)}
                        className="flex w-full items-center gap-3 rounded-lg border border-edge/70 p-3 text-left transition-colors hover:bg-card-soft hover:border-brand">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 dark:text-amber-400">
                          <Fuel className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">
                            {peso0(log.totalFuelCost)} across {log.tripCount} trip{log.tripCount > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted">
                            {new Date(log.timestamp).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} · {log.totalKm.toLocaleString()} km · {tripLabels.join(", ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Distribution Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="my-8 w-full max-w-lg rounded-xl border border-edge bg-card shadow-dropdown">
            <div className="flex items-center justify-between border-b border-edge/70 px-5 py-4">
              <h3 className="font-display text-base font-semibold text-ink">
                <Fuel className="mr-2 inline h-4 w-4 text-amber-400" />
                Diesel Distribution
              </h3>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-soft">Selected Trips ({selectedTrips.length})</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {selectedTrips.map((t) => {
                    const driver = data.employees.find((e) => e.id === t.driver_id);
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded bg-card-soft px-2.5 py-1.5 text-xs">
                        <span className="font-medium text-ink">{t.transportify_id}</span>
                        <span className="text-muted">{driver?.name ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Field label="Total Diesel Cost (₱)" required>
                <Input type="number" min="0" step="0.01" value={totalFuel} onChange={(e) => setTotalFuel(e.target.value)} placeholder="0.00" />
              </Field>

              {preview && (
                <Card padding={false}>
                  <div className="divide-y divide-edge/70">
                    <div className="px-4 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Distribution Summary</p>
                      <p className="mt-0.5 text-[11px] text-muted">{preview.totalKm.toLocaleString()} total km · {preview.numTrips} trip{preview.numTrips > 1 ? "s" : ""} · {peso0(preview.totalShare)} total diesel cost</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-edge/60">
                      <div className="flex items-center justify-between px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        <span className="min-w-0 flex-1">Transportify ID · Driver</span>
                        <div className="flex items-center gap-3 text-right">
                          <span className="w-12">Distance</span>
                          <span className="w-16">Cost</span>
                        </div>
                      </div>
                      {preview.tripShares.map((ts) => (
                        <div key={ts.id} className="flex items-center justify-between px-4 py-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-ink">{ts.label}</span>
                            <span className="ml-1.5 text-muted">{ts.driverName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <span className="tnum text-muted">{ts.km} km</span>
                            <span className="tnum text-[11px] font-medium text-ink">{peso0(ts.share)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 text-right">
                      <p className="text-[11px] font-medium text-muted">Total Fuel Cost</p>
                      <p className="tnum font-semibold text-ink">{peso0(preview.totalShare)}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-edge/70 px-5 py-4">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={runDistribution} disabled={!totalFuel || parseFloat(totalFuel) <= 0}>
                <Fuel className="h-4 w-4" /> Apply Distribution
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cx("whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted", className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cx("whitespace-nowrap px-3 py-3 text-sm text-ink-soft", className)}>{children}</td>;
}