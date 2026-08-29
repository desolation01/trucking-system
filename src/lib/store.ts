import { useSyncExternalStore } from "react";
import { supabase, isConfigured } from "./supabase";
import type {
  AppData,
  CommissionRule,
  Customer,
  Employee,
  ExpenseItem,
  PayrollLedgerEntry,
  Trip,
  TripStatus,
  User,
  Vehicle,
} from "./types";
import { seedData } from "./seed";
import { computeCommission } from "./commission";
import { distributeFuel as distributeFuelUtil } from "./fuelDistribution";

const STORAGE_KEY = "trucking-ops-data-v1";

// ---------- Local storage fallback ----------

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && Array.isArray(parsed.trips)) {
        // Migration: strip any legacy plaintext passwords from saved users
        if (Array.isArray(parsed.users)) {
          parsed.users = parsed.users.map((u) => {
            const { password: _legacy, ...rest } = u as User & { password?: string };
            return rest;
          });
        }
        // Migration: update commission rules from "gross" to "profit" basis
        if (parsed.commissionRules) {
          parsed.commissionRules = parsed.commissionRules.map((r) => ({
                      ...r,
                      basis: "profit" as const,
                      // Ensure two_helper_percentage is set (default: 24% total = 12% per helper)
                      two_helper_percentage: r.two_helper_percentage ?? 24,
                    }));
        }
        // Recalculate all existing trips' commissions with the new rules
                        recalcTripCommissions(parsed);
                        // Save the migrated data back to localStorage.
                        // If this fails (quota), the recalc will run again on next load.
                        try { saveLocal(parsed); } catch { /* non-critical */ }
                        return parsed;
      }
    }
  } catch {
    // fall through
  }
  return seedData;
}

function recalcTripCommissions(data: AppData) {
  for (const trip of data.trips) {
    if (trip.status === "cancelled") continue;
    const vehicle = data.vehicles.find((v) => v.id === trip.vehicle_id);
    const driverComm = computeCommission({
      role: "driver",
      employeeIds: trip.driver_id ? [trip.driver_id] : [],
      vehicleType: vehicle?.type ?? "",
      gross: trip.gross,
      expenseItems: trip.expense_items,
      status: trip.status,
    }, data);
    const helperComm = computeCommission({
      role: "helper",
      employeeIds: trip.helper_ids,
      vehicleType: vehicle?.type ?? "",
      gross: trip.gross,
      expenseItems: trip.expense_items,
      status: trip.status,
      split: trip.helper_split,
      splitCustom: trip.helper_split_custom,
    }, data);
    trip.driver_commission = Math.round(driverComm.total * 100) / 100;
    trip.helper_commission = Math.round(helperComm.total * 100) / 100;
  }
}

function saveLocal(state: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- State ----------

let state: AppData = loadLocal();
let currentUserRole: User["role"] | null = null;
let currentUserId: string | null = null;

let initialized = false;
const listeners = new Set<() => void>();

// Cloud error handler — called when a Supabase operation fails.
// The UI registers a handler via registerCloudErrorHandler (e.g., to show toasts).
let cloudErrorHandler: ((message: string) => void) | null = null;

/**
 * Register a callback for cloud sync errors.
 * The UI (Layout.tsx) calls this on mount to wire up toast notifications.
 * Only one handler at a time; pass null to unregister.
 */
export function registerCloudErrorHandler(handler: ((message: string) => void) | null) {
  cloudErrorHandler = handler;
}

/**
 * Internal helper: fires the cloud error handler (if set) and console.warns.
 * This is the single point where all Supabase errors surface.
 */
function reportCloudError(message: string, detail?: unknown) {
  console.warn(`[Supabase] ${message}`, detail);
  cloudErrorHandler?.(message);
}

function emit() {
  listeners.forEach((l) => l());
}

/**
 * Set the current user's role and id for client-side authorization checks.
 * Called by AuthProvider when the authenticated user changes.
 * For local mode, the role is read from the local users record.
 */
export function setCurrentRole(role: User["role"] | null, userId?: string | null) {
  currentUserRole = role;
  if (userId !== undefined) currentUserId = userId;
}

function requireOwner(action: string): void {
  if (currentUserRole && currentUserRole !== "owner") {
    throw new Error(`Permission denied: only the owner can ${action}.`);
  }
}

function requireOwnerOrStaff(action: string): void {
  if (currentUserRole && currentUserRole === "accountant") {
    throw new Error(`Permission denied: accountants have read-only access. Cannot ${action}.`);
  }
}

// ---------- Supabase data loader ----------

interface ProfileRow {
  id: string;
  name: string;
  email?: string;
  role: string;
  status: string;
  created_at: string;
  owner_id?: string;
}

interface VehicleTypeRow {
  name: string;
}

interface CompanyProfileRow {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
}

async function loadFromSupabase(): Promise<void> {
  if (!isConfigured || initialized) return;

  // Timeout — don't let Supabase loading block the app
    const TIMEOUT_MS = 8_000;
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error("Supabase load timed out")), TIMEOUT_MS)
  );

  try {
    // Resolve the current user's tenant id before fetching any data.
    // This lets us add an explicit owner_id filter as a second layer of
    // defense on top of RLS — guards against misconfigured policies.
    const { data: { session } } = await supabase!.auth.getSession();
    const userId = session?.user?.id;

    let resolvedTenantId: string | null = null;
    if (userId) {
      const { data: profileRow } = await supabase!
        .from("profiles")
        .select("id, owner_id, role")
        .eq("id", userId)
        .single();
      resolvedTenantId =
        profileRow?.role === "owner"
          ? userId
          : (profileRow?.owner_id ?? userId);
    }

    const fetchAll = async <T>(table: string): Promise<T[]> => {
      let query = supabase!.from(table).select("*");
      // Apply explicit tenant filter when we know who the user is.
      // RLS is still the primary guard; this is defence-in-depth.
      if (resolvedTenantId) {
        query = (query as any).eq("owner_id", resolvedTenantId);
      }
      const { data } = await query;
      return (data ?? []) as T[];
    };

    // Fetch all tables in parallel with a timeout
    const [users, employees, vehicles, trips, commissionRules, customers, vehicleTypes, companyRows] =
      await Promise.race([
        Promise.all([
          fetchProfilesWithFallback(),
          fetchAll<Employee>("employees"),
          fetchAll<Vehicle>("vehicles"),
          fetchAll<Trip>("trips"),
          fetchAll<CommissionRule>("commission_rules"),
          fetchAll<Customer>("customers"),
          fetchVehicleTypes(resolvedTenantId),
          fetchCompanyProfile(resolvedTenantId),
        ]),
        timeout,
      ]) as any;

          // Only overlay Supabase data if it actually has content
              if (trips.length > 0) {
                // Fix: old data had expense_items & helper_split_custom stored as JSON strings
                // (from the previous JSON.stringify() bug). Normalize them back to arrays/objects.
                for (const t of trips) {
                  if (typeof t.expense_items === "string") {
                    try { t.expense_items = JSON.parse(t.expense_items); } catch { t.expense_items = []; }
                  }
                  if (typeof t.helper_split_custom === "string") {
                    try { t.helper_split_custom = JSON.parse(t.helper_split_custom); } catch { t.helper_split_custom = {}; }
                  }
                }
                state.trips = trips;
              }
    if (employees.length > 0) state.employees = employees;
    if (vehicles.length > 0) state.vehicles = vehicles;
    if (customers.length > 0) state.customers = customers;
    if (commissionRules.length > 0) {
      // Migration: ensure all commission rules use "profit" basis
      state.commissionRules = commissionRules.map((r: CommissionRule) => ({
              ...r,
              basis: "profit" as const,
              two_helper_percentage: r.two_helper_percentage ?? 24,
            }));
    }
    if (users.length > 0) state.users = users;
    if (vehicleTypes.length > 0) state.vehicleTypes = vehicleTypes;
    if (companyRows.name) state.company = companyRows;

        // Recalculate all trips' commissions with the corrected rules
        recalcTripCommissions(state);
        recomputeLedger();
        persist();
  } catch (err) {
    reportCloudError("Failed to load data from Supabase, using localStorage fallback", err);
  }

  initialized = true;
}

