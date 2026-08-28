import { describe, it, expect } from "vitest";
import { computeCommission } from "./commission";
import type { AppData } from "./types";

function makeData(): AppData {
  return {
    users: [],
    employees: [],
    vehicles: [],
    trips: [],
    commissionRules: [
      {
        id: "rule-driver",
        role: "driver",
        basis: "profit",
        default_percentage: 25,
        vehicle_type_overrides: {},
        employee_overrides: {},
        min_guaranteed_pay: 0,
        split_mode: "equal",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "rule-helper",
        role: "helper",
        basis: "profit",
        default_percentage: 20,
        two_helper_percentage: 24,
        vehicle_type_overrides: {},
        employee_overrides: {},
        min_guaranteed_pay: 0,
        split_mode: "equal",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    payrollLedger: [],
    customers: [],
    vehicleTypes: [],
    company: { name: "t", address: "a", phone: "p", email: "e" },
  };
}

describe("computeCommission", () => {
  it("computes driver commission on profit basis (gross - expenses)", () => {
    const result = computeCommission(
      {
        role: "driver",
        employeeIds: ["d1"],
        vehicleType: "L300",
        gross: 1000,
        expenseItems: [{ id: "e1", category: "Fuel", amount: 200 }],
      },
      makeData()
    );
    // profit = 1000 - 200 = 800; 25% = 200
    expect(result.total).toBe(200);
    expect(result.basisAmount).toBe(800);
    expect(result.perEmployee["d1"]).toBe(200);
  });

  it("returns zero for cancelled trips", () => {
    const result = computeCommission(
      {
        role: "driver",
        employeeIds: ["d1"],
        vehicleType: "L300",
        gross: 1000,
        expenseItems: [],
        status: "cancelled",
      },
      makeData()
    );
    expect(result.total).toBe(0);
    expect(result.perEmployee).toEqual({});
  });

  it("uses two_helper_percentage when 2+ helpers share a trip", () => {
    const result = computeCommission(
      {
        role: "helper",
        employeeIds: ["h1", "h2"],
        vehicleType: "L300",
        gross: 1000,
        expenseItems: [{ id: "e1", category: "Toll", amount: 200 }],
      },
      makeData()
    );
    // profit 800; 24% (two-helper rate, not 20%) = 192; equal split = 96 each
    expect(result.total).toBe(192);
    expect(result.perEmployee["h1"]).toBe(96);
    expect(result.perEmployee["h2"]).toBe(96);
  });

  it("respects gross basis when the rule says so", () => {
    const data = makeData();
    data.commissionRules[0].basis = "gross";
    const result = computeCommission(
      {
        role: "driver",
        employeeIds: ["d1"],
        vehicleType: "L300",
        gross: 1000,
        expenseItems: [{ id: "e1", category: "Fuel", amount: 800 }],
      },
      data
    );
    // gross basis ignores expenses: 25% of 1000 = 250
    expect(result.basis).toBe("gross");
    expect(result.total).toBe(250);
  });

  it("prefers vehicle_type_overrides over the default percentage", () => {
    const data = makeData();
    data.commissionRules[0].vehicle_type_overrides = { "10-Wheeler Wingvan": 22 };
    const result = computeCommission(
      {
        role: "driver",
        employeeIds: ["d1"],
        vehicleType: "10-Wheeler Wingvan",
        gross: 1000,
        expenseItems: [],
      },
      data
    );
    // 22% of 1000 = 220
    expect(result.total).toBe(220);
  });

  it("prefers employee_overrides over vehicle overrides", () => {
    const data = makeData();
    data.commissionRules[0].vehicle_type_overrides = { "10-Wheeler Wingvan": 22 };
    data.commissionRules[0].employee_overrides = { "d1": 30 };
    const result = computeCommission(
      {
        role: "driver",
        employeeIds: ["d1"],
        vehicleType: "10-Wheeler Wingvan",
        gross: 1000,
        expenseItems: [],
      },
      data
    );
    // employee override 30% of 1000 = 300
    expect(result.total).toBe(300);
  });

  it("applies min_guaranteed_pay as a floor", () => {
    const data = makeData();
    data.commissionRules[0].min_guaranteed_pay = 100;
    const result = computeCommission(
      {
        role: "driver",
        employeeIds: ["d1"],
        vehicleType: "L300",
        gross: 500,
        expenseItems: [{ id: "e1", category: "Fuel", amount: 200 }],
      },
      data
    );
    // raw = 25% of 300 = 75 < 100 → floored to 100
    expect(result.total).toBe(100);
  });

  it("splits custom helper splits proportionally to declared weights", () => {
    const result = computeCommission(
      {
        role: "helper",
        employeeIds: ["h1", "h2"],
        vehicleType: "L300",
        gross: 1000,
        expenseItems: [],
        split: "custom",
        splitCustom: { h1: 3, h2: 1 },
      },
      makeData()
    );
    // 24% of 1000 = 240 → h1 180, h2 60
    expect(result.perEmployee["h1"]).toBe(180);
    expect(result.perEmployee["h2"]).toBe(60);
  });

  it("rounds equal splits to centavos", () => {
    const result = computeCommission(
      {
        role: "driver",
        employeeIds: ["d1", "d2", "d3"],
        vehicleType: "L300",
        gross: 1000,
        expenseItems: [],
      },
      makeData()
    );
    // 25% of 1000 = 250; 250 / 3 = 83.333… → 83.33 per driver (centavo rounding)
    expect(result.perEmployee["d1"]).toBe(83.33);
    expect(result.perEmployee["d3"]).toBe(83.33);
  });
});
