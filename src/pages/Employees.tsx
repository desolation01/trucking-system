import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useStore, useStoreLoading, employeeActions } from "../lib/store";
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Td, Th, cx, Skeleton, SkeletonTableRow } from "../components/ui";
import { useToast } from "../lib/toast";
import { fmtDate, peso0 } from "../lib/format";
import type { Employee, EmployeeRole } from "../lib/types";

const roleLabels: Record<EmployeeRole, string> = {
  driver: "Driver",
  helper: "Helper",
  staff: "Office Staff",
};

export function Employees() {
  const data = useStore();
  const { toast } = useToast();
  const loading = useStoreLoading();
  const [tab, setTab] = useState<EmployeeRole | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>(undefined);
  const [viewing, setViewing] = useState<Employee | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<Employee | undefined>(undefined);

  const employees = data.employees.filter((e) => tab === "all" || e.role === tab);

  const tripsFor = (id: string) => data.trips.filter((t) => t.driver_id === id || t.helper_ids.includes(id));

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-48 rounded-lg" /><div className="overflow-hidden rounded-xl border border-edge bg-card"><table className="w-full"><thead><tr>{Array.from({length:7}).map((_,i)=><th key={i} className="px-3 py-2.5"><Skeleton className="h-3 w-16" /></th>)}</tr></thead><tbody>{Array.from({length:5}).map((_,i)=><SkeletonTableRow key={i} cols={7} />)}</tbody></table></div></div>;

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${data.employees.length} records`}
        actions={
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["all", "driver", "helper", "staff"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setTab(r)}
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all duration-150",
              tab === r ? "bg-brand text-on-brand shadow-glow" : "bg-card text-ink-soft ring-1 ring-edge hover:bg-card-soft"
            )}
          >
            {r === "all" ? "All" : roleLabels[r]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-edge bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-card-soft">
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Contact</Th>
                <Th>License No.</Th>
                <Th>Hire Date</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/70">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-card-soft transition-colors duration-100">
                  <Td>
                    <button onClick={() => setViewing(e)} className="font-medium text-amber-500 dark:text-amber-400 hover:underline">
                      {e.name}
                    </button>
                  </Td>
                  <Td><Badge tone={e.role === "driver" ? "blue" : e.role === "helper" ? "violet" : "slate"}>{roleLabels[e.role]}</Badge></Td>
                  <Td className="text-ink-soft">{e.contact}</Td>
                  <Td className="text-muted">{e.license_no ?? "—"}</Td>
                  <Td className="text-ink-soft">{fmtDate(e.hire_date)}</Td>
                  <Td>
                    <Badge tone={e.status === "active" ? "green" : "red"} dot>{e.status}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditing(e); setFormOpen(true); }} className="rounded-lg p-1.5 text-muted transition-all duration-150 hover:bg-brand-soft hover:text-amber-500 dark:hover:text-amber-400 active:scale-95">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(e)} className="rounded-lg p-1.5 text-muted transition-all duration-150 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 active:scale-95">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {employees.length === 0 && <EmptyState title="No employees" subtitle="Add an employee record to get started." />}
      </div>

      <EmployeeForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />

      {viewing && (
        <Modal open onClose={() => setViewing(undefined)} title={viewing.name} wide>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="Role" value={roleLabels[viewing.role]} />
            <Info label="Contact" value={viewing.contact} />
            <Info label="License" value={viewing.license_no ?? "—"} />
            <Info label="Hired" value={fmtDate(viewing.hire_date)} />
          </div>
          {viewing.commission_override != null && (
            <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500 dark:text-amber-400">
              Commission override: {viewing.commission_override}%
            </p>
          )}
          <h4 className="mb-2 text-sm font-semibold text-ink-soft">Trip History ({tripsFor(viewing.id).length})</h4>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-card-soft">
                <tr>
                  <Th>Date</Th>
                  <Th>Transportify</Th>
                  <Th>Gross</Th>
                  <Th>Profit</Th>
                  <Th>Commission</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/70">
                {tripsFor(viewing.id)
                  .sort((a, b) => b.date_time.localeCompare(a.date_time))
                  .slice(0, 50)
                  .map((t) => {
                    const isDriver = t.driver_id === viewing.id;
                    const commission = isDriver ? t.driver_commission : t.helper_commission / (t.helper_ids.length || 1);
                    return (
                      <tr key={t.id}>
                        <Td className="text-ink-soft">{fmtDate(t.date_time)}</Td>
                        <Td className="text-amber-500 dark:text-amber-400">{t.transportify_id}</Td>
                        <Td className="tnum text-ink-soft">{peso0(t.gross)}</Td>
                        <Td className={cx("tnum font-medium", t.gross - t.total_expense - t.driver_commission - t.helper_commission >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>{peso0(t.gross - t.total_expense - t.driver_commission - t.helper_commission)}</Td>
                        <Td className="tnum text-violet-500 dark:text-violet-400">{peso0(commission)}</Td>
                        <Td><Badge tone={t.status === "completed" ? "green" : t.status === "cancelled" ? "red" : t.status === "scheduled" ? "blue" : "amber"}>{t.status}</Badge></Td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-dropdown">
            <h3 className="text-base font-semibold text-ink">Delete employee?</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{confirmDelete.name} will be removed.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(undefined)}>Cancel</Button>
              <Button variant="danger" onClick={() => { employeeActions.remove(confirmDelete.id); setConfirmDelete(undefined); toast("Employee deleted", "success"); }}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function EmployeeForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Employee;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<EmployeeRole>(initial?.role ?? "driver");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [license, setLicense] = useState(initial?.license_no ?? "");
  const [hireDate, setHireDate] = useState(() => {
    if (initial?.hire_date) return initial.hire_date.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  });
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "active");
  const [override, setOverride] = useState(initial?.commission_override?.toString() ?? "");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    if (!contact.trim()) return setError("Contact info is required.");
    if (role === "driver" && !license.trim()) return setError("License number is required for drivers.");

    const payload = {
      name: name.trim(),
      role,
      contact: contact.trim(),
      license_no: role === "driver" ? license.trim() : undefined,
      hire_date: new Date(hireDate).toISOString(),
      status: status as "active" | "inactive",
      commission_override: override ? parseFloat(override) : null,
    };

    if (initial) { employeeActions.update(initial.id, payload); toast("Employee updated", "success"); }
    else { employeeActions.add(payload as any); toast("Employee added", "success"); }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Employee" : "Add Employee"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="emp-form">Save</Button>
        </>
      }
    >
      <form id="emp-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {error && <div className="col-span-full rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 dark:text-red-400">{error}</div>}
        <Field label="Full Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as EmployeeRole)}>
            <option value="driver">Driver</option>
            <option value="helper">Helper</option>
            <option value="staff">Office Staff</option>
          </Select>
        </Field>
        <Field label="Contact Info" required>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone number" />
        </Field>
        {role === "driver" && (
          <Field label="License Number" required>
            <Input value={license} onChange={(e) => setLicense(e.target.value)} />
          </Field>
        )}
        <Field label="Hire Date" required>
          <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Commission Override (%)" hint="Optional — overrides vehicle type and default %" className="sm:col-span-2">
          <Input type="number" min="0" step="0.1" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Leave blank for default rule" />
        </Field>
      </form>
    </Modal>
  );
}
