"use client";

import { useCallback, useEffect, useState } from "react";
import type { SettingsOut, SettingsPatchIn } from "@/lib/api/types";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { settingsPatch } from "./settingsPatch";

export interface SettingsDraft {
  /** What the form shows: the saved settings with the unsaved edits on top. */
  values: SettingsOut;
  /** The changed fields, ready for `PATCH /me/settings`. */
  patch: SettingsPatchIn;
  /** Something differs from the saved settings, so SAVE CHANGES is enabled. */
  dirty: boolean;
  set: <K extends keyof SettingsOut>(field: K, value: SettingsOut[K]) => void;
  /** Drops the edits, after a save. */
  reset: () => void;
}

/**
 * Unsaved edits over the saved settings. Only the edits are kept here, so the form always reflects the
 * latest saved values underneath them. A theme edit is previewed at once; saving or leaving the page returns
 * the app to the saved theme.
 */
export function useSettingsDraft(saved: SettingsOut): SettingsDraft {
  const [edits, setEdits] = useState<SettingsPatchIn>({});
  const { previewTheme } = useTheme();

  useEffect(() => {
    previewTheme(edits.theme ?? null);
  }, [edits.theme, previewTheme]);

  useEffect(() => () => previewTheme(null), [previewTheme]);

  const set = useCallback(<K extends keyof SettingsOut>(field: K, value: SettingsOut[K]) => {
    setEdits((current) => ({ ...current, [field]: value }));
  }, []);
  const reset = useCallback(() => setEdits({}), []);

  const patch = settingsPatch(saved, edits);
  return { values: { ...saved, ...edits }, patch, dirty: Object.keys(patch).length > 0, set, reset };
}
