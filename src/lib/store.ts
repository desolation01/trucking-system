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
                // Save the migrated data back to localStorage
                saveLocal(parsed);
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

let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

// ---------- Supabase data loader ----------

let loadPromise: Promise<void> | null = null;

async function loadFromSupabase(): Promise<void> {
  if (!isConfigured || initialized) return;

  // Timeout — don't let Supabase loading block the app
    const TIMEOUT_MS = 3_000;
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error("Supabase load timed out")), TIMEOUT_MS)
  );

  try {
    const fetchAll = async <T>(table: string): Promise<T[]> => {
      const { data } = await supabase!.from(table).select("*");
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
          fetchVehicleTypes(),
          fetchCompanyProfile(),
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
    console.warn("[Supabase] Failed to load data, using localStorage fallback:", err);
  }

  initialized = true;
}

async function fetchProfilesWithFallback(): Promise<User[]> {
  const { data } = await supabase!.from("profiles").select("*");
  if (!data || data.length === 0) {
    // Try to get user from auth
    const { data: userData } = await supabase!.auth.getUser();
    if (userData?.user) {
      const meta = userData.user.user_metadata;
      return [
        {
          id: userData.user.id,
          name: meta?.name ?? "User",
          email: userData.user.email ?? "",
          password: "",
          role: (meta?.role ?? "staff") as User["role"],
          status: "active",
          created_at: userData.user.created_at ?? new Date().toISOString(),
        },
      ];
    }
    return [];
  }
  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email ?? "",
    password: "",
    role: p.role as User["role"],
    status: p.status as "active" | "inactive",
    created_at: p.created_at,
  }));
}

async function fetchVehicleTypes(): Promise<string[]> {
  const { data } = await supabase!.from("vehicle_types").select("name");
  return (data ?? []).map((r: any) => r.name);
}

async function fetchCompanyProfile(): Promise<AppData["company"]> {
  const { data } = await supabase!.from("company_profile").select("*").limit(1).single();
  if (!data) return seedData.company;
  return {
    name: (data as any).name,
    address: (data as any).address,
    phone: (data as any).phone,
    email: (data as any).email,
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

export const auth = {
  login(email: string, password: string): User | null {
    const user = state.users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password &&
        u.status === "active"
    );
    return user ?? null;
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
  async add(input: TripInput, userId: string): Promise<Trip> {
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
                  console.warn("[Supabase] trip insert error, saving locally:", error);
                } else {
                  savedToCloud = true;
                }
              } catch (err) {
                console.warn("[Supabase] trip insert exception, saving locally:", err);
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
            if (error) console.warn("[Supabase] trip update error, saving locally:", error);
          } catch (err) {
            console.warn("[Supabase] trip update exception, saving locally:", err);
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
        if (isConfigured) {
          try {
            const { error } = await supabase!.from("trips").delete().eq("id", id);
            if (error) console.warn("[Supabase] trip delete error:", error);
          } catch (err) {
            console.warn("[Supabase] trip delete exception:", err);
          }
        }
        mutate((draft) => {
          draft.trips = draft.trips.filter((t) => t.id !== id);
        });
              },

                async deleteAll() {
                  if (isConfigured) {
                    try {
                      const { error } = await supabase!.from("trips").delete().neq("id", "");
                      if (error) console.warn("[Supabase] delete all error:", error);
                    } catch (err) {
                      console.warn("[Supabase] delete all exception:", err);
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

                                                            // Remove existing fuel expenses and add the distributed one
                                                            const newExpenses = [
                                                              ...trip.expense_items.filter((e) => e.category !== "Fuel"),
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
                                if (error) console.warn("[Supabase] diesel dist update error:", error);
                              } catch (err) {
                                console.warn("[Supabase] diesel dist update exception:", err);
                              }
                            }
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

                                    function upsertCustomer(draft: AppData, input: TripInput) {
          const existing = draft.customers.find(
    (c) => c.phone_number === input.customer_phone
  );
  if (!existing && input.customer_phone) {
    draft.customers.push({
      id: uid(),
      phone_number: input.customer_phone,
      name: input.customer_name || undefined,
      created_at: new Date().toISOString(),
    });
  } else if (existing && input.customer_name && !existing.name) {
    existing.name = input.customer_name;
  }
}

// ---------- Employees ----------

export const employeeActions = {
  async add(emp: Omit<Employee, "id" | "created_at">) {
    const record = { ...emp, id: uid(), created_at: new Date().toISOString() };
    if (isConfigured) {
      await supabase!.from("employees").insert(record);
    }
    mutate((draft) => {
      draft.employees.push(record);
    });
  },
  async update(id: string, emp: Partial<Employee>) {
    if (isConfigured) {
      await supabase!.from("employees").update(emp).eq("id", id);
    }
    mutate((draft) => {
      draft.employees = draft.employees.map((e) => (e.id === id ? { ...e, ...emp } : e));
    });
  },
  async remove(id: string) {
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
      await supabase!.from("vehicles").insert(record);
    }
    mutate((draft) => {
      draft.vehicles.push(record);
    });
  },
  async update(id: string, veh: Partial<Vehicle>) {
    if (isConfigured) {
      await supabase!.from("vehicles").update(veh).eq("id", id);
    }
    mutate((draft) => {
      draft.vehicles = draft.vehicles.map((v) => (v.id === id ? { ...v, ...veh } : v));
    });
  },
  async remove(id: string) {
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
  async add(user: Omit<User, "id" | "created_at">, ownerId?: string) {
    if (isConfigured) {
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

      // Insert the profile — owner_id links staff/accountant to the owner who created them
      const profile: any = {
        id: authUserId,
        name: user.name,
        role: user.role,
        status: user.status,
      };
      if (ownerId) profile.owner_id = ownerId;
      await supabase!.from("profiles").insert(profile);

      const record = { ...user, id: authUserId, created_at: new Date().toISOString() };
      mutate((draft) => {
        draft.users.push(record);
      });
      return;
    }
    // Local mode
    const record = { ...user, id: uid(), created_at: new Date().toISOString() };
    mutate((draft) => {
      draft.users.push(record);
    });
  },
  async update(id: string, user: Partial<User>) {
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
    if (isConfigured) {
      await supabase!.from("vehicle_types").insert({ name: type });
    }
    mutate((draft) => {
      if (!draft.vehicleTypes.includes(type)) draft.vehicleTypes.push(type);
    });
  },
  async removeVehicleType(type: string) {
    if (isConfigured) {
      await supabase!.from("vehicle_types").delete().eq("name", type);
    }
    mutate((draft) => {
      draft.vehicleTypes = draft.vehicleTypes.filter((t) => t !== type);
    });
  },
};

// ---------- Reset ----------

export const resetData = () => {
  localStorage.removeItem(STORAGE_KEY);
  state = seedData;
  emit();
};

// ---------- Hook ----------

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore(): AppData {
  // Trigger initial load from Supabase once
  if (isConfigured && !initialized && !loadPromise) {
    loadPromise = loadFromSupabase().then(() => {
      initialized = true;
      emit();
    });
  }
  return useSyncExternalStore(subscribe, () => state);
}

export function useStoreLoading(): boolean {
  // Returns true while Supabase data is being loaded for the first time
  return isConfigured && !initialized;
}

export { state as storeData };

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

// Expose init for login page to await
export const ensureDataLoaded = async () => {
  if (isConfigured && !initialized) {
    if (!loadPromise) loadPromise = loadFromSupabase();
    await loadPromise;
  }
};