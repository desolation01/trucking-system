import { forwardRef, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "../lib/utils";

export { cx };

export const caps = "text-[11px] font-semibold uppercase tracking-[0.08em]";

export const IconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(function IconButton(
  { label, className, children, ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      aria-label={label}
      title={props.title ?? label}
      className={cx(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-card-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
});

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

const btnStyles: Record<BtnVariant, string> = {
  primary: "bg-brand text-on-brand shadow-sm hover:bg-brand-strong active:scale-[0.98]",
  secondary: "border border-edge bg-card text-ink shadow-sm hover:bg-card-soft active:scale-[0.98]",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.98]",
  ghost: "text-ink-soft hover:bg-card-soft hover:text-ink active:scale-[0.98]",
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
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        size === "sm" ? "min-h-11 px-3 text-xs" : "min-h-11 px-4 text-sm",
        btnStyles[variant],
        className
      )}
      {...props}
    />
  );
}

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
    <div className={cx("rounded-[20px] bg-card shadow-card transition-shadow duration-300", hover && "hover:shadow-card-hover", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs font-medium text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx(padding ? "p-5" : "", title && padding ? "pt-4" : "")}>{children}</div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  id,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId.replace(/:/g, "")}`;
  const descriptionId = `${fieldId}-description`;
  return (
    <label className={cx("block", className)} htmlFor={fieldId}>
      <span className={cx(caps, "mb-1.5 flex items-baseline gap-1 text-muted")}>
        {label}
        {required && <span aria-hidden="true" className="text-red-500">*</span>}
      </span>
      <span
        data-field-id={fieldId}
        data-description-id={descriptionId}
        className="contents"
      >
        {children}
      </span>
      {(hint || error) && (
        <span id={descriptionId} className={cx("mt-1 block text-xs font-medium leading-relaxed", error ? "text-red-600" : "text-muted")}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-muted/70 transition-all duration-200 focus:border-brand focus:ring-4 focus:ring-brand-ring focus:outline-none disabled:bg-card-soft disabled:text-muted";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

const selectBase = inputCls.replace("w-full", "").trim();

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const hasWidthClass = /w-(?!full)w+/.test(props.className ?? "");
  return (
    <select
      {...props}
      className={cx(
        selectBase,
        hasWidthClass ? "" : "w-full",
        "cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%23424752%22%20stroke-width=%222.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[right_0.75rem_center] bg-no-repeat pr-10",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "min-h-[80px] resize-y", props.className)} />;
}

export type BadgeTone = "slate" | "blue" | "green" | "amber" | "red" | "violet";

const badgeTones: Record<BadgeTone, string> = {
  slate: "bg-card-soft text-ink-soft",
  blue: "bg-sky-50 text-sky-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
};

const badgeDots: Record<BadgeTone, string> = {
  slate: "bg-muted",
  blue: "bg-brand",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
};

export function Badge({ tone = "slate", dot, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", badgeTones[tone])}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", badgeDots[tone])} />}
      {children}
    </span>
  );
}

export const statusTone = (status: string): BadgeTone =>
  status === "completed" ? "green" : status === "scheduled" ? "blue" : status === "ongoing" ? "amber" : "red";

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
  const titleId = useId().replace(/:/g, "");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const dialog = document.getElementById(`dialog-${titleId}`);
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])");
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open, onClose, titleId]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div id={`dialog-${titleId}`} role="dialog" aria-modal="true" aria-labelledby={`dialog-title-${titleId}`} className={cx("my-8 w-full rounded-[20px] bg-card shadow-dropdown", wide ? "max-w-4xl" : "max-w-2xl")}>
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          <h3 id={`dialog-title-${titleId}`} className="text-base font-semibold text-ink">{title}</h3>
          <IconButton ref={closeRef} label="Close dialog" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </div>
        <div className="max-h-[min(65vh,36rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-edge px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-card-soft text-muted">{icon}</div>}
      <p className="text-sm font-semibold text-ink-soft">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-xs font-medium leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("whitespace-nowrap px-3 py-3.5 text-sm font-medium text-ink-soft", className)}>{children}</td>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-medium text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Sparkline({ data, stroke = "var(--chart-blue)", height = 36, className }: { data: number[]; stroke?: string; height?: number; className?: string }) {
  const w = 100;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(data.length > 1 ? (i / (data.length - 1)) * w : w / 2).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`);
  if (pts.length === 0) return <div className={cx("w-full", className)} style={{ height }} />;
  return <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cx("w-full", className)} style={{ height }} aria-hidden="true"><polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

export function Delta({ value }: { value: number | null }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return <span className={cx("tnum inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>{up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%</span>;
}

export function Skeleton({ className }: { className?: string }) { return <div className={cx("animate-pulse rounded-xl bg-card-soft", className)} />; }

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cx("rounded-[20px] bg-card p-5 shadow-card", className)}><Skeleton className="mb-3 h-4 w-24" /><Skeleton className="h-8 w-32" /><div className="mt-3 flex gap-2"><Skeleton className="h-3 flex-1" /><Skeleton className="h-3 w-16" /></div></div>;
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return <tr className="border-b border-edge last:border-b-0">{Array.from({ length: cols }).map((_, i) => <td key={i} className="px-3 py-3"><Skeleton className={i === 0 ? "h-4 w-32" : i === cols - 1 ? "h-4 w-20" : "h-4 w-full"} /></td>)}</tr>;
}
