import { describe, it, expect } from "vitest";
import { distributeFuel } from "./fuelDistribution";
import type { AppData, Trip } from "./types";

let seq = 0;
function makeTrip(partial: Partial<Trip>): Trip {
  return {
    id: `t${++seq}`,
    driver_id: "d1",
    helper_ids: [],
    vehicle_id: "v1",
    transportify_id: `TR-${seq}`,
    customer_phone: "09170000000",
    pickup_address: "A",
    dropoff_address: "B",
    images: [],
    gross: 5000,
    expense_items: [],
    total_expense: 0,
    profit: 5000,
    driver_commission: 0,
    helper_commission: 0,
    helper_split: "equal",
    helper_split_custom: {},
    date_time: "2026-08-20T08:00:00Z",
    status: "completed",
    created_by: "u1",
    created_at: "2026-08-20T08:00:00Z",
    updated_at: "2026-08-20T08:00:00Z",
    ...partial,
  };
}

function makeData(trips: Trip[]): AppData {
  return {
    users: [],
    employees: [],
    vehicles: [],
    trips,
    commissionRules: [],
    payrollLedger: [],
    customers: [],
    vehicleTypes: [],
    company: { name: "t", address: "a", phone: "p", email: "e" },
  };
}

describe("distributeFuel", () => {
  it("distributes fuel proportionally by KM across the same vehicle's trips", () => {
    const tripA = makeTrip({
      id: "A",
      km_traveled: 100,
      expense_items: [{ id: "fuel-1", category: "Fuel", amount: 3000 }],
      total_expense: 3000,
      profit: 2000,
    });
    const tripB = makeTrip({
      id: "B",
      km_traveled: 200,
      date_time: "2026-08-21T08:00:00Z",
      expense_items: [{ id: "toll-1", category: "Toll", amount: 100 }],
      total_expense: 100,
      profit: 4900,
    });
    const tripC = makeTrip({ id: "C", vehicle_id: "v2", km_traveled: 500 });

    const result = distributeFuel("fuel-1", "A", makeData([tripA, tripB, tripC]));

    expect(result).not.toBeNull();
    const a = result!.find((t) => t.id === "A")!;
    const b = result!.find((t) => t.id === "B")!;
    expect(result!.some((t) => t.id === "C")).toBe(false); // other vehicle untouched

    // A: 100/300 of 3000 = 1000; original fuel item replaced by distributed share
    expect(a.expense_items).toHaveLength(1);
    expect(a.expense_items[0].id).toBe("dist-fuel-fuel-1-A");
    expect(a.expense_items[0].amount).toBe(1000);
    expect(a.total_expense).toBe(1000);
    expect(a.profit).toBe(4000);

    // B: 200/300 of 3000 = 2000, on top of its existing toll
    expect(b.expense_items).toHaveLength(2);
    expect(b.expense_items.find((e) => e.id === "dist-fuel-fuel-1-B")?.amount).toBe(2000);
    expect(b.total_expense).toBe(2100);
    expect(b.profit).toBe(2900);
  });

  it("excludes cancelled trips from distribution", () => {
    const tripA = makeTrip({
      id: "A",
      km_traveled: 100,
      expense_items: [{ id: "fuel-1", category: "Fuel", amount: 3000 }],
    });
    const tripD = makeTrip({
      id: "D",
      km_traveled: 300,
      status: "cancelled",
      date_time: "2026-08-21T08:00:00Z",
    });

    const result = distributeFuel("fuel-1", "A", makeData([tripA, tripD]));
    expect(result).not.toBeNull();
    expect(result!.some((t) => t.id === "D")).toBe(false);
    // A carries 100% of the fuel: totalKm = 100 (cancelled trip's 300km excluded)
    expect(result!.find((t) => t.id === "A")!.expense_items[0].amount).toBe(3000);
  });

  it("excludes trips outside the ±3 day window", () => {
    const tripA = makeTrip({
      id: "A",
      km_traveled: 100,
      expense_items: [{ id: "fuel-1", category: "Fuel", amount: 3000 }],
    });
    const tripE = makeTrip({
      id: "E",
      km_traveled: 400,
      date_time: "2026-09-01T08:00:00Z", // 12 days later
    });

    const result = distributeFuel("fuel-1", "A", makeData([tripA, tripE]));
    expect(result).not.toBeNull();
    expect(result!.some((t) => t.id === "E")).toBe(false);
    expect(result!.find((t) => t.id === "A")!.expense_items[0].amount).toBe(3000);
  });

  it("returns null when no trips have KM data", () => {
    const tripA = makeTrip({
      id: "A",
      expense_items: [{ id: "fuel-1", category: "Fuel", amount: 3000 }],
    });
    expect(distributeFuel("fuel-1", "A", makeData([tripA]))).toBeNull();
  });

  it("returns null when the fuel item is missing, non-fuel, or zero", () => {
    const tripA = makeTrip({ id: "A", km_traveled: 100 });
    expect(distributeFuel("nope", "A", makeData([tripA]))).toBeNull();

    const tollTrip = makeTrip({
      id: "A2",
      km_traveled: 100,
      expense_items: [{ id: "toll-9", category: "Toll", amount: 500 }],
    });
    expect(distributeFuel("toll-9", "A2", makeData([tollTrip]))).toBeNull();
  });

  it("replaces previously distributed fuel instead of double-counting", () => {
    const tripA = makeTrip({
      id: "A",
      km_traveled: 100,
      expense_items: [{ id: "fuel-1", category: "Fuel", amount: 3000 }],
    });
    const tripB = makeTrip({
      id: "B",
      km_traveled: 100,
      date_time: "2026-08-21T08:00:00Z",
      expense_items: [
        { id: "dist-fuel-fuel-1-B", category: "Fuel", amount: 500 }, // stale share from an earlier run
      ],
      total_expense: 500,
      profit: 4500,
    });

    const result = distributeFuel("fuel-1", "A", makeData([tripA, tripB]));
    expect(result).not.toBeNull();
    const b = result!.find((t) => t.id === "B")!;
    // old 500 share removed, fresh 1500 share added exactly once
    const fuelItems = b.expense_items.filter((e) => e.id.startsWith("dist-fuel-"));
    expect(fuelItems).toHaveLength(1);
    expect(fuelItems[0].amount).toBe(1500);
    expect(b.total_expense).toBe(1500);
  });
});
