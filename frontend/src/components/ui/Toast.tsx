"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "reward" | "info" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: ReactNode;
  /** Defaults to "info". */
  tone?: ToastTone;
  /** Replaces the tone's glyph, e.g. a gem for "+20 gems". */
  icon?: ReactNode;
  /** A trailing button. A toast with an action stays until it is used or replaced. */
  action?: ToastAction;
  /** Shown as an error-ID chip, to match the failure with server logs. */
  requestId?: string | null;
  /** Overrides the auto-dismiss delay (3 s, 6 s for errors). */
  durationMs?: number;
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

const MAX_VISIBLE = 3;
const DURATION_MS = 3_000;
const ERROR_DURATION_MS = 6_000;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastId = useRef(0);

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      lastId.current += 1;
      const id = `toast-${lastId.current}`;
      setEntries((current) => [...current, { ...options, id }].slice(-MAX_VISIBLE));
      const duration = options.durationMs ?? (options.tone === "error" ? ERROR_DURATION_MS : DURATION_MS);
      if (!options.action) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[70px] z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 lg:top-6">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <ToastCard key={entry.id} entry={entry} onDismiss={() => dismiss(entry.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

function ToastCard({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const tone = entry.tone ?? "info";
  return (
    <motion.div
      layout
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
      className="pointer-events-auto flex min-w-[280px] max-w-[420px] items-center gap-3 rounded-lg border-2 border-line bg-page px-4 py-3 text-body text-fg shadow-[0_2px_0_var(--c-line)]"
    >
      <span className="flex size-7 shrink-0 items-center justify-center">{entry.icon ?? <ToneGlyph tone={tone} />}</span>
      <div className="min-w-0 flex-1">
        {entry.message}
        {entry.requestId && (
          <span className="ml-2 inline-block rounded-full bg-subtle px-2 py-0.5 align-middle text-caption text-fg-3">
            {entry.requestId}
          </span>
        )}
      </div>
      {entry.action && (
        <button
          type="button"
          onClick={() => {
            entry.action?.onClick();
            onDismiss();
          }}
          className="shrink-0 rounded-sm px-2 py-1 text-label uppercase text-link focus-visible:outline-2 focus-visible:outline-focus"
        >
          {entry.action.label}
        </button>
      )}
    </motion.div>
  );
}

const TONE_COLORS: Record<ToastTone, string> = {
  success: "var(--c-primary)",
  reward: "var(--c-xp)",
  info: "var(--c-secondary)",
  warning: "var(--c-streak)",
  error: "var(--c-danger)",
};

/** A filled circle with a check (success, reward), an "i" (info) or a "!" (warning, error). */
function ToneGlyph({ tone }: { tone: ToastTone }) {
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden="true">
      <circle cx="14" cy="14" r="13" fill={TONE_COLORS[tone]} />
      {tone === "success" || tone === "reward" ? (
        <path d="M8.5 14.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : tone === "info" ? (
        <>
          <circle cx="14" cy="8.5" r="1.9" fill="#fff" />
          <rect x="12.4" y="12" width="3.2" height="9" rx="1.6" fill="#fff" />
        </>
      ) : (
        <>
          <rect x="12.4" y="6.5" width="3.2" height="10" rx="1.6" fill="#fff" />
          <circle cx="14" cy="20.6" r="1.9" fill="#fff" />
        </>
      )}
    </svg>
  );
}
