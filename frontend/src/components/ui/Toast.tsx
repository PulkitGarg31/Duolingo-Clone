"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { EASE_SPRING, useFadeSeconds } from "./transitions";

/**
 * - `success`: a green check circle.
 * - `reward`: pass the matching `icon` (gem, bolt, heart, freeze) and colour the amount in the message.
 * - `info`: a blue "i"; `warning`: an orange "!"; `error`: a red "!", announced assertively.
 */
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
  /** A trailing button. A toast with an action stays until it is used or pushed out. */
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
/** An upward swipe this long, or this fast, dismisses a toast on touch screens. */
const SWIPE_DISMISS_DISTANCE_PX = 24;
const SWIPE_DISMISS_VELOCITY = 300;

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Hosts the toast stack: top centre, under the phone's top bar or 24 px from the top on wider screens, at
 * most three at a time with the newest on top.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const lastId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    lastId.current += 1;
    const id = `toast-${lastId.current}`;
    setEntries((current) => [{ ...options, id }, ...current].slice(0, MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The stack ignores the pointer so it never blocks the page; each toast takes it back. */}
      <div className="pointer-events-none fixed inset-x-0 top-[70px] z-(--z-toast) flex flex-col items-center gap-2 px-4 lg:top-6">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <ToastCard key={entry.id} entry={entry} onDismiss={dismiss} />
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

function ToastCard({ entry, onDismiss }: { entry: ToastEntry; onDismiss: (id: string) => void }) {
  const tone = entry.tone ?? "info";
  const [paused, setPaused] = useState(false);
  // Time left before auto-dismiss; null for toasts that wait for their action.
  const remainingMs = useRef(entry.action ? null : (entry.durationMs ?? (tone === "error" ? ERROR_DURATION_MS : DURATION_MS)));
  const dragControls = useDragControls();
  const fade = useFadeSeconds();
  const close = useEffectEvent(() => onDismiss(entry.id));

  // Counts down while not hovered; leaving resumes with the time that was left.
  useEffect(() => {
    if (paused || remainingMs.current === null) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => close(), remainingMs.current);
    return () => {
      clearTimeout(timer);
      if (remainingMs.current !== null) remainingMs.current -= Date.now() - startedAt;
    };
  }, [paused]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // Only touch drags it: a mouse can still select the text.
    if (event.pointerType === "touch") dragControls.start(event);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -SWIPE_DISMISS_DISTANCE_PX || info.velocity.y < -SWIPE_DISMISS_VELOCITY) onDismiss(entry.id);
  }

  return (
    <motion.div
      layout
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: fade(0.3), ease: EASE_SPRING } }}
      exit={{ opacity: 0, y: -16, transition: { duration: fade(0.2) } }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.6, bottom: 0 }}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="pointer-events-auto flex max-w-[420px] min-w-[280px] touch-pan-x items-center gap-3 rounded-lg border-2 border-line bg-page px-4 py-3 text-body text-fg shadow-[0_2px_0_var(--c-line)]"
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            entry.action?.onClick();
            onDismiss(entry.id);
          }}
        >
          {entry.action.label}
        </Button>
      )}
    </motion.div>
  );
}

const GLYPH_FILL: Record<ToastTone, string> = {
  success: "fill-primary",
  reward: "fill-xp",
  info: "fill-secondary",
  warning: "fill-streak",
  error: "fill-danger",
};

/** A filled circle with a check (success, reward), an "i" (info) or a "!" (warning, error). */
function ToneGlyph({ tone }: { tone: ToastTone }) {
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden="true">
      <circle cx="14" cy="14" r="13" className={GLYPH_FILL[tone]} />
      {tone === "success" || tone === "reward" ? (
        <path
          d="M8.5 14.5l3.5 3.5 7.5-8"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-on-color-fixed"
        />
      ) : tone === "info" ? (
        <g className="fill-on-color-fixed">
          <circle cx="14" cy="8.5" r="1.9" />
          <rect x="12.4" y="12" width="3.2" height="9" rx="1.6" />
        </g>
      ) : (
        <g className="fill-on-color-fixed">
          <rect x="12.4" y="6.5" width="3.2" height="10" rx="1.6" />
          <circle cx="14" cy="20.6" r="1.9" />
        </g>
      )}
    </svg>
  );
}
