import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Phone, Search } from "lucide-react";
import { useStore, useStoreLoading } from "../lib/store";
import { Badge, EmptyState, Modal, PageHeader, Td, Th, cx, Skeleton, SkeletonTableRow } from "../components/ui";
import { fmtDate, peso0 } from "../lib/format";
import type { Customer, Trip } from "../lib/types";

export function Customers() {
  const data = useStore();
  const loading = useStoreLoading();
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Customer | undefined>(undefined);

  const fuse = useMemo(
    () =>
      new Fuse(data.customers, {
        keys: ["phone_number", "name"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [data.customers]
  );

  const customers = useMemo(() => {
    const list = query.trim()
      ? fuse.search(query.trim()).map((r) => r.item)
      : [...data.customers];
    return list.sort((a, b) => {
      const tripsA = data.trips.filter((t) => t.customer_phone === a.phone_number).length;
      const tripsB = data.trips.filter((t) => t.customer_phone === b.phone_number).length;
      return tripsB - tripsA;
    });
  }, [fuse, query, data]);

  const tripsFor = (phone: string): Trip[] =>
    data.trips
      .filter((t) => t.customer_phone === phone)
      .sort((a, b) => b.date_time.localeCompare(a.date_time));

  const statsFor = (phone: string) => {
    const trips = tripsFor(phone);
    const gross = trips.reduce((s, t) => s + t.gross, 0);
    return { count: trips.length, gross, last: trips[0]?.date_time };
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-48 rounded-lg" /><Skeleton className="h-8 w-80 rounded-lg" /><div className="overflow-hidden rounded-xl border border-edge bg-card"><table className="w-full"><thead><tr>{Array.from({length:5}).map((_,i)=><th key={i} className="px-3 py-2.5"><Skeleton className="h-3 w-16" /></th>)}</tr></thead><tbody>{Array.from({length:5}).map((_,i)=><SkeletonTableRow key={i} cols={5} />)}</tbody></table></div></div>;

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Auto-tracked from trip phone numbers"
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by phone or name…"
          className="w-full rounded-lg border border-edge bg-card py-2.5 pl-10 pr-3 text-sm shadow-card placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring transition-all duration-150"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-edge bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-card-soft">
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th>Trips</Th>
                <Th>Total Gross</Th>
                <Th>Last Trip</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/70">
              {customers.map((c) => {
                const s = statsFor(c.phone_number);
                return (
                  <tr key={c.id} className="hover:bg-card-soft transition-colors duration-100">
                    <Td>
                      <button onClick={() => setViewing(c)} className="font-medium text-amber-500 dark:text-amber-400 hover:underline">
                        {c.name ?? "Unnamed customer"}
                      </button>
                    </Td>
                    <Td className="text-muted">{c.phone_number}</Td>
                    <Td><Badge tone="blue" dot>{s.count} trips</Badge></Td>
                    <Td className="tnum font-medium text-ink">{peso0(s.gross)}</Td>
                    <Td className="text-muted">{s.last ? fmtDate(s.last) : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && (
          <EmptyState icon={<Phone className="h-8 w-8" />} title="No customers found" subtitle="Customers are created automatically when you log a trip with a phone number." />
        )}
      </div>

      {viewing && (
        <Modal open onClose={() => setViewing(undefined)} title={viewing.name ?? viewing.phone_number} wide>
          <p className="mb-4 text-sm text-muted">{viewing.phone_number}</p>
          <h4 className="mb-2 text-sm font-semibold text-ink-soft">Trip History ({tripsFor(viewing.phone_number).length})</h4>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-card-soft">
                <tr>
                  <Th>Date</Th>
                  <Th>Transportify</Th>
                  <Th>Route</Th>
                  <Th>Gross</Th>
                  <Th>Profit</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/70">
                {tripsFor(viewing.phone_number).slice(0, 50).map((t) => (
                  <tr key={t.id}>
                    <Td className="text-ink-soft">{fmtDate(t.date_time)}</Td>
                    <Td className="text-amber-500 dark:text-amber-400">{t.transportify_id}</Td>
                    <Td className="max-w-[260px]">
                      <p className="truncate text-ink-soft">{t.pickup_address}</p>
                      <p className="truncate text-[11px] text-muted">→ {t.dropoff_address}</p>
                    </Td>
                    <Td className="tnum text-ink-soft">{peso0(t.gross)}</Td>
                    <Td className={cx("tnum font-medium", t.gross - t.total_expense >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                      {peso0(t.gross - t.total_expense)}
                    </Td>
                    <Td>
                      <Badge tone={t.status === "completed" ? "green" : t.status === "cancelled" ? "red" : t.status === "scheduled" ? "blue" : "amber"}>{t.status}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
