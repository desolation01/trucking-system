import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ─────────────────────────────────────────────
   Button — responsive press feedback
   ───────────────────────────────────────────── */
type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

const btnStyles: Record<BtnVariant, string> = {
  primary:
    "bg-brand text-on-brand font-semibold shadow-glow hover:bg-brand-strong active:scale-[0.97] active:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all duration-150",
  secondary:
    "border border-edge bg-card text-ink-soft shadow-card hover:border-edge-strong hover:text-ink active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all duration-150",
  danger: "bg-red-600 text-white font-semibold hover:bg-red-700 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all duration-150",
  ghost: "text-ink-soft hover:bg-ink/5 hover:text-ink active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand transition-all duration-150",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        btnStyles[variant],
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────
   Card — bordered container with optional header
   ───────────────────────────────────────────── */
export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  hover,
  padding = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-edge bg-card shadow-card transition-all duration-200",
        hover && "hover:border-edge-strong hover:shadow-card-hover",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-edge/70 px-5 py-3.5">
          <div className="min-w-0">
            {title && <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padding ? "p-5" : ""}>{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Field — labeled form field
   ───────────────────────────────────────────── */
export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 flex items-baseline gap-1 text-xs font-medium text-ink-soft">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

/* ─────────────────────────────────────────────
   Input / Select / Textarea
   ───────────────────────────────────────────── */
export const inputCls =
  "w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted/60 transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring disabled:bg-card-soft disabled:text-muted";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

const selectBase = inputCls.replace("w-full", "").trim();

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const hasWidthClass = /w-(?!full)w+/.test(props.className ?? "");
  return (
    <select
      {...props}
      className={cx(
        selectBase,
        hasWidthClass ? "" : "w-full",
        "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%236b7280%22%20stroke-width=%222.5%22%3E%3Cpath%20d=%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[right_0.6rem_center] bg-no-repeat pr-8",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "min-h-[80px] resize-y", props.className)} />;
}

/* ─────────────────────────────────────────────
   Badge — status / label pill
   ───────────────────────────────────────────── */
export type BadgeTone = "slate" | "blue" | "green" | "amber" | "red" | "violet";

const badgeTones: Record<BadgeTone, string> = {
  slate: "bg-slate-400/10 text-slate-500 dark:text-slate-300",
  blue: "bg-sky-400/10 text-sky-600 dark:text-sky-300",
  green: "bg-emerald-400/10 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-400/10 text-amber-600 dark:text-amber-300",
  red: "bg-red-400/10 text-red-600 dark:text-red-300",
  violet: "bg-violet-400/10 text-violet-600 dark:text-violet-300",
};

const badgeDots: Record<BadgeTone, string> = {
  slate: "bg-slate-400",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
};

export function Badge({
  tone = "slate",
  dot,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        badgeTones[tone]
      )}
    >
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", badgeDots[tone])} />}
      {children}
    </span>
  );
}

export const statusTone = (status: string): BadgeTone =>
  status === "completed"
    ? "green"
    : status === "scheduled"
      ? "blue"
      : status === "ongoing"
        ? "amber"
        : "red";

/* ─────────────────────────────────────────────
   Modal — dialog overlay
   ───────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={cx(
          "my-8 w-full rounded-xl border border-edge bg-card shadow-dropdown",
          wide ? "max-w-4xl" : "max-w-2xl"
        )}
      >
        <div className="flex items-center justify-between border-b border-edge/70 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-edge/70 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   EmptyState — placeholder for empty lists
   ───────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ink/5 text-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Table helpers
   ───────────────────────────────────────────── */
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("whitespace-nowrap px-3 py-3 text-sm text-ink-soft", className)}>{children}</td>;
}

/* ─────────────────────────────────────────────
   PageHeader — page title + actions
   ───────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Sparkline — inline mini chart
   ───────────────────────────────────────────── */
export function Sparkline({
  data,
  stroke = "var(--brand)",
  height = 36,
  className,
}: {
  data: number[];
  stroke?: string;
  height?: number;
  className?: string;
}) {
  const w = 100;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : w / 2;
    const y = height - 3 - ((v - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  if (pts.length === 0) return <div className={cx("w-full", className)} style={{ height }} />;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={cx("w-full", className)}
      style={{ height }}
      aria-hidden="true"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Delta — percentage change indicator
   ───────────────────────────────────────────── */
export function Delta({ value }: { value: number | null }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span
      className={cx(
        "tnum inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold",
        up
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          : "bg-red-500/10 text-red-600 dark:text-red-300"
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/* ─────────────────────────────────────────────
   Skeleton — loading placeholder
   ───────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-md bg-ink/5 dark:bg-ink/10",
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cx("rounded-lg border border-edge bg-card p-4 shadow-card", className)}>
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-edge/70">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className={i === 0 ? "h-4 w-32" : i === cols - 1 ? "h-4 w-20" : "h-4 w-full"} />
        </td>
      ))}
    </tr>
  );
}