async function fetchProfilesWithFallback(): Promise<User[]> {
  const { data } = await supabase!.from("profiles").select("*");
  if (!data || data.length === 0) {
    // No profile rows = unprovisioned. NEVER synthesize a user from
    // user_metadata.role — it is client-supplied and would let anyone
    // claim "owner" (C2 fix — SECURITY-AUDIT.md).
    return [];
  }
  return data.map((p: ProfileRow) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? "",
      role: p.role as User["role"],
      status: p.status as "active" | "inactive",
      created_at: p.created_at,
    }));
}

async function fetchVehicleTypes(tenantId?: string | null): Promise<string[]> {
  let query = supabase!.from("vehicle_types").select("name");
  if (tenantId) query = (query as any).eq("owner_id", tenantId);
  const { data } = await query;
  return (data ?? []).map((r: VehicleTypeRow) => r.name);
}

async function fetchCompanyProfile(tenantId?: string | null): Promise<AppData["company"]> {
  let query = supabase!.from("company_profile").select("*").limit(1);
  if (tenantId) query = (query as any).eq("owner_id", tenantId);
  const { data } = await (query as any).maybeSingle();
  if (!data) return { ...seedData.company };
    return {
      name: (data as CompanyProfileRow).name,
      address: (data as CompanyProfileRow).address,
      phone: (data as CompanyProfileRow).phone,
      email: (data as CompanyProfileRow).email,
    };
}

// ---------- Local helpers ----------

function persist() {
  saveLocal(state); // Always save to localStorage as backup
}

function recomputeLedger() {
  const ledger: PayrollLedgerEntry[] = [];
  for (const t of state.trips) {
    if (t.driver_commission > 0) {
      ledger.push({
        id: `led-${t.id}-d`,
        employee_id: t.driver_id,
        trip_id: t.id,
        amount: t.driver_commission,
        basis_used: "profit",
        basis_amount: t.profit,
        percentage: 0,
        date: t.date_time,
      });
    }
    for (const h of t.helper_ids) {
      const share = t.helper_ids.length > 1 ? t.helper_commission / t.helper_ids.length : t.helper_commission;
      ledger.push({
        id: `led-${t.id}-h-${h}`,
        employee_id: h,
        trip_id: t.id,
        amount: Math.round(share * 100) / 100,
        basis_used: "profit",
        basis_amount: t.profit,
        percentage: 0,
        date: t.date_time,
      });
    }
  }
  state.payrollLedger = ledger;
}

function apply(next: AppData) {
  state = next;
  recomputeLedger();
  persist();
  emit();
}

function mutate(fn: (draft: AppData) => void) {
  const next: AppData = {
    ...state,
    users: [...state.users],
    employees: [...state.employees],
    vehicles: [...state.vehicles],
    trips: [...state.trips],
    commissionRules: [...state.commissionRules],
    payrollLedger: [...state.payrollLedger],
    customers: [...state.customers],
    vehicleTypes: [...state.vehicleTypes],
    company: { ...state.company },
  };
  fn(next);
  apply(next);
}

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

