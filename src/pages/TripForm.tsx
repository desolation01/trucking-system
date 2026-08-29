import { useMemo, useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore, tripActions } from "../lib/store";
import { useAuth } from "../lib/auth";
import { computeCommission } from "../lib/commission";
import { Button, Field, Input, Modal, Select, Textarea, cx } from "../components/ui";
import { useToast } from "../lib/toast";
import { peso } from "../lib/format";
import type { ExpenseItem, Trip, TripStatus } from "../lib/types";

const EXPENSE_CATEGORIES = ["Fuel", "Toll fees", "Parking", "Driver allowance", "Miscellaneous"];

const emptyExpense = (): ExpenseItem => ({
  id: Math.random().toString(36).slice(2),
  category: "Fuel",
  amount: 0,
});

export function TripForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Trip;
}) {
  const data = useStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = Boolean(initial);

  const [driverId, setDriverId] = useState(initial?.driver_id ?? "");
  const [helperIds, setHelperIds] = useState<string[]>(initial?.helper_ids ?? []);
  const [vehicleType, setVehicleType] = useState(
    initial ? data.vehicles.find((v) => v.id === initial.vehicle_id)?.type ?? "" : ""
  );
  const [vehicleId, setVehicleId] = useState(initial?.vehicle_id ?? "");

  // Auto-fill vehicle when driver is selected (new trips only)
  const prevDriverRef = useRef(driverId);
  useEffect(() => {
    if (initial) return; // Don't auto-fill when editing
    if (driverId && driverId !== prevDriverRef.current) {
      const assigned = data.vehicles.find((v) => v.driver_id === driverId && v.status === "active");
      if (assigned) {
        setVehicleId(assigned.id);
        setVehicleType(assigned.type);
      }
    }
    prevDriverRef.current = driverId;
  }, [driverId, initial, data.vehicles]);
  const [transportifyId, setTransportifyId] = useState(initial?.transportify_id ?? "");
  const [cargoWeight, setCargoWeight] = useState(initial?.cargo_weight?.toString() ?? "");
  const [cargoDimensions, setCargoDimensions] = useState(initial?.cargo_dimensions ?? "");
  const [kmTraveled, setKmTraveled] = useState(initial?.km_traveled?.toString() ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone ?? "");
  const [customerName, setCustomerName] = useState(initial?.customer_name ?? "");
  const [pickup, setPickup] = useState(initial?.pickup_address ?? "");
  const [dropoff, setDropoff] = useState(initial?.dropoff_address ?? "");
  const [items, setItems] = useState(initial?.items ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [gross, setGross] = useState(initial?.gross?.toString() ?? "");
  const [expenses, setExpenses] = useState<ExpenseItem[]>(
    initial?.expense_items?.length ? initial.expense_items : [emptyExpense()]
  );
  const [helperSplit, setHelperSplit] = useState<Trip["helper_split"]>(initial?.helper_split ?? "equal");
  const [customSplit, setCustomSplit] = useState<Record<string, number>>(
    initial?.helper_split_custom ?? {}
  );
  const [dateTime, setDateTime] = useState(() => {
    if (initial?.date_time) {
      const d = new Date(initial.date_time);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const d = new Date();
    d.setMinutes(0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  });
  const [status, setStatus] = useState<TripStatus>(initial?.status ?? "scheduled");
  const [error, setError] = useState("");

  const drivers = data.employees.filter((e) => e.role === "driver" && e.status === "active");
  const helpers = data.employees.filter((e) => e.role === "helper" && e.status === "active");
  const vehicles = data.vehicles.filter((v) => v.status === "active" && (!vehicleType || v.type === vehicleType));

  const grossNum = parseFloat(gross) || 0;
  const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const driverComm = useMemo(
    () =>
      computeCommission(
        { role: "driver", employeeIds: driverId ? [driverId] : [], vehicleType, gross: grossNum, expenseItems: expenses, status },
        data
      ),
    [driverId, vehicleType, grossNum, expenses, status, data]
  );

  const helperComm = useMemo(
    () =>
      computeCommission(
        { role: "helper", employeeIds: helperIds, vehicleType, gross: grossNum, expenseItems: expenses, status, split: helperSplit, splitCustom: customSplit },
        data
      ),
    [helperIds, vehicleType, grossNum, expenses, status, helperSplit, customSplit, data]
  );

  const profit = useMemo(
    () => grossNum - totalExpense - driverComm.total - helperComm.total,
    [grossNum, totalExpense, driverComm, helperComm]
  );

  const toggleHelper = (id: string) => {
    setHelperIds((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]));
  };

  const handleCustom = (id: string, value: string) => {
    const n = parseFloat(value) || 0;
    setCustomSplit((prev) => ({ ...prev, [id]: n }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!driverId) return setError("Select a driver.");
    if (!vehicleId) return setError("Select a vehicle.");
    if (!transportifyId.trim()) return setError("Transportify Booking ID is required.");
    if (!customerPhone.trim()) return setError("Customer phone number is required.");
    if (grossNum <= 0) return setError("Gross amount must be greater than zero.");
    if (!dateTime) return setError("Trip date & time is required.");

    const input = {
      driver_id: driverId,
      helper_ids: helperIds,
      vehicle_id: vehicleId,
      transportify_id: transportifyId.trim(),
      cargo_weight: cargoWeight ? parseFloat(cargoWeight) : undefined,
      cargo_dimensions: cargoDimensions,
      km_traveled: kmTraveled ? parseFloat(kmTraveled) : undefined,
      customer_phone: customerPhone.trim(),
      customer_name: customerName.trim() || undefined,
      pickup_address: pickup.trim(),
      dropoff_address: dropoff.trim(),
      items,
      description,
      gross: grossNum,
      expense_items: expenses.filter((e) => (Number(e.amount) || 0) > 0),
      helper_split: helperSplit,
      helper_split_custom: customSplit,
      date_time: new Date(dateTime).toISOString(),
      status,
    };

    const userId = user?.id ?? "user-owner";
    try {
      if (initial) {
        await tripActions.update(initial.id, input, userId);
        toast("Trip updated", "success");
      } else {
        const { savedToCloud } = await tripActions.add(input, userId);
        if (savedToCloud) {
          toast("Trip saved to cloud", "success");
        } else {
          toast("Trip saved locally", "info");
        }
      }
      onClose();
    } catch (err) {
      setError(String(err));
      toast("Failed to save trip", "error");
    }
  };

  const summaryRow = (label: string, value: string, cls?: string) => (
    <div className="flex items-center justify-between border-t border-dashed border-edge py-2 text-sm first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className={cx("font-semibold text-ink", cls)}>{value}</span>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Trip" : "Add New Trip"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="trip-form">{isEdit ? "Save changes" : "Create trip"}</Button>
        </>
      }
    >
      <form id="trip-form" onSubmit={submit} className="space-y-4">
        {error && <div id="trip-form-error" role="alert" tabIndex={-1} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Driver" required>
            <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Select driver…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Vehicle Type" required>
            <Select
              value={vehicleType}
              onChange={(e) => {
                setVehicleType(e.target.value);
                setVehicleId("");
              }}
            >
              <option value="">Select type…</option>
              {data.vehicleTypes.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </Field>

          <Field label="Vehicle / Plate" required>
            <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plate_number} ({v.type})</option>
              ))}
            </Select>
          </Field>

          <Field label="Transportify Booking ID" required>
            <Input value={transportifyId} onChange={(e) => setTransportifyId(e.target.value)} placeholder="TFP-0000" />
          </Field>

          <Field label="Customer Phone" required>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0917 000 0000" />
          </Field>

          <Field label="Customer Name">
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional" />
          </Field>

          <Field label="Pickup Address">
            <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Origin address" />
          </Field>

          <Field label="Drop-off Address">
            <Input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Destination address" />
          </Field>

          <Field label="Items">
            <Input value={items} onChange={(e) => setItems(e.target.value)} placeholder="e.g. 20 pallets" />
          </Field>

          <Field label="Cargo Weight (kg)">
            <Input type="number" min="0" value={cargoWeight} onChange={(e) => setCargoWeight(e.target.value)} />
          </Field>

          <Field label="Cargo Dimensions (L×W×H)">
            <Input value={cargoDimensions} onChange={(e) => setCargoDimensions(e.target.value)} placeholder="e.g. 2x1x1m" />
          </Field>

          <Field label="KM Traveled" hint="Used for fair fuel cost distribution">
            <Input type="number" min="0" value={kmTraveled} onChange={(e) => setKmTraveled(e.target.value)} placeholder="km" />
          </Field>

          <Field label="Date & Time" required>
            <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          </Field>

          <Field label="Status" required>
            <Select value={status} onChange={(e) => setStatus(e.target.value as TripStatus)}>
              <option value="scheduled">Scheduled</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>

          <Field label="Gross Amount (₱)" required className="sm:col-span-2">
            <Input type="number" min="0" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0.00" />
          </Field>

          <Field label="Helpers" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {helpers.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => toggleHelper(h.id)}
                  aria-pressed={helperIds.includes(h.id)}
                  className={cx(
                    "min-h-11 rounded-full px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    helperIds.includes(h.id)
                      ? "bg-brand text-on-brand"
                      : "bg-card-soft text-ink-soft hover:bg-edge"
                  )}
                >
                  {h.name}
                </button>
              ))}
              {helpers.length === 0 && <span className="text-xs text-muted">No active helpers</span>}
            </div>
          </Field>
        </div>

        {helperIds.length > 1 && (
          <fieldset className="rounded-xl border border-edge bg-card-soft p-3">
            <legend className="mb-1.5 text-[11px] font-medium text-ink-soft">Helper commission split</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input type="radio" checked={helperSplit === "equal"} onChange={() => setHelperSplit("equal")} />
                Split evenly
              </label>
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input type="radio" checked={helperSplit === "custom"} onChange={() => setHelperSplit("custom")} />
                Custom %
              </label>
            </div>
            {helperSplit === "custom" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {helperIds.map((id) => {
                  const h = data.employees.find((e) => e.id === id);
                  return (
                    <Field key={id} label={h?.name ?? id}>
                      <Input
                        type="number"
                        min="0"
                        value={customSplit[id] ?? ""}
                        placeholder="weight"
                        onChange={(e) => handleCustom(id, e.target.value)}
                      />
                    </Field>
                  );
                })}
                <p className="col-span-full text-[11px] text-muted">
                  Weights are normalized to a percentage share of the total helper commission.
                </p>
              </div>
            )}
          </fieldset>
        )}

        <fieldset>
          <div className="mb-1.5 flex items-center justify-between">
            <legend className="text-xs font-medium text-ink-soft">Itemized Expenses</legend>
            <button
              type="button"
              onClick={() => setExpenses((prev) => [...prev, emptyExpense()])}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <Plus className="h-3 w-3" /> Add expense
            </button>
          </div>
          <div className="space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Select
                  value={e.category}
                  onChange={(ev) =>
                    setExpenses((prev) =>
                      prev.map((x) => (x.id === e.id ? { ...x, category: ev.target.value } : x))
                    )
                  }
                  className="w-48 py-1.5 text-xs"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={e.amount || ""}
                  placeholder="0.00"
                  aria-label={`Expense amount for ${e.category}`}
                  className="w-36 py-2 text-xs"
                  onChange={(ev) =>
                    setExpenses((prev) =>
                      prev.map((x) => (x.id === e.id ? { ...x, amount: parseFloat(ev.target.value) || 0 } : x))
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setExpenses((prev) => prev.filter((x) => x.id !== e.id))}
                  aria-label={`Remove ${e.category} expense`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </fieldset>

        <Field label="Description / Notes" className="mt-4">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional notes about this trip…" />
        </Field>

        <div className="rounded-xl border border-edge bg-card-soft p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Computed Summary</p>
          {summaryRow("Gross", peso(grossNum))}
          {summaryRow("Total expense", `-${peso(totalExpense)}`, "text-red-400")}
          {summaryRow(
            "Company Profit",
            peso(profit),
            profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
          )}
          {driverId && (
            <div className="mt-2 rounded-lg bg-card p-2">
              {summaryRow(
                `Driver commission (${driverComm.percentage}% of ${driverComm.basis})`,
                peso(driverComm.total),
                "text-brand"
              )}
            </div>
          )}
          {helperIds.length > 0 && (
            <div className="mt-2 rounded-lg bg-card p-2">
              {summaryRow(
                `Helper commission (${helperComm.percentage}% of ${helperComm.basis})`,
                peso(helperComm.total),
                "text-violet-500 dark:text-violet-400"
              )}
              {Object.entries(helperComm.perEmployee).map(([id, amt]) => {
                const name = data.employees.find((e) => e.id === id)?.name ?? id;
                return (
                  <p key={id} className="text-[11px] text-muted">
                    {name}: {peso(amt)}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}