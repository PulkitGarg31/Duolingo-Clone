"use client";

import { useState } from "react";
import { useToast } from "@/components/ui";
import type { DemoTask } from "@/features/settings/demoTools";
import { SettingsView } from "@/features/settings/SettingsView";
import { TimeTravelPanel } from "@/features/settings/TimeTravelPanel";
import { RightRailSlotContext } from "@/features/shell/RightRailSlot";
import type { SettingsOut, SettingsPatchIn } from "@/lib/api/types";
import { clock, me, settings } from "../fixtures";

const PRETEND_MS = 900;

/**
 * Settings with a pretend server: saving and the demo buttons resolve after a short wait. A stand-in right
 * rail receives the section menu, as the app frame's does.
 */
export default function SettingsPreview() {
  const { toast } = useToast();
  const [saved, setSaved] = useState<SettingsOut>(settings);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<DemoTask | null>(null);
  const [railSlot, setRailSlot] = useState<HTMLDivElement | null>(null);

  function pretend(task: DemoTask) {
    setRunning(task);
    setTimeout(() => {
      setRunning(null);
      toast({ tone: "info", message: `Ran "${task}".` });
    }, PRETEND_MS);
  }

  function save(patch: SettingsPatchIn, onSaved: () => void) {
    setSaving(true);
    setTimeout(() => {
      setSaved((current) => ({ ...current, ...patch }));
      setSaving(false);
      onSaved();
      toast({ tone: "success", message: "Settings saved" });
    }, PRETEND_MS);
  }

  return (
    <RightRailSlotContext value={railSlot}>
      <div className="mx-auto flex max-w-[1020px] gap-12">
        <div className="min-w-0 flex-1">
          <SettingsView
            saved={saved}
            user={me.user}
            saving={saving}
            onSave={save}
            demoTools={
              <TimeTravelPanel
                clock={clock}
                isDemo={me.user.isDemo}
                running={running}
                busy={running !== null}
                onRun={pretend}
                onReset={() => pretend("reset")}
              />
            }
          />
        </div>
        <aside className="hidden w-[380px] shrink-0 pt-6 xl:block">
          <div ref={setRailSlot} />
        </aside>
      </div>
    </RightRailSlotContext>
  );
}