// ---------- Auth ----------
// Local mode uses a hardcoded mapping of demo emails to a single shared dev password.
// Plaintext per-user passwords are no longer stored in the User type.
// For real auth, configure Supabase and use the AuthProvider flow instead.
const LOCAL_DEV_PASSWORD = "demo1234";
const localDevAccounts: Record<string, User["role"]> = {
  "owner@trucking.ph": "owner",
  "grace@trucking.ph": "staff",
  "carlo@trucking.ph": "accountant",
};

export const auth = {
  /**
   * Local-mode login for the demo / offline experience.
   * Accepts any demo email + the shared dev password "demo1234".
   * Returns the user record (without password) if credentials are valid.
   * Real production auth goes through Supabase Auth in lib/auth.tsx.
   */
  login(email: string, password: string): User | null {
    const normalized = email.trim().toLowerCase();
    if (password !== LOCAL_DEV_PASSWORD) return null;
    const role = localDevAccounts[normalized];
    if (!role) return null;
    return (
      state.users.find(
        (u) => u.email.toLowerCase() === normalized && u.status === "active"
      ) ?? null
    );
  },
};

// ---------- Trips ----------

export interface TripInput {
  driver_id: string;
  helper_ids: string[];
  vehicle_id: string;
  transportify_id: string;
  cargo_weight?: number;
  cargo_dimensions?: string;
  km_traveled?: number;
  customer_phone: string;
  customer_name?: string;
  pickup_address: string;
  dropoff_address: string;
  items?: string;
  description?: string;
  gross: number;
  expense_items: ExpenseItem[];
  helper_split: Trip["helper_split"];
  helper_split_custom: Record<string, number>;
  date_time: string;
  status: TripStatus;
}

