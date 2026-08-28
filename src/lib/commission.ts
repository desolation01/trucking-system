import type {
  AppData,
  CommissionBasis,
  CommissionRule,
  ExpenseItem,
  SplitMode,
  Trip,
} from "./types";

export interface CommissionInput {
  role: "driver" | "helper";
  employeeIds: string[];
  vehicleType: string;
  gross: number;
  expenseItems: ExpenseItem[];
  status?: Trip["status"];
  split?: SplitMode;
  splitCustom?: Record<string, number>;
}

export interface CommissionResult {
  perEmployee: Record<string, number>;
  total: number;
  basisAmount: number;
  basis: CommissionBasis;
  percentage: number;
}

const sumExpenses = (items: ExpenseItem[]) =>
  items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

export function computeCommission(
  input: CommissionInput,
  data: AppData
): CommissionResult {
  const rule = data.commissionRules.find(
    (r: CommissionRule) => r.role === input.role
  );

  const noOne = input.employeeIds.length === 0;
  const cancelled = input.status === "cancelled";
  if (noOne || cancelled) {
    return {
      perEmployee: {},
      total: 0,
      basisAmount: 0,
      basis: "profit",
      percentage: 0,
    };
  }

  const gross = Number(input.gross) || 0;
  const expense = sumExpenses(input.expenseItems);
  const profit = gross - expense;
  const basis: CommissionBasis = rule?.basis ?? "profit";
  const basisAmount = basis === "profit" ? profit : gross;

  const percentage = effectivePercentage(rule, input.vehicleType, input.employeeIds[0]);

  // For helpers: use two_helper_percentage when 2+ helpers present
    let adjustedPercentage = percentage;
    if (input.role === "helper" && input.employeeIds.length >= 2 && rule?.two_helper_percentage != null) {
      adjustedPercentage = rule.two_helper_percentage;
    }

  const split = input.split ?? rule?.split_mode ?? "equal";
  const rawTotal = (basisAmount * adjustedPercentage) / 100;

  const capped =
    rule && rule.min_guaranteed_pay > 0 && rawTotal > 0
      ? Math.max(rawTotal, rule.min_guaranteed_pay)
      : rawTotal;

  let perEmployee: Record<string, number>;
  if (split === "custom") {
    perEmployee = distributeCustom(input.employeeIds, input.splitCustom ?? {}, capped);
  } else {
    const share = Math.round((capped / input.employeeIds.length) * 100) / 100;
    perEmployee = Object.fromEntries(input.employeeIds.map((id) => [id, share]));
  }

  const total = Object.values(perEmployee).reduce((s, v) => s + v, 0);

  return { perEmployee, total, basisAmount, basis, percentage: adjustedPercentage };
}

function effectivePercentage(
  rule: CommissionRule | undefined,
  vehicleType: string,
  employeeId: string
): number {
  if (!rule) return 0;
  const empOverride = rule.employee_overrides?.[employeeId];
  if (empOverride != null) return empOverride;
  const typeOverride = rule.vehicle_type_overrides?.[vehicleType];
  if (typeOverride != null) return typeOverride;
  return rule.default_percentage;
}

function distributeCustom(
  employeeIds: string[],
  custom: Record<string, number>,
  total: number
): Record<string, number> {
  const named = employeeIds.filter((id) => custom[id] != null);
  if (named.length === employeeIds.length && named.length > 0) {
    const sum = named.reduce((s, id) => s + (custom[id] || 0), 0);
    if (sum > 0) {
      return Object.fromEntries(
        named.map((id) => [
          id,
          Math.round(((custom[id] / sum) * total) * 100) / 100,
        ])
      );
    }
  }
  const share = Math.round((total / employeeIds.length) * 100) / 100;
  return Object.fromEntries(employeeIds.map((id) => [id, share]));
}
