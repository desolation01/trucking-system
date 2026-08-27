import type { AppData, CommissionRule, Employee, Trip, Vehicle } from "./types";

const now = Date.now();
const DAY = 86400000;

const daysAgo = (n: number, hour = 9, minute = 0): string => {
  const d = new Date(now - n * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const isoDate = (n: number): string => {
  const d = new Date(now - n * DAY);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export const seedEmployees: Employee[] = [
  {
    id: "emp-driver-1",
    user_id: null,
    name: "Ramon Bautista",
    role: "driver",
    contact: "0917 555 0101",
    license_no: "D01-2345-67890",
    hire_date: isoDate(400),
    status: "active",
    commission_override: 14,
    base_salary: 15000,
    created_at: isoDate(400),
  },
  {
    id: "emp-driver-2",
    user_id: null,
    name: "Josef Mercado",
    role: "driver",
    contact: "0918 555 0102",
    license_no: "D01-2345-67891",
    hire_date: isoDate(360),
    status: "active",
    base_salary: 12000,
    created_at: isoDate(360),
  },
  {
    id: "emp-driver-3",
    user_id: null,
    name: "Arnel Santos",
    role: "driver",
    contact: "0919 555 0103",
    license_no: "D01-2345-67892",
    hire_date: isoDate(300),
    status: "active",
    base_salary: 12000,
    created_at: isoDate(300),
  },
  {
    id: "emp-driver-4",
    user_id: null,
    name: "Edwin Cruz",
    role: "driver",
    contact: "0920 555 0104",
    license_no: "D01-2345-67893",
    hire_date: isoDate(250),
    status: "inactive",
    base_salary: 10000,
    created_at: isoDate(250),
  },
  {
    id: "emp-helper-1",
    user_id: null,
    name: "Mark Villanueva",
    role: "helper",
    contact: "0917 555 0201",
    hire_date: isoDate(300),
    status: "active",
    base_salary: 8000,
    created_at: isoDate(300),
  },
  {
    id: "emp-helper-2",
    user_id: null,
    name: "Paolo Dizon",
    role: "helper",
    contact: "0917 555 0202",
    hire_date: isoDate(280),
    status: "active",
    base_salary: 8000,
    created_at: isoDate(280),
  },
  {
    id: "emp-helper-3",
    user_id: null,
    name: "Jun Reyes",
    role: "helper",
    contact: "0917 555 0203",
    hire_date: isoDate(220),
    status: "active",
    base_salary: 8000,
    created_at: isoDate(220),
  },
  {
    id: "emp-staff-1",
    user_id: "user-staff-1",
    name: "Grace Lim",
    role: "staff",
    contact: "0917 555 0301",
    hire_date: isoDate(500),
    status: "active",
    base_salary: 18000,
    created_at: isoDate(500),
  },
  {
    id: "emp-staff-2",
    user_id: "user-acct-1",
    name: "Carlo Tan",
    role: "staff",
    contact: "0917 555 0302",
    hire_date: isoDate(200),
    status: "active",
    base_salary: 16000,
    created_at: isoDate(200),
  },
];

export const seedVehicles: Vehicle[] = [
  {
    id: "veh-1",
    plate_number: "NAJ 4821",
    type: "L300",
    capacity_kg: 1200,
    status: "active",
    driver_id: "emp-driver-1",
    created_at: isoDate(400),
  },
  {
    id: "veh-2",
    plate_number: "NBD 7330",
    type: "L300",
    capacity_kg: 1200,
    status: "active",
    driver_id: "emp-driver-2",
    created_at: isoDate(400),
  },
  {
    id: "veh-3",
    plate_number: "NCK 1045",
    type: "4-Wheeler",
    capacity_kg: 2500,
    status: "active",
    driver_id: "emp-driver-3",
    created_at: isoDate(380),
  },
  {
    id: "veh-4",
    plate_number: "NDL 8802",
    type: "6-Wheeler Fwd",
    capacity_kg: 6000,
    status: "active",
    created_at: isoDate(350),
  },
  {
    id: "veh-5",
    plate_number: "NEV 2210",
    type: "10-Wheeler Wingvan",
    capacity_kg: 16000,
    status: "active",
    created_at: isoDate(300),
  },
  {
    id: "veh-6",
    plate_number: "NFZ 5516",
    type: "10-Wheeler Wingvan",
    capacity_kg: 16000,
    status: "inactive",
    created_at: isoDate(260),
  },
];

export const seedVehicleTypes: string[] = [
  "L300",
  "4-Wheeler",
  "6-Wheeler Fwd",
  "10-Wheeler Wingvan",
];

export const seedCommissionRules: CommissionRule[] = [
  {
    id: "rule-driver",
    role: "driver",
    basis: "profit",
    default_percentage: 25,
    two_helper_percentage: 22,
    vehicle_type_overrides: {
      "10-Wheeler Wingvan": 22,
    },
    employee_overrides: {},
    min_guaranteed_pay: 0,
    split_mode: "equal",
    updated_at: isoDate(30),
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
    updated_at: isoDate(30),
  },
];

const pickups = [
  "Pasay City Warehouse, Macapagal Blvd",
  "Meycauayan, Bulacan Industrial Estate",
  "Biñan, Laguna Logistics Park",
  "Baclaran Transport Hub, Parañaque",
  "Cubao Container Yard, Quezon City",
  "Marikina Light Industry Park",
  "Calamba, Laguna",
  "San Fernando, Pampanga",
];

const dropoffs = [
  "SM Mall of Asia, Pasay",
  "Robinsons Place Manila",
  "Greenhills Shopping Center, San Juan",
  "Alabang Town Center, Muntinlupa",
  "Ayala Mall, Manila Bay",
  "CityMall, Tagaytay",
  "WalterMart, North EDSA",
  "Fisher Mall, Quezon City",
  "SM City, Batangas",
  "Terminal 3 Cargo, NAIA",
];

const itemsPool = [
  "Loose cargo - 20 pallets",
  "Building materials",
  "Household furniture",
  "Rice, 50kg sacks",
  "Cartons of electronics",
  "Frozen goods",
  "Construction steel",
  "Office equipment",
  "Fresh produce crates",
  "Machinery parts",
];

const customerPool: Record<string, string> = {
  "0917 888 2201": "Lopez Trading",
  "0917 888 2202": "Santos Distribution",
  "0918 888 2203": "MC Logistics",
  "0919 888 2204": "JR Enterprises",
  "0920 888 2205": "Natividad Retail",
  "0916 888 2206": "Victory Supply",
  "0915 888 2207": "Prime Movers Inc.",
  "0914 888 2208": "Katipunan Trading",
  "0913 888 2209": "Isla Foods",
  "0912 888 2210": "Metro Builders",
};

let tripSeq = 0;
let expenseSeq = 0;

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const vehiclesByType = (type: string) =>
  seedVehicles.filter((v) => v.type === type && v.status === "active");

function buildTrips(): Trip[] {
  const trips: Trip[] = [];

  for (let day = 2; day <= 120; day++) {
    const tripsPerDay = Math.random() < 0.15 ? 0 : rand(1, 3);
    for (let t = 0; t < tripsPerDay; t++) {
      const type = seedVehicleTypes[rand(0, seedVehicleTypes.length - 1)];
      const pool = vehiclesByType(type);
      if (pool.length === 0) continue;
      const vehicle = pool[rand(0, pool.length - 1)];

      const drivers = seedEmployees.filter(
        (e) => e.role === "driver" && e.status === "active"
      );
      const helpers = seedEmployees.filter(
        (e) => e.role === "helper" && e.status === "active"
      );
      const driver = drivers[rand(0, drivers.length - 1)];
      const helperIds = Math.random() < 0.25 ? [] : [helpers[rand(0, helpers.length - 1)].id];
      if (Math.random() < 0.1) helperIds.push(helpers[rand(0, helpers.length - 1)].id);

      const baseGrossByType: Record<string, number> = {
        L300: 3000,
        "4-Wheeler": 4500,
        "6-Wheeler Fwd": 7000,
        "10-Wheeler Wingvan": 12000,
      };
      const gross = baseGrossByType[type] + rand(-400, 800);
      const fuel = Math.round((gross * rand(18, 30)) / 100);
      const tolls = type === "L300" ? rand(0, 120) : rand(200, 600);
      const parking = Math.random() < 0.4 ? rand(30, 120) : 0;
      const misc = Math.random() < 0.3 ? rand(50, 200) : 0;
      const expenseItems = [
        { id: `exp-${expenseSeq++}`, category: "Fuel", amount: fuel },
        { id: `exp-${expenseSeq++}`, category: "Toll fees", amount: tolls },
      ];
      if (parking)
        expenseItems.push({ id: `exp-${expenseSeq++}`, category: "Parking", amount: parking });
      if (misc)
        expenseItems.push({
          id: `exp-${expenseSeq++}`,
          category: "Miscellaneous",
          amount: misc,
        });
      const totalExpense = expenseItems.reduce((s, e) => s + e.amount, 0);
      const profit = gross - totalExpense;

      const hour = rand(6, 20);
      const minute = Math.random() < 0.5 ? 0 : 30;

      const statusRoll = Math.random();
      const status =
        day <= 1
          ? "scheduled"
          : statusRoll < 0.82
            ? "completed"
            : statusRoll < 0.9
              ? "cancelled"
              : "completed";

      const phone = Object.keys(customerPool)[rand(0, Object.keys(customerPool).length - 1)];

      trips.push({
        id: `trip-${tripSeq++}`,
        driver_id: driver.id,
        helper_ids: helperIds,
        vehicle_id: vehicle.id,
        transportify_id: `TFP-${(4000 + tripSeq).toString()}`,
        cargo_weight: rand(200, 14000),
        cargo_dimensions: `${rand(1, 4)}x${rand(1, 4)}x${rand(1, 4)}m`,
        customer_phone: phone,
        customer_name: customerPool[phone],
        pickup_address: pickups[rand(0, pickups.length - 1)],
        dropoff_address: dropoffs[rand(0, dropoffs.length - 1)],
        items: itemsPool[rand(0, itemsPool.length - 1)],
        description: "",
        images: [],
        gross,
        expense_items: expenseItems,
        total_expense: totalExpense,
        profit,
        driver_commission: 0,
        helper_commission: 0,
        helper_split: "equal",
        helper_split_custom: {},
        date_time: daysAgo(day, hour, minute),
        status,
        created_by: "user-owner",
        created_at: daysAgo(day, hour, minute),
        updated_at: daysAgo(day, hour, minute),
      });
    }
  }
  return trips;
}

export const seedTrips: Trip[] = buildTrips();

export const seedData: AppData = {
  users: [
    {
      id: "user-owner",
      name: "Owner / Admin",
      email: "owner@trucking.ph",
      role: "owner",
      status: "active",
      created_at: isoDate(600),
    },
    {
      id: "user-staff-1",
      name: "Grace Lim",
      email: "grace@trucking.ph",
      role: "staff",
      status: "active",
      created_at: isoDate(500),
    },
    {
      id: "user-acct-1",
      name: "Carlo Tan",
      email: "carlo@trucking.ph",
      role: "accountant",
      status: "active",
      created_at: isoDate(200),
    },
  ],
  employees: seedEmployees,
  vehicles: seedVehicles,
  trips: seedTrips,
  commissionRules: seedCommissionRules,
  payrollLedger: [],
  customers: Object.entries(customerPool).map(([phone, name], i) => ({
    id: `cust-${i}`,
    phone_number: phone,
    name,
    created_at: isoDate(300),
  })),
  vehicleTypes: seedVehicleTypes,
  company: {
    name: "FastHaul Transport Services",
    address: "Unit 12, Marilao Industrial Park, Bulacan",
    phone: "(02) 8123 4567",
    email: "ops@fasthaul.ph",
  },
};
