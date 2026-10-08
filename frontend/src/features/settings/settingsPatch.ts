import type { SettingsOut, SettingsPatchIn } from "@/lib/api/types";

/**
 * The fields of `edits` whose value differs from the saved settings: exactly what SAVE CHANGES sends. An
 * empty result means there is nothing to save.
 */
export function settingsPatch(saved: SettingsOut, edits: SettingsPatchIn): SettingsPatchIn {
  const changed = Object.entries(edits).filter(([field, value]) => value !== saved[field as keyof SettingsOut]);
  return Object.fromEntries(changed) as SettingsPatchIn;
}
