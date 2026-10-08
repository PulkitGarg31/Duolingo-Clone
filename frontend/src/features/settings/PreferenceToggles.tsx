"use client";

import { ComingSoonPill, Switch } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import type { SettingsOut } from "@/lib/api/types";
import { SettingRow } from "./SettingsLayout";

type ToggleField = "soundEffects" | "animations" | "motivationalMessages" | "listeningExercises";

const TOGGLES: readonly { field: ToggleField; label: string }[] = [
  { field: "soundEffects", label: "Sound effects" },
  { field: "animations", label: "Animations" },
  { field: "motivationalMessages", label: "Motivational messages" },
  { field: "listeningExercises", label: "Listening exercises" },
];

interface PreferenceTogglesProps {
  values: Pick<SettingsOut, ToggleField>;
  onChange: (field: ToggleField, on: boolean) => void;
}

/**
 * The lesson-experience switches. Speaking exercises would need speech recognition, which is not built: its
 * switch stays off and its label opens Coming soon.
 */
export function PreferenceToggles({ values, onChange }: PreferenceTogglesProps) {
  const showComingSoon = useComingSoon();
  return (
    <div>
      {TOGGLES.map(({ field, label }) => (
        <SettingRow key={field} label={label} htmlFor={`setting-${field}`}>
          <Switch id={`setting-${field}`} checked={values[field]} onCheckedChange={(on) => onChange(field, on)} />
        </SettingRow>
      ))}
      <SettingRow
        label={
          <button
            type="button"
            onClick={() => showComingSoon("speaking exercises")}
            className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            Speaking exercises
            <ComingSoonPill />
          </button>
        }
      >
        <Switch checked={false} disabled aria-label="Speaking exercises" onCheckedChange={() => undefined} />
      </SettingRow>
    </div>
  );
}
