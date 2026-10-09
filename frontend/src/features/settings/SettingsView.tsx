"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { RightRailPortal } from "@/features/shell/RightRailSlot";
import type { SettingsOut, SettingsPatchIn } from "@/lib/api/types";
import { DISCLAIMER } from "@/lib/constants";
import { AccountSection, type AccountUser } from "./AccountSection";
import { DailyGoalPicker } from "./DailyGoalPicker";
import { PreferenceToggles } from "./PreferenceToggles";
import { SettingsSection } from "./SettingsLayout";
import { SettingsNav } from "./SettingsNav";
import { SettingsTabs } from "./SettingsTabs";
import { ThemeSelect } from "./ThemeSelect";
import { SETTINGS_TARGETS, useSettingsSections } from "./useSettingsSections";
import { useSettingsDraft } from "./useSettingsDraft";

interface SettingsViewProps {
  saved: SettingsOut;
  user: AccountUser;
  saving: boolean;
  /** Sends the changed fields; `onSaved` runs once the server has them. */
  onSave: (patch: SettingsPatchIn, onSaved: () => void) => void;
  /** The Demo tools card, when the server has dev tools on. */
  demoTools?: ReactNode;
}

/**
 * Preferences: edits collect until SAVE CHANGES (in the header, or pinned above the tab bar on phones), and
 * the theme previews as soon as it is picked. The section menu sits in the right rail on wide screens and in
 * a tab strip above the page otherwise.
 */
export function SettingsView({ saved, user, saving, onSave, demoTools }: SettingsViewProps) {
  const draft = useSettingsDraft(saved);
  const menu = useSettingsSections(Boolean(demoTools));
  const save = () => onSave(draft.patch, draft.reset);

  // Links such as "/settings#daily-goal" arrive before the page has content; scroll once it is there.
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target) document.getElementById(decodeURIComponent(target))?.scrollIntoView({ block: "start" });
  }, []);

  const saveButton = (
    <Button disabled={!draft.dirty} loading={saving} onClick={save} fullWidth>
      Save changes
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[592px] px-4 pt-4 pb-32 lg:px-0 lg:pt-6 lg:pb-16">
      <RightRailPortal>
        <SettingsNav {...menu} />
      </RightRailPortal>
      <div className="mb-6 xl:hidden">
        <SettingsTabs {...menu} />
      </div>
      <div id={SETTINGS_TARGETS.preferences} className="scroll-mt-24">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[24px]/[30px] font-extrabold text-fg-strong md:text-title-lg">Preferences</h1>
          <div className="hidden w-[180px] lg:block">{saveButton}</div>
        </div>
        <SettingsSection title="Lesson experience">
          <PreferenceToggles values={draft.values} onChange={draft.set} />
        </SettingsSection>
        <SettingsSection title="Appearance">
          <ThemeSelect value={draft.values.theme} onChange={(theme) => draft.set("theme", theme)} />
        </SettingsSection>
        <SettingsSection title="Daily goal" id="daily-goal">
          <DailyGoalPicker value={draft.values.dailyGoalXp} onChange={(goal) => draft.set("dailyGoalXp", goal)} />
        </SettingsSection>
        <SettingsSection title="Account">
          <AccountSection
            user={user}
            timezone={draft.values.timezone}
            onTimezoneChange={(zone) => draft.set("timezone", zone)}
          />
        </SettingsSection>
      </div>
      {demoTools}
      {/* Wide screens show this in the rail's footer. */}
      <p className="mt-12 text-[13px] leading-[18px] font-semibold text-fg-3 xl:hidden">{DISCLAIMER}</p>
      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-(--z-sticky) border-t-2 border-line bg-page px-4 py-3 lg:hidden">
        {saveButton}
      </div>
    </div>
  );
}
