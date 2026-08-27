export type Role = "owner" | "staff" | "accountant";

export type EmployeeRole = "driver" | "helper" | "staff";

export type TripStatus = "scheduled" | "ongoing" | "completed" | "cancelled";

export type CommissionBasis = "gross" | "profit";

export type SplitMode = "equal" | "custom";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  created_at: string;
}

export interface Employee {
  id: string;
  user_id: string | null;
  name: string;
  role: EmployeeRole;
  contact: string;
  license_no?: string;
  hire_date: string;
  status: "active" | "inactive";
  commission_override?: number | null;
  base_salary: number;
  notes?: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  type: string;
  capacity_kg: number;
  status: "active" | "inactive";
  driver_id?: string;
  created_at: string;
}

export interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  note?: string;
}

export interface Trip {
  id: string;
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
  images: string[];
  gross: number;
  expense_items: ExpenseItem[];
  total_expense: number;
  profit: number;
  driver_commission: number;
  helper_commission: number;
  helper_split: SplitMode;
  helper_split_custom: Record<string, number>;
  date_time: string;
  status: TripStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CommissionRule {
  id: string;
  role: "driver" | "helper";
  basis: CommissionBasis;
  default_percentage: number;
  two_helper_percentage?: number;
  vehicle_type_overrides: Record<string, number>;
  employee_overrides: Record<string, number>;
  min_guaranteed_pay: number;
  split_mode: SplitMode;
  updated_at: string;
}

export interface PayrollLedgerEntry {
  id: string;
  employee_id: string;
  trip_id: string;
  amount: number;
  basis_used: CommissionBasis;
  basis_amount: number;
  percentage: number;
  date: string;
}

export interface Customer {
  id: string;
  phone_number: string;
  name?: string;
  address?: string;
  created_at: string;
}

export interface CompanyProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface AppData {
  users: User[];
  employees: Employee[];
  vehicles: Vehicle[];
  trips: Trip[];
  commissionRules: CommissionRule[];
  payrollLedger: PayrollLedgerEntry[];
  customers: Customer[];
  vehicleTypes: string[];
  company: CompanyProfile;
}
