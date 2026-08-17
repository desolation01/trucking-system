import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Login } from "./pages/Login";
import { Layout, type PageKey } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Trips } from "./pages/Trips";
import { CalendarPage } from "./pages/Calendar";
import { Employees } from "./pages/Employees";
import { Vehicles } from "./pages/Vehicles";
import { Customers } from "./pages/Customers";
import { Payroll } from "./pages/Payroll";
import { Settings } from "./pages/Settings";
import { DieselDistribution } from "./pages/DieselDistribution";

const validPages: PageKey[] = [
  "dashboard",
  "trips",
  "calendar",
  "employees",
  "vehicles",
  "customers",
  "diesel",
  "payroll",
  "settings",
];

function hashPage(): PageKey {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (validPages.includes(h as PageKey) ? h : "dashboard") as PageKey;
}

function Shell() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<PageKey>(hashPage);

  useEffect(() => {
    const onHash = () => setPage(hashPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (p: PageKey) => {
    window.location.hash = `/${p}`;
    setPage(p);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout page={page} onNavigate={navigate}>
      {page === "dashboard" && <Dashboard onNavigate={navigate} />}
      {page === "trips" && <Trips />}
      {page === "calendar" && <CalendarPage />}
      {page === "employees" && <Employees />}
      {page === "vehicles" && <Vehicles />}
      {page === "customers" && <Customers />}
            {page === "diesel" && <DieselDistribution />}
            {page === "payroll" && <Payroll />}
            {page === "settings" && <Settings />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
              <ErrorBoundary>
                <Shell />
              </ErrorBoundary>
            </ToastProvider>
    </AuthProvider>
  );
}