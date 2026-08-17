import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = `toast-${++toastId}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, dismiss }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ── Single toast item ─────────────────────────────────────────────────────

const variantConfig: Record<
  ToastVariant,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    textColor: string;
    barColor: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  success: {
    border: "border-emerald-500",
    bg: "bg-emerald-500/15",
    iconBg: "bg-emerald-500",
    iconColor: "text-white",
    textColor: "text-emerald-50",
    barColor: "bg-emerald-400",
    Icon: CheckCircle,
  },
  error: {
    border: "border-red-500",
    bg: "bg-red-500/15",
    iconBg: "bg-red-500",
    iconColor: "text-white",
    textColor: "text-red-50",
    barColor: "bg-red-400",
    Icon: XCircle,
  },
  info: {
    border: "border-blue-500",
    bg: "bg-blue-500/15",
    iconBg: "bg-blue-500",
    iconColor: "text-white",
    textColor: "text-blue-50",
    barColor: "bg-blue-400",
    Icon: AlertCircle,
  },
};

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const cfg = variantConfig[t.variant];
  const barRef = useRef<HTMLDivElement>(null);

  // Animate the progress bar from 100% → 0% over 3.5s
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.width = "100%";
    // Force reflow then start the animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "width 3.8s linear";
        el.style.width = "0%";
      });
    });
  }, []);

  return (
    <div
      className={cx(
        "pointer-events-auto relative flex items-start gap-3.5 overflow-hidden rounded-xl border-2 p-4 shadow-xl backdrop-blur-md",
        "min-w-[300px] max-w-[420px]",
        "animate-slide-up",
        cfg.border,
        cfg.bg
      )}
      role="alert"
    >
      {/* Progress bar at top */}
      <div
        ref={barRef}
        className={cx("absolute left-0 top-0 h-0.5 rounded-full", cfg.barColor)}
        style={{ width: "100%" }}
      />

      {/* Icon */}
      <div
        className={cx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm",
          cfg.iconBg
        )}
      >
        <cfg.Icon className={cx("h-4.5 w-4.5", cfg.iconColor)} />
      </div>

      {/* Message */}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={cx("text-sm font-semibold leading-snug", cfg.textColor)}>
          {t.variant === "success" ? "Success" : t.variant === "error" ? "Error" : "Notice"}
        </p>
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-white/70">
          {t.message}
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(t.id)}
        className="absolute right-2.5 top-2.5 rounded p-0.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/90"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// cx helper (same as ui.tsx, duplicated to avoid circular deps)
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}