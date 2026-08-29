import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BarChart3, LogIn, UserPlus, MoveRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, isConfigured } from "../lib/supabase";
import { cx } from "../components/ui";

const loginInputCls =
  "w-full rounded-xl border border-[#dce4f2] bg-white px-4 py-3.5 text-sm text-[#121c2c] placeholder:text-[#7b8492] shadow-sm transition-all focus:border-[#1a58b7] focus:outline-none focus:ring-4 focus:ring-[#1a58b7]/15";

const demos = [
  { label: "Owner", email: "owner@trucking.ph", password: "demo1234" },
  { label: "Office Staff", email: "grace@trucking.ph", password: "demo1234" },
  { label: "Accountant", email: "carlo@trucking.ph", password: "demo1234" },
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
  const [showPassword, setShowPassword] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      // Hero image settles; the card starts visible and only drifts a few
      // pixels so the sign-in CTA is never hidden behind an animation timer.
      tl.fromTo(
        ".login-hero-img",
        { scale: 1.06, opacity: 0.55 },
        { scale: 1, opacity: 1, duration: 1.2, ease: "power2.out" }
      ).fromTo(
        "[data-login-card]",
        { y: 12 },
        { y: 0, duration: 0.5, stagger: 0.08 },
        "-=0.9"
      );
    },
    { scope: rootRef }
  );

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

        // Create the matching profiles row. Migration 011's auth trigger
        // normally creates it at signup; upsert-with-ignore keeps this
        // duplicate-safe when it already exists. If Supabase email
        // confirmation is enabled there is no session yet and RLS denies the
        // write — in that case the auth trigger has already handled it, and
        // we fall back to the "confirm your email" message.
        const { error: profileError } = await supabase!.from("profiles").upsert(
          { id: authData.user.id, name, role: "owner", status: "active" },
          { onConflict: "id", ignoreDuplicates: true }
        );
        if (profileError) {
          if (authData.session) {
            throw new Error(
              `Account created but profile setup failed: ${profileError.message}`
            );
          }
          setSuccess(
            "Account created! Check your email to confirm, then sign in."
          );
          setMode("signin");
          setName("");
          return;
        }

        // Try to sign the new owner in immediately. If email confirmation is
        // required, this returns an error and we drop to the sign-in screen.
        const res = await login(email, password);
        if (!res.ok) {
          setSuccess(
            "Account created! Check your email to confirm, then sign in."
          );
          setMode("signin");
          setName("");
        }
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

  const switchTo = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError("");
    setSuccess("");
  };

  return (
    <main ref={rootRef} className="relative min-h-full w-full max-w-full overflow-x-hidden bg-[#0F1826] text-white">
      <img
        src="https://images.unsplash.com/photo-1670509295484-df0c2512fec4?q=80&w=1600&auto=format&fit=crop"
        alt=""
        aria-hidden="true"
        className="login-hero-img absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen"
      />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(11,20,36,0.95)_8%,rgba(11,20,36,0.62)_56%,rgba(26,88,183,0.72))]" />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1180px] items-stretch justify-center px-4 py-6 sm:px-6 lg:items-center lg:px-8 lg:py-10">
        <div className="w-full max-w-[500px] overflow-hidden rounded-[28px] bg-[#f9f9ff] shadow-[0_24px_80px_rgba(4,13,30,0.28)]">
          <section className="flex items-center justify-center bg-[#f9f9ff] px-5 py-8 text-[#121c2c] sm:px-10 lg:px-14 xl:px-20">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a58b7] text-white shadow-sm"><BarChart3 className="h-5 w-5" /></div>
                <div className="leading-tight"><p className="text-lg font-bold tracking-tight text-[#121c2c]">FastHaul</p><p className="text-[11px] font-medium text-[#5b6472]">Fleet Operations</p></div>
              </div>
              <div data-login-card>
                <div className="mb-8">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a58b7]">Operations portal</p>
                  <h1 className="mb-2 text-3xl font-bold tracking-[-0.03em] text-[#121c2c]">
                    {mode === "signin" ? "Welcome back" : "Create account"}
                  </h1>
                  <p className="text-sm leading-relaxed text-[#5b6472]">
                    {mode === "signin" ? "Sign in to manage your fleet operations." : "Register a new owner account."}
                  </p>
                </div>

                {/* Segmented toggle */}
                <div className="mb-8 flex rounded-xl bg-[#eaf0fb] p-1" role="tablist" aria-label="Authentication mode">
                {(
                  [
                    { key: "signin" as Mode, label: "Sign in", icon: <LogIn className="h-4 w-4" /> },
                    { key: "register" as Mode, label: "Register", icon: <UserPlus className="h-4 w-4" /> },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab.key}
                    onClick={() => switchTo(tab.key)}
                    className={cx(
                      "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a58b7]",
                      mode === tab.key
                        ? "bg-white text-[#1a58b7] shadow-sm"
                        : "text-[#5b6472] hover:text-[#121c2c]"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="mb-4 rounded-xl bg-[#fff0f0] px-3 py-3 text-sm leading-relaxed text-[#a7191e]"
                >
                  {error}
                </div>
              )}

              {success && (
                <div role="status" className="mb-4 rounded-xl bg-[#e7f6ee] px-3 py-3 text-sm leading-relaxed text-[#14704a]">
                  {success}
                </div>
              )}

              <form onSubmit={submit} className="space-y-6">
                {mode === "register" && (
                  <div className="space-y-2">
                    <label htmlFor="login-name" className="block text-xs font-semibold text-[#424752]">Full Name</label>
                    <input
                      id="login-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={loginInputCls}
                      required
                      placeholder="Your name"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="login-email" className="block text-xs font-semibold text-[#424752]">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={loginInputCls}
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    placeholder="you@trucking.ph"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-[#424752]">Password</label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cx(loginInputCls, "pr-12")}
                      required
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      minLength={6}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "login-error password-help" : "password-help"}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#6b7280] transition-colors hover:bg-[#eaf0fb] hover:text-[#1a58b7] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1a58b7]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p id="password-help" className="text-[11px] leading-relaxed text-[#6b7280]">Use at least 6 characters.</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  aria-describedby={error ? "login-error" : undefined}
                  className="group mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1a58b7] py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(26,88,183,0.22)] transition-all duration-200 hover:bg-[#154a9c] hover:shadow-[0_10px_24px_rgba(26,88,183,0.28)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a58b7] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? mode === "signin" ? "Signing in…" : "Creating account…"
                    : mode === "signin" ? "Sign in" : "Create account"}
                  {!loading && <MoveRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />}
                </button>
              </form>
              <div className="mt-5 flex items-start gap-2 border-t border-[#dce4f2] pt-4 text-[11px] leading-relaxed text-[#6b7280]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1a58b7]" />
                <span>Your session is protected by your organization’s authentication provider.</span>
              </div>

              {/* Demo accounts */}
              {!isConfigured && mode === "signin" && (
                <div data-login-card className="mt-5 rounded-2xl border border-[#dce4f2] bg-white/80 p-4 shadow-[0_12px_32px_rgba(18,28,44,0.08)]">
                  <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
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
                          "group flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#dce4f2] bg-[#f9f9ff] px-3 py-2.5 text-left text-xs transition-all duration-200",
                          "hover:border-[#1a58b7]/40 hover:bg-[#eaf0fb]"
                        )}
                      >
                        <span className="font-semibold text-[#121c2c]">{d.label}</span>
                        <span className="tnum text-[#6b7280] transition-colors group-hover:text-[#1a58b7]">
                          {d.email} / {d.password}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
