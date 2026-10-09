"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Divider, Modal, Pill, Skeleton } from "@/components/ui";
import type { ClockOut } from "@/lib/api/types";
import { serverNow } from "@/lib/time/serverClock";
import { DEMO_BUTTONS, formatOffset, formatSimulatedTime, resetCopy, type DemoAction, type DemoTask } from "./demoTools";
import { SETTINGS_TARGETS } from "./useSettingsSections";

interface TimeTravelPanelProps {
  /** The simulated clock; undefined while it loads. */
  clock: ClockOut | undefined;
  /** A demo learner (RESET DEMO DATA) rather than an account (RESET MY PROGRESS). */
  isDemo: boolean;
  running: DemoTask | null;
  /** Holds every button while a task runs or the learner's numbers refresh after one. */
  busy: boolean;
  onRun: (action: DemoAction) => void;
  onReset: () => void;
}

/**
 * The Demo tools card: the simulated clock and the buttons that move it forward or change hearts and gems,
 * so streaks, heart regeneration and league weeks can be tried in minutes. Every account has its own clock,
 * so the tools touch only the learner using them. Time only moves forward; the reset (RESET DEMO DATA, or
 * RESET MY PROGRESS on an account) is the one way back, behind a confirmation.
 */
export function TimeTravelPanel({ clock, isDemo, running, busy, onRun, onReset }: TimeTravelPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const reset = resetCopy(isDemo);
  return (
    <section
      id={SETTINGS_TARGETS.demoTools}
      aria-labelledby="demo-tools-title"
      className="mt-12 scroll-mt-24 rounded-lg border-2 border-line p-5"
    >
      <div className="flex items-center gap-3">
        <h2 id="demo-tools-title" className="text-heading text-fg-strong">
          Demo tools
        </h2>
        <Pill tone="beetle">Dev</Pill>
      </div>
      <p className="mt-1 text-body text-fg-2">
        Simulate time to test streaks, hearts and leagues. Changes affect only your account.
      </p>
      {clock ? <ClockReadout clock={clock} /> : <Skeleton className="mt-5 h-[84px] w-64 max-w-full rounded-md" />}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {DEMO_BUTTONS.map(({ action, label }) => (
          <Button
            key={action}
            variant="outline"
            loading={running === action}
            disabled={busy && running !== action}
            onClick={() => onRun(action)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Divider className="mt-3 mb-5" />
      <Button
        variant="danger"
        fullWidth
        loading={running === "reset"}
        disabled={busy && running !== "reset"}
        onClick={() => setConfirming(true)}
      >
        {reset.button}
      </Button>
      <Modal
        open={confirming}
        onOpenChange={setConfirming}
        layout="dialog"
        title={reset.title}
        description={reset.description}
        actions={
          <>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                onReset();
              }}
            >
              Reset
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </section>
  );
}

/** "Simulated time", the learner's local date and time on the server clock, and how far it runs ahead. */
function ClockReadout({ clock }: { clock: ClockOut }) {
  const minute = useServerMinute();
  const instant = minute === null ? Date.parse(clock.now) : minute * MINUTE_MS;
  return (
    <div className="mt-5">
      <p className="text-overline text-fg-2 uppercase">Simulated time</p>
      <p className="text-title text-fg-strong">{formatSimulatedTime(instant, clock.timezone)}</p>
      <p className="text-small text-fg-2">{formatOffset(clock.offsetSeconds)}</p>
    </div>
  );
}

const MINUTE_MS = 60_000;
const TICK_MS = 10_000;

function subscribeToTicks(onTick: () => void): () => void {
  const timer = setInterval(onTick, TICK_MS);
  return () => clearInterval(timer);
}

const currentServerMinute = () => Math.floor(serverNow() / MINUTE_MS);

/**
 * The server clock's current minute, so the readout keeps time between jumps. Server time includes the
 * demo offset, and every response (a jump's included) brings it up to date. Null while server rendering.
 */
function useServerMinute(): number | null {
  return useSyncExternalStore(subscribeToTicks, currentServerMinute, () => null);
}
