import { useState } from "react";
import { BarChart3, Truck, ShieldCheck, TrendingUp, Wallet, UserPlus, LogIn } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, isConfigured } from "../lib/supabase";
import { Button, cx } from "../components/ui";

const loginInputCls =
  "w-full rounded-md border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring";

const demos = [
  { label: "Owner", email: "owner@trucking.ph", password: "demo1234" },
  { label: "Office Staff", email: "grace@trucking.ph", password: "demo1234" },
  { label: "Accountant", email: "carlo@trucking.ph", password: "demo1234" },
];

const perks = [
  { icon: <TrendingUp className="h-4 w-4" />, title: "Live margin tracking", text: "Gross, expense and profit per trip, per driver." },
  { icon: <ShieldCheck className="h-4 w-4" />, title: "Dispatch-ready operations", text: "One workspace for trips, fleet, crew and payroll." },
  { icon: <Wallet className="h-4 w-4" />, title: "Commission automation", text: "Driver and helper earnings computed from rules." },
];

type Mode = "signin" | "register";

export function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "register") {
        if (!isConfigured) {
          setError("Registration requires a Supabase backend.");
          setLoading(false);
          return;
        }
        const { data: authData, error: authError } = await supabase!.auth.signUp({
          email,
          password,
          options: { data: { name, role: "owner" } },
        });
        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error("Registration failed.");

        // Insert owner profile
        await supabase!.from("profiles").insert({
          id: authData.user.id,
          name,
          role: "owner",
          status: "active",
        });

        setSuccess("Account created! You can now sign in.");
        setMode("signin");
        setName("");
      } else {
        const res = await login(email, password);
        if (!res.ok) {
          setError(res.error ?? "Login failed");
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    }
    setLoading(false);
  };

  const switchMode = () => {
    setMode((m) => (m === "signin" ? "register" : "signin"));
    setError("");
    setSuccess("");
  };

  return (
    <div className="flex min-h-full bg-surface">
      <div className="relative hidden flex-1 flex-col overflow-hidden bg-panel lg:flex">
        <div className="hazard absolute inset-x-0 top-0 h-1.5 opacity-80" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--panel-edge) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative z-10 flex w-full flex-1 flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-on-brand shadow-glow">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-bold tracking-tight text-panel-ink-strong">FastHaul Ops</p>
              <p className="text-[11px] font-medium uppercase tracking-widest text-panel-ink">Fleet · Dispatch · Payroll</p>
            </div>
          </div>

          <div>
            <h1 className="max-w-md font-display text-4xl font-bold leading-[1.1] tracking-tight text-panel-ink-strong">
              Run the fleet with <span className="text-amber-500 dark:text-amber-400">clarity</span>.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-panel-ink/80">
              Trips, vehicles, drivers, payroll and commissions in one calm, dispatch-grade workspace built for how trucking actually runs.
            </p>
            <div className="mt-8 space-y-3">
              {perks.map((p) => (
                <div key={p.title} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-panel-edge bg-panel-ink/5 text-amber-400">
                    {p.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-panel-ink-strong">{p.title}</p>
                    <p className="text-xs text-panel-ink">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-panel-ink">
            <Truck className="h-3.5 w-3.5" />
            <span>© 2026 FastHaul Ops · Built for the road</span>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-surface px-4 py-12 lg:max-w-xl">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-on-brand shadow-glow">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold tracking-tight text-ink">FastHaul Operations</h1>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Trucking Management</p>
            </div>
          </div>

          <div className="rounded-lg border border-edge bg-card p-6 shadow-card sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                  {mode === "signin" ? "Sign in" : "Create account"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {mode === "signin" ? "Owner & office staff access only." : "Register a new account."}
                </p>
              </div>
              <button
                type="button"
                onClick={switchMode}
                className="flex items-center gap-1.5 rounded-md border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                {mode === "signin" ? <UserPlus className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                {mode === "signin" ? "Register" : "Sign in"}
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "register" && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-soft">Full Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={loginInputCls}
                    required
                    placeholder="Your name"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-soft">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={loginInputCls}
                  required
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-soft">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={loginInputCls}
                  required
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  minLength={6}
                />
              </label>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? mode === "signin" ? "Signing in…" : "Creating account…"
                  : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </div>

          {mode === "signin" && (
            <div className="mt-6 rounded-lg border border-edge bg-card/60 p-4">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted">
                Demo accounts
              </p>
              <div className="grid gap-2">
                {demos.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(d.password);
                      setError("");
                    }}
                    className={cx(
                      "flex items-center justify-between gap-2 rounded-md border border-edge px-3 py-2.5 text-left text-xs transition-all",
                      "hover:border-brand hover:bg-brand-soft/50"
                    )}
                  >
                    <span className="font-medium text-ink">{d.label}</span>
                    <span className="tnum text-muted">{d.email} / {d.password}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}