export const tripActions = {
  async add(input: TripInput, userId: string): Promise<{ trip: Trip; savedToCloud: boolean }> {
    const vehicle = state.vehicles.find((v) => v.id === input.vehicle_id);
    const driver = state.employees.find((e) => e.id === input.driver_id);
    const nowIso = new Date().toISOString();

    const driverComm = computeCommission(
      {
        role: "driver",
        employeeIds: driver ? [driver.id] : [],
        vehicleType: vehicle?.type ?? "",
        gross: input.gross,
        expenseItems: input.expense_items,
        status: input.status,
      },
      state
    );
    const helperComm = computeCommission(
      {
        role: "helper",
        employeeIds: input.helper_ids,
        vehicleType: vehicle?.type ?? "",
        gross: input.gross,
        expenseItems: input.expense_items,
        status: input.status,
        split: input.helper_split,
        splitCustom: input.helper_split_custom,
      },
      state
    );

    const totalExpense = input.expense_items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const trip: Trip = {
          id: uid(),
          driver_id: input.driver_id,
          helper_ids: input.helper_ids,
          vehicle_id: input.vehicle_id,
          transportify_id: input.transportify_id,
          cargo_weight: input.cargo_weight,
          cargo_dimensions: input.cargo_dimensions,
          km_traveled: input.km_traveled,
          customer_phone: input.customer_phone,
          customer_name: input.customer_name,
      pickup_address: input.pickup_address,
      dropoff_address: input.dropoff_address,
      items: input.items,
      description: input.description,
      images: [],
      gross: Number(input.gross) || 0,
      expense_items: input.expense_items,
      total_expense: totalExpense,
      profit: (Number(input.gross) || 0) - totalExpense - driverComm.total - helperComm.total,
      driver_commission: Math.round(driverComm.total * 100) / 100,
      helper_commission: Math.round(helperComm.total * 100) / 100,
      helper_split: input.helper_split,
      helper_split_custom: input.helper_split_custom,
      date_time: input.date_time,
      status: input.status,
      created_by: userId,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let savedToCloud = false;
        if (isConfigured) {
              try {
                const { error } = await supabase!.from("trips").insert({
                                          ...trip,
                                          helper_ids: trip.helper_ids.length > 0 ? trip.helper_ids : [],
                                          expense_items: trip.expense_items,
                                          helper_split_custom: trip.helper_split_custom,
                                          images: trip.images.length > 0 ? trip.images : [],
                });
                if (error) {
                                  reportCloudError(`Failed to insert trip ${trip.transportify_id}`, error);
                                } else {
                                  savedToCloud = true;
                                }
                              } catch (err) {
                                reportCloudError(`Exception inserting trip ${trip.transportify_id}`, err);
              }
            }

            mutate((draft) => {
              draft.trips = [trip, ...draft.trips];
              upsertCustomer(draft, input);
            });
            return { trip, savedToCloud };
          },

  async update(id: string, input: TripInput, _userId: string) {
    const existing = state.trips.find((t) => t.id === id);
    if (!existing) return;
    const vehicle = state.vehicles.find((v) => v.id === input.vehicle_id);
    const driver = state.employees.find((e) => e.id === input.driver_id);

    const driverComm = computeCommission(
      {
        role: "driver",
        employeeIds: driver ? [driver.id] : [],
        vehicleType: vehicle?.type ?? "",
        gross: input.gross,
        expenseItems: input.expense_items,
        status: input.status,
      },
      state
    );
    const helperComm = computeCommission(
      {
        role: "helper",
        employeeIds: input.helper_ids,
        vehicleType: vehicle?.type ?? "",
        gross: input.gross,
        expenseItems: input.expense_items,
        status: input.status,
        split: input.helper_split,
        splitCustom: input.helper_split_custom,
      },
      state
    );

    const totalExpense = input.expense_items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const updatedAt = new Date().toISOString();

    const updates = {
      driver_id: input.driver_id,
      helper_ids: input.helper_ids.length > 0 ? input.helper_ids : [],
      vehicle_id: input.vehicle_id,
      transportify_id: input.transportify_id,
      cargo_weight: input.cargo_weight,
            cargo_dimensions: input.cargo_dimensions,
            km_traveled: input.km_traveled,
            customer_phone: input.customer_phone,
      customer_name: input.customer_name,
      pickup_address: input.pickup_address,
      dropoff_address: input.dropoff_address,
      items: input.items,
      description: input.description,
      gross: Number(input.gross) || 0,
      expense_items: input.expense_items,
            total_expense: totalExpense,
            profit: (Number(input.gross) || 0) - totalExpense - driverComm.total - helperComm.total,
            driver_commission: Math.round(driverComm.total * 100) / 100,
            helper_commission: Math.round(helperComm.total * 100) / 100,
            helper_split: input.helper_split,
            helper_split_custom: input.helper_split_custom,
      date_time: input.date_time,
      status: input.status,
      updated_at: updatedAt,
    };

    if (isConfigured) {
          try {
            const { error } = await supabase!.from("trips").update(updates).eq("id", id);
            if (error) reportCloudError(`Failed to update trip ${id}`, error);
                      } catch (err) {
                        reportCloudError(`Exception updating trip ${id}`, err);
          }
        }

        mutate((draft) => {
          draft.trips = draft.trips.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...input,
                  gross: Number(input.gross) || 0,
                  total_expense: totalExpense,
                  profit: (Number(input.gross) || 0) - totalExpense - driverComm.total - helperComm.total,
                  driver_commission: Math.round(driverComm.total * 100) / 100,
                  helper_commission: Math.round(helperComm.total * 100) / 100,
                  updated_at: updatedAt,
                }
              : t
          );
          upsertCustomer(draft, input);
        });
      },

  async remove(id: string) {
        try { requireOwner("delete trips"); } catch (e) { console.warn("[Auth]", e); throw e; }
        if (isConfigured) {
          try {
            const { error } = await supabase!.from("trips").delete().eq("id", id);
            if (error) reportCloudError(`Failed to delete trip ${id}`, error);
                      } catch (err) {
                        reportCloudError(`Exception deleting trip ${id}`, err);
          }
        }
        mutate((draft) => {
          draft.trips = draft.trips.filter((t) => t.id !== id);
        });
              },

                async deleteAll() {
                  try { requireOwner("delete all trips"); } catch (e) { console.warn("[Auth]", e); throw e; }
                  if (isConfigured) {
                    try {
                      // Get the authoritative tenant ID from the live Supabase session.
                      const { data: { session } } = await supabase!.auth.getSession();
                      const tenantId = session?.user?.id ?? currentUserId;
                      if (!tenantId) {
                        throw new Error("Cannot delete trips: no authenticated user found.");
                      }
                      const { error } = await supabase!.from("trips").delete().eq("owner_id", tenantId);
                      if (error) reportCloudError("Failed to delete all trips", error);
                                          } catch (err) {
                                            reportCloudError("Exception deleting all trips", err);
                                            throw err;
                    }
                  }
                  mutate((draft) => {
                    draft.trips = [];
                  });
                },

                /**
                 * Distribute a fuel expense across trips sharing the same vehicle,
                 * proportionally by KM traveled.
                 */
                distributeFuel(fuelExpenseId: string, sourceTripId: string) {
      const updated = distributeFuelUtil(fuelExpenseId, sourceTripId, state);
      if (!updated) return;
      mutate((draft) => {
        for (const ut of updated) {
          const idx = draft.trips.findIndex((t) => t.id === ut.id);
          if (idx !== -1) draft.trips[idx] = ut;
        }
              });
            },

            /**
                         * Distribute a total diesel cost evenly across selected trips.
                         * Adds a Fuel expense to each trip and recalculates profit + commissions.
                         */
                        async distributeDiesel(
                                      tripIds: string[],
                                      totalFuelCost: number
                                    ) {
                                      if (tripIds.length === 0 || totalFuelCost <= 0) return;
                                      // Prevent concurrent calls from double-click races
                                      if ((tripActions as any).__distributing) return;
                                      (tripActions as any).__distributing = true;
                                      try {

                          const now = new Date().toISOString();
                          const updatedTrips: Trip[] = [];

                          mutate((draft) => {
                            const trips = tripIds.map((id) => draft.trips.find((t) => t.id === id)).filter(Boolean) as Trip[];
                            const totalKm = trips.reduce((sum, t) => sum + (t.km_traveled ?? 0), 0);
                            if (totalKm <= 0) return;

                            for (const trip of trips) {
                                                          const idx = draft.trips.findIndex((t) => t.id === trip.id);
                                                          if (idx === -1) continue;

                                                          const km = trip.km_traveled ?? 0;
                                                          const tripShare = Math.round((km / totalKm) * totalFuelCost * 100) / 100;
                                                          if (tripShare <= 0) continue;

                                                          const note = `Diesel dist: ${km}km/${totalKm}km · ₱${tripShare.toFixed(2)}`;

                              const fuelExpense: ExpenseItem = {
                                                              id: `diesel-dist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                                              category: "Fuel",
                                                              amount: tripShare,
                                                              note,
                                                            };

                                                            // Remove existing fuel expenses AND any previously distributed
                                                                                                                        // diesel-dist items, then add the new distributed one.
                                                                                                                        // This prevents double-counting on re-distribution.
                                                                                                                        const newExpenses = [
                                                                                                                          ...trip.expense_items.filter(
                                                                                                                            (e) => e.category !== "Fuel" && !e.id.startsWith("diesel-dist-")
                                                                                                                          ),
                                                                                                                          fuelExpense,
                                                                                                                        ];
                                                            const totalExpense = newExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

                                                            const vehicle = draft.vehicles.find((v) => v.id === trip.vehicle_id);
                                                            const driverComm = computeCommission({
                                                              role: "driver",
                                                              employeeIds: trip.driver_id ? [trip.driver_id] : [],
                                                              vehicleType: vehicle?.type ?? "",
                                                              gross: trip.gross,
                                                              expenseItems: newExpenses,
                                                              status: trip.status,
                                                            }, draft);
                                                            const helperComm = computeCommission({
                                                              role: "helper",
                                                              employeeIds: trip.helper_ids,
                                                              vehicleType: vehicle?.type ?? "",
                                                              gross: trip.gross,
                                                              expenseItems: newExpenses,
                                                              status: trip.status,
                                                              split: trip.helper_split,
                                                              splitCustom: trip.helper_split_custom,
                                                            }, draft);

                                                            const profit = trip.gross - totalExpense - driverComm.total - helperComm.total;

                              const updated: Trip = {
                                ...trip,
                                expense_items: newExpenses,
                                total_expense: totalExpense,
                                profit,
                                driver_commission: Math.round(driverComm.total * 100) / 100,
                                helper_commission: Math.round(helperComm.total * 100) / 100,
                                updated_at: now,
                              };

                              draft.trips[idx] = updated;
                              updatedTrips.push(updated);
                            }

                                                        const logEntry = {
                              id: `dlog-${Date.now()}`,
                              timestamp: now,
                              totalFuelCost,
                              totalKm,
                              tripCount: tripIds.length,
                              tripIds: [...tripIds],
                            };
                            try {
                              const raw = localStorage.getItem("diesel-dist-logs");
                              const logs = raw ? JSON.parse(raw) : [];
                              logs.unshift(logEntry);
                              localStorage.setItem("diesel-dist-logs", JSON.stringify(logs.slice(0, 50)));
                            } catch { /* ignore */ }
                          });

                          // Sync updated trips to Supabase
                          if (isConfigured && updatedTrips.length > 0) {
                            for (const t of updatedTrips) {
                              try {
                                const { error } = await supabase!.from("trips").update({
                                  expense_items: t.expense_items,
                                  total_expense: t.total_expense,
                                  profit: t.profit,
                                  driver_commission: t.driver_commission,
                                  helper_commission: t.helper_commission,
                                  updated_at: now,
                                }).eq("id", t.id);
                                if (error) reportCloudError(`Failed to sync diesel dist for trip ${t.id}`, error);
                                                              } catch (err) {
                                                                reportCloudError(`Exception syncing diesel dist for trip ${t.id}`, err);
                              }
                            }
                          }
                                                  } finally {
                                                    (tripActions as any).__distributing = false;
                                                  }
                                                },
                                                                                          };

                                                                        /** Remove diesel-dist expenses from a set of trips and recalculate commissions */
                        export function undoDieselDist(tripIds: string[]) {
                          mutate((draft) => {
                            for (const id of tripIds) {
                              const idx = draft.trips.findIndex((t) => t.id === id);
                              if (idx === -1) continue;
                              const trip = draft.trips[idx];
                              const newExpenses = trip.expense_items.filter((e) => !e.id.startsWith("diesel-dist-"));
                              if (newExpenses.length === trip.expense_items.length) continue; // no change

                              const totalExpense = newExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                              const vehicle = draft.vehicles.find((v) => v.id === trip.vehicle_id);
                              const driverComm = computeCommission({
                                role: "driver",
                                employeeIds: trip.driver_id ? [trip.driver_id] : [],
                                vehicleType: vehicle?.type ?? "",
                                gross: trip.gross,
                                expenseItems: newExpenses,
                                status: trip.status,
                              }, draft);
                              const helperComm = computeCommission({
                                role: "helper",
                                employeeIds: trip.helper_ids,
                                vehicleType: vehicle?.type ?? "",
                                gross: trip.gross,
                                expenseItems: newExpenses,
                                status: trip.status,
                                split: trip.helper_split,
                                splitCustom: trip.helper_split_custom,
                              }, draft);

                              draft.trips[idx] = {
                                ...trip,
                                expense_items: newExpenses,
                                total_expense: totalExpense,
                                profit: trip.gross - totalExpense - driverComm.total - helperComm.total,
                                driver_commission: Math.round(driverComm.total * 100) / 100,
                                helper_commission: Math.round(helperComm.total * 100) / 100,
                                updated_at: new Date().toISOString(),
                              };
                            }
                          });
                        }

                // Accepts PH mobile (09xxxxxxxxx), landline ((02) 8xxx-xxxx), or any
// 7–15 digit string optionally containing spaces, dashes, parens, +.
const PHONE_RE = /^[\d\s()+\-]{7,20}$/;

function upsertCustomer(draft: AppData, input: TripInput) {
  const phone = input.customer_phone?.trim();
  if (!phone || !PHONE_RE.test(phone)) return;
  const existing = draft.customers.find((c) => c.phone_number === phone);
  if (!existing) {
    draft.customers.push({
      id: uid(),
      phone_number: phone,
      name: input.customer_name || undefined,
      created_at: new Date().toISOString(),
    });
  } else if (input.customer_name && !existing.name) {
    existing.name = input.customer_name;
  }
}

// ---------- Employees ----------

export const employeeActions = {
  async add(emp: Omit<Employee, "id" | "created_at">) {
    const record = { ...emp, id: uid(), created_at: new Date().toISOString() };
    if (isConfigured) {
      const { error } = await supabase!.from("employees").insert(record);
      if (error) {
        reportCloudError(`Failed to add employee "${record.name}"`, error);
        throw new Error(error.message);
      }
    }
    mutate((draft) => {
      draft.employees.push(record);
    });
  },
  async update(id: string, emp: Partial<Employee>) {
    try { requireOwnerOrStaff("update employees"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      const { error } = await supabase!.from("employees").update(emp).eq("id", id);
      if (error) {
        reportCloudError(`Failed to update employee ${id}`, error);
        throw new Error(error.message);
      }
    }
    mutate((draft) => {
      draft.employees = draft.employees.map((e) => (e.id === id ? { ...e, ...emp } : e));
    });
  },
  async remove(id: string) {
    try { requireOwner("delete employees"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      await supabase!.from("employees").delete().eq("id", id);
    }
    mutate((draft) => {
      draft.employees = draft.employees.filter((e) => e.id !== id);
    });
  },
};

// ---------- Vehicles ----------

export const vehicleActions = {
  async add(veh: Omit<Vehicle, "id" | "created_at">) {
    const record = { ...veh, id: uid(), created_at: new Date().toISOString() };
    if (isConfigured) {
      const { error } = await supabase!.from("vehicles").insert(record);
      if (error) {
        reportCloudError(`Failed to add vehicle "${record.plate_number}"`, error);
        throw new Error(error.message);
      }
    }
    mutate((draft) => {
      draft.vehicles.push(record);
    });
  },
  async update(id: string, veh: Partial<Vehicle>) {
    try { requireOwnerOrStaff("update vehicles"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      const { error } = await supabase!.from("vehicles").update(veh).eq("id", id);
      if (error) {
        reportCloudError(`Failed to update vehicle ${id}`, error);
        throw new Error(error.message);
      }
    }
    mutate((draft) => {
      draft.vehicles = draft.vehicles.map((v) => (v.id === id ? { ...v, ...veh } : v));
    });
  },
  async remove(id: string) {
    try { requireOwner("delete vehicles"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      await supabase!.from("vehicles").delete().eq("id", id);
    }
    mutate((draft) => {
      draft.vehicles = draft.vehicles.filter((v) => v.id !== id);
    });
  },
};

// ---------- Users ----------

export const userActions = {
  /**
   * Add a new user. The password is sent to Supabase Auth (signUp) for real
   * authentication — it is NEVER stored on the User record or in any
   * client-side state. The User type no longer carries a password field.
   */
  async add(user: Omit<User, "id" | "created_at"> & { password: string }, ownerId?: string) {
    try { requireOwner("add users"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      // RLS v4 (008): tenant owners may only provision staff/accountant profiles.
      // Additional owner accounts are created in the Supabase Dashboard instead.
      if (user.role === "owner") {
        throw new Error(
          "Additional owner accounts must be created in the Supabase Dashboard (Authentication → Users). Staff and accountant accounts can be added here."
        );
      }
      // Create the auth user first via Supabase Auth
      const { data: authData, error: authError } = await supabase!.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: { name: user.name, role: user.role },
        },
      });
      if (authError) throw new Error(authError.message);
      const authUserId = authData.user?.id;
      if (!authUserId) throw new Error("Failed to create auth user");

      // Insert the profile — owner_id links staff/accountant to the owner who created them.
      // Never persist the password to the profiles table.
      const profile: Partial<ProfileRow> = {
        id: authUserId,
        name: user.name,
        role: user.role,
        status: user.status,
      };
      if (ownerId) profile.owner_id = ownerId;
      await supabase!.from("profiles").insert(profile);

      const record: User = {
        id: authUserId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        created_at: new Date().toISOString(),
      };
      mutate((draft) => {
        draft.users.push(record);
      });
      return;
    }
    // Local mode: no password stored on user record
    const record: User = {
      id: uid(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: new Date().toISOString(),
    };
    mutate((draft) => {
      draft.users.push(record);
    });
  },
  async update(id: string, user: Partial<User>) {
    try { requireOwner("update users"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      await supabase!.from("profiles").update({
        name: user.name,
        role: user.role,
        status: user.status,
      }).eq("id", id);
    }
    mutate((draft) => {
      draft.users = draft.users.map((u) => (u.id === id ? { ...u, ...user } : u));
    });
  },
  async remove(id: string) {
    try { requireOwner("delete users"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      await supabase!.from("profiles").delete().eq("id", id);
    }
    mutate((draft) => {
      draft.users = draft.users.filter((u) => u.id !== id);
    });
  },
};

// ---------- Commission rules ----------

export const ruleActions = {
  async update(id: string, rule: CommissionRule) {
    try { requireOwner("update commission rules"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      await supabase!.from("commission_rules").update({
              basis: rule.basis,
              default_percentage: rule.default_percentage,
              two_helper_percentage: rule.two_helper_percentage ?? null,
              vehicle_type_overrides: JSON.stringify(rule.vehicle_type_overrides),
        employee_overrides: JSON.stringify(rule.employee_overrides),
        min_guaranteed_pay: rule.min_guaranteed_pay,
        split_mode: rule.split_mode,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
    }
    mutate((draft) => {
      draft.commissionRules = draft.commissionRules.map((r) =>
        r.id === id ? { ...rule, updated_at: new Date().toISOString() } : r
      );
    });
  },
};

// ---------- Settings ----------

export const settingsActions = {
  async setCompany(company: AppData["company"]) {
    try { requireOwner("edit company profile"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      const { data: existing } = await supabase!.from("company_profile").select("id").limit(1);
      if (existing && existing.length > 0) {
        await supabase!.from("company_profile").update(company).eq("id", existing[0].id);
      } else {
        await supabase!.from("company_profile").insert(company);
      }
    }
    mutate((draft) => {
      draft.company = { ...company };
    });
  },
  async addVehicleType(type: string) {
    try { requireOwnerOrStaff("add vehicle types"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      await supabase!.from("vehicle_types").insert({ name: type });
    }
    mutate((draft) => {
      if (!draft.vehicleTypes.includes(type)) draft.vehicleTypes.push(type);
    });
  },
  async removeVehicleType(type: string) {
    try { requireOwner("remove vehicle types"); } catch (e) { console.warn("[Auth]", e); throw e; }
    if (isConfigured) {
      await supabase!.from("vehicle_types").delete().eq("name", type);
    }
    mutate((draft) => {
      draft.vehicleTypes = draft.vehicleTypes.filter((t) => t !== type);
    });
  },
};

// ---------- Reset ----------

// ---------- Reset & Demo Data ----------

export const resetData = async () => {
  try { requireOwner("reset all data"); } catch (e) { console.warn("[Auth]", e); throw e; }

  if (isConfigured) {
    const { data: { session } } = await supabase!.auth.getSession();
    const userId = session?.user?.id ?? currentUserId;
    if (!userId) throw new Error("Cannot reset: no authenticated user found.");

    const { data: profileRow } = await supabase!
      .from("profiles").select("id, owner_id, role").eq("id", userId).single();
    const resolvedTenantId =
      profileRow?.role === "owner" ? userId : (profileRow?.owner_id ?? userId);

    // Delete all tenant-scoped rows — blank slate, no re-seed
    const tables = [
      "calc_logs", "payroll_ledger", "trips", "customers",
      "employees", "vehicles", "vehicle_types", "commission_rules", "company_profile",
    ] as const;
    for (const table of tables) {
      try {
        const { error } = await supabase!.from(table).delete().eq("owner_id", resolvedTenantId);
        if (error) reportCloudError(`Failed to reset table "${table}"`, error);
      } catch (err) { reportCloudError(`Exception resetting table "${table}"`, err); }
    }
  }

  // Apply empty state locally
  localStorage.removeItem(STORAGE_KEY);
  const blank: AppData = {
    users: state.users,
    employees: [],
    vehicles: [],
    trips: [],
    commissionRules: [],
    payrollLedger: [],
    customers: [],
    vehicleTypes: [],
    company: { ...seedData.company },
  };
  initialized = true;
  apply(blank);
};

export const loadDemoData = async () => {
  try { requireOwner("load demo data"); } catch (e) { console.warn("[Auth]", e); throw e; }

  if (isConfigured) {
    const { data: { session } } = await supabase!.auth.getSession();
    const userId = session?.user?.id ?? currentUserId;
    if (!userId) throw new Error("Cannot load demo data: no authenticated user found.");

    const { data: profileRow } = await supabase!
      .from("profiles").select("id, owner_id, role").eq("id", userId).single();
    const resolvedTenantId =
      profileRow?.role === "owner" ? userId : (profileRow?.owner_id ?? userId);

    const tag = { owner_id: resolvedTenantId };
    const suffix = resolvedTenantId.slice(0, 8);
    const now = new Date().toISOString();

    // Build id maps so trips can reference the right employee/vehicle ids
    const empIdMap: Record<string, string> = {};
    seedData.employees.forEach((e) => { empIdMap[e.id] = `${e.id}-${suffix}`; });
    const vehIdMap: Record<string, string> = {};
    seedData.vehicles.forEach((v) => { vehIdMap[v.id] = `${v.id}-${suffix}`; });

    // Vehicle types
    try {
      await supabase!.from("vehicle_types").insert(
        seedData.vehicleTypes.map((name) => ({
          ...tag, name,
          id: `vt-${name.replace(/\s+/g, "-").toLowerCase()}-${suffix}`,
        }))
      );
    } catch (err) { reportCloudError("Failed to seed vehicle_types", err); }

    // Employees
    const seedEmps = seedData.employees
      .filter((e) => e.role === "driver" || e.role === "helper")
      .map((e) => ({
        id: empIdMap[e.id], ...tag, user_id: null,
        name: e.name, role: e.role, contact: e.contact,
        license_no: e.license_no ?? null, hire_date: e.hire_date,
        status: e.status, commission_override: e.commission_override ?? null,
        base_salary: e.base_salary ?? 0, created_at: e.created_at ?? now,
      }));
    if (seedEmps.length > 0) {
      try { await supabase!.from("employees").insert(seedEmps); }
      catch (err) { reportCloudError("Failed to seed employees", err); }
    }

    // Vehicles
    const seedVehs = seedData.vehicles.map((v) => ({
      id: vehIdMap[v.id], ...tag,
      plate_number: `${v.plate_number}-${suffix}`,
      type: v.type, capacity_kg: v.capacity_kg, status: v.status,
      driver_id: v.driver_id ? (empIdMap[v.driver_id] ?? null) : null,
      created_at: v.created_at ?? now,
    }));
    if (seedVehs.length > 0) {
      try { await supabase!.from("vehicles").insert(seedVehs); }
      catch (err) { reportCloudError("Failed to seed vehicles", err); }
    }

    // Commission rules
    const seedRules = seedData.commissionRules.map((r) => ({
      id: `${r.id}-${suffix}`, ...tag,
      role: r.role, basis: r.basis,
      default_percentage: r.default_percentage,
      two_helper_percentage: r.two_helper_percentage ?? null,
      vehicle_type_overrides: r.vehicle_type_overrides,
      employee_overrides: r.employee_overrides,
      min_guaranteed_pay: r.min_guaranteed_pay ?? 0,
      split_mode: r.split_mode ?? "equal", updated_at: now,
    }));
    if (seedRules.length > 0) {
      try { await supabase!.from("commission_rules").insert(seedRules); }
      catch (err) { reportCloudError("Failed to seed commission_rules", err); }
    }

    // Company profile
    try {
      await supabase!.from("company_profile").insert({
        id: `company-${suffix}`, ...tag, ...seedData.company,
      });
    } catch (err) { reportCloudError("Failed to seed company_profile", err); }

    // Trips — insert in batches of 20 to avoid request size limits
    const seedTripsTagged = seedData.trips.map((t) => ({
      ...t,
      ...tag,
      id: `${t.id}-${suffix}`,
      driver_id: empIdMap[t.driver_id] ?? t.driver_id,
      helper_ids: t.helper_ids.map((h) => empIdMap[h] ?? h),
      vehicle_id: vehIdMap[t.vehicle_id] ?? t.vehicle_id,
      created_by: resolvedTenantId,
    }));
    const BATCH = 20;
    for (let i = 0; i < seedTripsTagged.length; i += BATCH) {
      const batch = seedTripsTagged.slice(i, i + BATCH);
      try { await supabase!.from("trips").insert(batch); }
      catch (err) { reportCloudError(`Failed to seed trips batch ${i}`, err); }
    }

    // Customers
    const seedCustomers = seedData.customers.map((c) => ({
      ...c, ...tag,
      id: `${c.id}-${suffix}`,
      phone_number: `${c.phone_number}-${suffix}`,
    }));
    if (seedCustomers.length > 0) {
      try { await supabase!.from("customers").insert(seedCustomers); }
      catch (err) { reportCloudError("Failed to seed customers", err); }
    }
  }

  // Apply full seed locally with suffixed ids
  const userId = currentUserId ?? "local";
  const suffix = isConfigured ? userId.slice(0, 8) : "demo";
  const empIdMap: Record<string, string> = {};
  seedData.employees.forEach((e) => { empIdMap[e.id] = `${e.id}-${suffix}`; });
  const vehIdMap: Record<string, string> = {};
  seedData.vehicles.forEach((v) => { vehIdMap[v.id] = `${v.id}-${suffix}`; });

  const localDemo: AppData = {
    users: state.users,
    vehicleTypes: [...seedData.vehicleTypes],
    company: { ...seedData.company },
    employees: seedData.employees
      .filter((e) => e.role === "driver" || e.role === "helper")
      .map((e) => ({ ...e, id: `${e.id}-${suffix}` })),
    vehicles: seedData.vehicles.map((v) => ({
      ...v,
      id: `${v.id}-${suffix}`,
      plate_number: isConfigured ? `${v.plate_number}-${suffix}` : v.plate_number,
      driver_id: v.driver_id ? (empIdMap[v.driver_id] ?? undefined) : undefined,
    })),
    commissionRules: seedData.commissionRules.map((r) => ({ ...r, id: `${r.id}-${suffix}` })),
    trips: seedData.trips.map((t) => ({
      ...t,
      id: `${t.id}-${suffix}`,
      driver_id: empIdMap[t.driver_id] ?? t.driver_id,
      helper_ids: t.helper_ids.map((h) => empIdMap[h] ?? h),
      vehicle_id: vehIdMap[t.vehicle_id] ?? t.vehicle_id,
    })),
    customers: seedData.customers.map((c) => ({
      ...c,
      id: `${c.id}-${suffix}`,
      phone_number: isConfigured ? `${c.phone_number}-${suffix}` : c.phone_number,
    })),
    payrollLedger: [],
  };

  initialized = true;
  apply(localDemo);
};

// ---------- Hook ----------

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore(): AppData {
  return useSyncExternalStore(subscribe, () => state);
}

export function useStoreLoading(): boolean {
  // Returns true while Supabase data is being loaded for the first time
  return isConfigured && !initialized;
}

// Auto-initialize Supabase load once, on module import.
// The `initialized` flag is set synchronously BEFORE the async load starts,
// so concurrent calls to useStore() from multiple components never race.
if (isConfigured && !initialized) {
  initialized = true;
  loadFromSupabase().then(() => {
    emit();
  });
}

// ── Diesel distribution helpers ──────────────────────────────────────────

export interface DieselDistLog {
  id: string;
  timestamp: string;
  totalFuelCost: number;
  totalKm: number;
  tripCount: number;
  tripIds: string[];
}

export function getDieselDistLogs(): DieselDistLog[] {
  try {
    const raw = localStorage.getItem("diesel-dist-logs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Check if a trip has already been through diesel distribution */
export function hasDieselDist(trip: Trip): boolean {
  return trip.expense_items?.some((e) => e.id.startsWith("diesel-dist-")) ?? false;
}