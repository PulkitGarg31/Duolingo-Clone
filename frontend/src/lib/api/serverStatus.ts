import { createContext, useContext, useSyncExternalStore } from "react";

/*
 * The API runs on Render's free tier, which sleeps after about 15 idle minutes and takes 30–60 s to wake.
 * This module holds the client's view of that: a wake gate (is the server answering?), a boot watch (did it
 * restart and re-seed the demo?) and a keep-alive ping. The gate and the watch are small stores that live
 * outside React, so their state survives when navigation swaps the route-group layout that renders
 * `ServerWakeGate`; React reads the gate through `useWakeGate` and `ServerReadyContext`.
 */

/** Timeout of one /health probe. */
export const HEALTH_PROBE_TIMEOUT_MS = 10_000;
/** Fast answers never flash the wake screen. */
const WAKE_SCREEN_DELAY_MS = 1_500;
/** Pause between failed probes. */
const POLL_INTERVAL_MS = 2_000;
/** After this long the wake screen adds "Almost there". */
const SLOW_WAKE_MS = 20_000;
/** After this long the wake screen gives up and offers TRY AGAIN. */
const GIVE_UP_MS = 90_000;
/** Shorter than Render's 15-minute idle timeout, so an open tab keeps the server awake. */
const KEEP_ALIVE_INTERVAL_MS = 240_000;
const BOOT_ID_STORAGE_KEY = "bootId";

type Timer = ReturnType<typeof setTimeout>;

// ------------------------------------------------------------------------------------------------ wake gate

/**
 * idle: nothing checked yet · checking: a probe is out, nothing shown · waking: the wake screen is shown ·
 * ready: the server answered · failed: we gave up until the learner presses TRY AGAIN.
 */
export type WakePhase = "idle" | "checking" | "waking" | "ready" | "failed";

export interface WakeState {
  readonly phase: WakePhase;
  /** The wait has passed 20 s. */
  readonly slow: boolean;
}

const INITIAL_WAKE_STATE: WakeState = { phase: "idle", slow: false };

/** Resolves when the server is healthy, rejects otherwise. */
type HealthProbe = () => Promise<unknown>;

export function createWakeGate() {
  let state = INITIAL_WAKE_STATE;
  let probe: HealthProbe | null = null;
  // Each wake cycle gets a new number, so a probe that answers after its cycle ended is ignored.
  let cycle = 0;
  const timers = new Set<Timer>();
  const listeners = new Set<() => void>();

  function update(patch: Partial<WakeState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  function schedule(ms: number, run: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  }

  function endCycle() {
    cycle += 1;
    timers.forEach(clearTimeout);
    timers.clear();
  }

  function startCycle(phase: "checking" | "waking") {
    endCycle();
    const current = cycle;
    update({ phase, slow: false });
    schedule(WAKE_SCREEN_DELAY_MS, () => {
      if (state.phase === "checking") update({ phase: "waking" });
    });
    schedule(SLOW_WAKE_MS, () => update({ slow: true }));
    schedule(GIVE_UP_MS, giveUp);
    void poll(current);
  }

  async function poll(current: number) {
    if (!probe) return;
    try {
      await probe();
      if (current !== cycle) return;
      endCycle();
      update({ phase: "ready", slow: false });
    } catch {
      if (current !== cycle) return;
      // Polling cannot help while the browser itself is offline.
      if (isBrowserOffline()) giveUp();
      else schedule(POLL_INTERVAL_MS, () => void poll(current));
    }
  }

  function giveUp() {
    endCycle();
    update({ phase: "failed", slow: false });
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot(): WakeState {
      return state;
    },

    /** First mount: registers the probe and checks the server. Later mounts are no-ops. */
    start(healthProbe: HealthProbe): void {
      probe = healthProbe;
      if (state.phase === "idle") startCycle("checking");
    },

    /** A request just failed in a way that suggests the server fell asleep: check again. */
    rearm(): void {
      if (state.phase === "ready") startCycle("checking");
    },

    /** TRY AGAIN after giving up. The wake screen stays up while the new cycle runs. */
    retry(): void {
      if (state.phase === "failed") startCycle("waking");
    },
  };
}

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export const wakeGate = createWakeGate();

/** The wake gate's state, for `ServerWakeGate`. */
export function useWakeGate(): WakeState {
  return useSyncExternalStore(wakeGate.subscribe, wakeGate.getSnapshot, () => INITIAL_WAKE_STATE);
}

/**
 * True inside `ServerWakeGate` once the server answers. Every query hook is disabled while it is false, which
 * is always the case outside the gate (the landing page, the log-in and sign-up pages, the kitchen sink, the
 * 404 page).
 */
export const ServerReadyContext = createContext(false);

export function useServerReady(): boolean {
  return useContext(ServerReadyContext);
}

// ----------------------------------------------------------------------------------------------- boot watch

/** The server restarted: its database was re-seeded, so the demo progress in this tab is gone. */
export interface BootChange {
  readonly previous: string;
  readonly current: string;
}

type BootStorage = Pick<Storage, "getItem" | "setItem">;

export function createBootWatch(getStorage: () => BootStorage | null) {
  // undefined until the first response, when the id remembered from an earlier visit is read.
  let lastSeen: string | null | undefined;
  const listeners = new Set<(change: BootChange) => void>();

  function readRemembered(): string | null {
    try {
      return getStorage()?.getItem(BOOT_ID_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  function remember(bootId: string) {
    try {
      getStorage()?.setItem(BOOT_ID_STORAGE_KEY, bootId);
    } catch {
      // Storage blocked (private mode): the in-memory id still catches restarts while this tab is open.
    }
  }

  return {
    /** Called with every response's `X-Boot-Id`. Notifies subscribers when it differs from the last one. */
    observe(bootId: string | null | undefined): void {
      if (!bootId) return;
      if (lastSeen === undefined) lastSeen = readRemembered();
      if (bootId === lastSeen) return;
      const previous = lastSeen;
      lastSeen = bootId;
      remember(bootId);
      if (previous !== null) listeners.forEach((listener) => listener({ previous, current: bootId }));
    },

    subscribe(listener: (change: BootChange) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const bootWatch = createBootWatch(() => window.localStorage);

// ----------------------------------------------------------------------------------------------- keep-alive

let keepAliveTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Pings the API every 4 minutes while the app is open, so the server does not fall asleep under a reviewer
 * who pauses. Starting it again is a no-op. A failed ping goes through `apiFetch`, which re-arms the gate.
 */
export function startKeepAlive(ping: () => Promise<unknown>): void {
  if (keepAliveTimer !== undefined) return;
  keepAliveTimer = setInterval(() => {
    ping().catch(() => undefined);
  }, KEEP_ALIVE_INTERVAL_MS);
}
