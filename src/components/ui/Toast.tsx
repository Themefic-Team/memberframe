import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

export type ToastTone = "neutral" | "success" | "error";

export interface ToastRequest {
  message: string;
  tone?: ToastTone;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ActiveToast extends ToastRequest {
  id: number;
}

/** PRD section 7.5. Long enough to read a finished-action confirmation, no longer. */
const DISMISS_AFTER_MS = 5000;
const MAX_MESSAGE_LENGTH = 45;

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  neutral: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

const ToastContext = createContext<((toast: ToastRequest) => void) | null>(null);

/**
 * Toasts announce that an action finished. Persistent state belongs in a Banner
 * and a field validation error belongs inline under its field.
 */
export function useToast(): (toast: ToastRequest) => void {
  const showToast = useContext(ToastContext);

  if (!showToast) {
    throw new Error("useToast must be called inside a ToastProvider.");
  }

  return showToast;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (request: ToastRequest) => {
      if (import.meta.env.DEV && request.message.length > MAX_MESSAGE_LENGTH) {
        // Warn rather than truncate. Silently cutting copy hides the problem
        // until a creator sees half a sentence.
        console.warn(
          `[MemberFrame] Toast message is ${request.message.length} characters, over the ${MAX_MESSAGE_LENGTH} character limit: "${request.message}"`
        );
      }

      const id = nextId.current++;
      setToasts((current) => [...current, { ...request, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS)
      );
    },
    [dismiss]
  );

  // Clear pending timers if the panel unmounts mid-toast.
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
      timers.current.clear();
    },
    []
  );

  const value = useMemo(() => showToast, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((toast) => {
          const tone = toast.tone ?? "neutral";
          const Icon = TONE_ICON[tone];

          return (
            <div
              key={toast.id}
              className={cn("framefic-toast", `toast-${tone}`)}
              role={tone === "error" ? "alert" : "status"}
            >
              <span className="toast-icon">
                <Icon aria-hidden={true} />
              </span>
              <p className="toast-message">{toast.message}</p>
              {toast.action ? (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
