import type { AppData, ExpenseItem, Trip } from "./types";

/**
 * Distribute a fuel expense fairly across trips sharing the same vehicle.
 *
 * When fuel is purchased on one trip but consumed across multiple trips,
 * this distributes the cost proportionally by each trip's KM traveled.
 *
 * Example:
 *   Trip A: 100km, Trip B: 200km, Fuel: ₱3,000
 *   Trip A gets ₱1,000, Trip B gets ₱2,000
 *
 * @param fuelExpenseId - The ID of the fuel expense item to distribute
 * @param sourceTripId - The trip where the fuel was recorded
 * @param data - Current app data
 * @param dayRange - How many days before/after the source trip to include (default 3)
 * @returns Updated trips with redistributed fuel expenses, or null if conditions aren't met
 */
export function distributeFuel(
  fuelExpenseId: string,
  sourceTripId: string,
  data: AppData,
  dayRange = 3
): Trip[] | null {
  const sourceTrip = data.trips.find((t) => t.id === sourceTripId);
  if (!sourceTrip) return null;

  // Find the fuel expense item
  const fuelItem = sourceTrip.expense_items.find((e) => e.id === fuelExpenseId);
  if (!fuelItem || fuelItem.category !== "Fuel" || fuelItem.amount <= 0) return null;

  const totalFuel = fuelItem.amount;
  const vehicleId = sourceTrip.vehicle_id;
  const sourceDate = new Date(sourceTrip.date_time).getTime();
  const rangeMs = dayRange * 86400000;

  // Find all completed/non-cancelled trips by the same vehicle within the date range
  const candidateTrips = data.trips.filter((t) => {
    if (t.id === sourceTripId) return false; // exclude source (it gets its share too)
    if (t.vehicle_id !== vehicleId) return false;
    if (t.status === "cancelled") return false;
    const tDate = new Date(t.date_time).getTime();
    if (Math.abs(tDate - sourceDate) > rangeMs) return false;
    return true;
  });

  // All trips that will share the fuel cost (source + candidates)
  const allTrips = [sourceTrip, ...candidateTrips];

  // Calculate total KM across all trips
  const totalKm = allTrips.reduce((sum, t) => sum + (t.km_traveled ?? 0), 0);
  if (totalKm <= 0) return null; // Can't distribute without KM data

  // Remove the fuel expense from the source trip
  const updatedTrips: Trip[] = [];

  for (const trip of allTrips) {
    const km = trip.km_traveled ?? 0;
    const share = (km / totalKm) * totalFuel;

    // Round to nearest centavo
    const roundedShare = Math.round(share * 100) / 100;

    let newExpenses: ExpenseItem[];

    if (trip.id === sourceTripId) {
      // Remove the original fuel item from source
      newExpenses = trip.expense_items.filter((e) => e.id !== fuelExpenseId);
    } else {
      // Remove any previously distributed fuel from candidate trips
      // to prevent double-counting on re-distribution.
      newExpenses = trip.expense_items.filter((e) => !e.id.startsWith("dist-fuel-"));
    }

    // Add the distributed fuel expense (only if share > 0)
    if (roundedShare > 0) {
      newExpenses.push({
        id: `dist-fuel-${fuelExpenseId}-${trip.id}`,
        category: "Fuel",
        amount: roundedShare,
        note: `Distributed from ${sourceTrip.transportify_id} (${km}km / ${totalKm}km)`,
      });
    }

    const totalExpense = newExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const profit = trip.gross - totalExpense;

    updatedTrips.push({
      ...trip,
      expense_items: newExpenses,
      total_expense: totalExpense,
      profit: profit,
    });
  }

  return updatedTrips;
}

/**
 * Get a summary of all un-distributed fuel expenses on trips that have KM data.
 * Useful for showing which fuel costs can be distributed.
 */
export function getDistributableFuelItems(data: AppData) {
  const items: Array<{
    tripId: string;
    tripLabel: string;
    expenseId: string;
    amount: number;
    vehicleId: string;
    km: number;
    candidateCount: number;
  }> = [];

  for (const trip of data.trips) {
    if (trip.status === "cancelled") continue;
    const fuelItems = trip.expense_items.filter(
      (e) => e.category === "Fuel" && e.amount > 0 && !e.id.startsWith("dist-fuel-")
    );
    if (fuelItems.length === 0) continue;

    // Count candidates (other trips same vehicle, same date range, with KM)
    const sourceDate = new Date(trip.date_time).getTime();
    const rangeMs = 3 * 86400000;
    const candidates = data.trips.filter(
      (t) =>
        t.id !== trip.id &&
        t.vehicle_id === trip.vehicle_id &&
        t.status !== "cancelled" &&
        Math.abs(new Date(t.date_time).getTime() - sourceDate) <= rangeMs &&
        (t.km_traveled ?? 0) > 0
    );

    for (const fuel of fuelItems) {
      items.push({
        tripId: trip.id,
        tripLabel: trip.transportify_id,
        expenseId: fuel.id,
        amount: fuel.amount,
        vehicleId: trip.vehicle_id,
        km: trip.km_traveled ?? 0,
        candidateCount: candidates.length,
      });
    }
  }

  return items;
}