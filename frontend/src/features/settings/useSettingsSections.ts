"use client";

import { useState } from "react";
import { useComingSoon } from "@/features/shell/ComingSoon";
import { useTheme } from "@/lib/theme/ThemeProvider";

export interface SettingsSectionLink {
  label: string;
  /** The id of the block on the settings page that the entry scrolls to. */
  target?: string;
  /** For entries that are not built: completes "We're still building {feature}". */
  comingSoon?: string;
}

/** The ids the settings page gives its blocks; links such as "/settings#demo-tools" use them too. */
export const SETTINGS_TARGETS = { preferences: "preferences", demoTools: "demo-tools" } as const;

const SECTIONS: readonly SettingsSectionLink[] = [
  { label: "Preferences", target: SETTINGS_TARGETS.preferences },
  { label: "Demo tools", target: SETTINGS_TARGETS.demoTools },
  { label: "Profile", comingSoon: "profile settings" },
  { label: "Notifications", comingSoon: "notification settings" },
  { label: "Courses", comingSoon: "course settings" },
  { label: "Privacy settings", comingSoon: "privacy settings" },
];

export interface SettingsSections {
  sections: readonly SettingsSectionLink[];
  /** The label of the selected entry. */
  active: string;
  choose: (section: SettingsSectionLink) => void;
}

/**
 * The settings menu: which entry is selected and what choosing one does. Built entries scroll to their block
 * on the page; the others open Coming soon. Demo tools is listed only when the server has them on.
 */
export function useSettingsSections(hasDemoTools: boolean): SettingsSections {
  const { reducedMotion } = useTheme();
  const showComingSoon = useComingSoon();
  const [active, setActive] = useState("Preferences");
  const sections = hasDemoTools ? SECTIONS : SECTIONS.filter((section) => section.target !== SETTINGS_TARGETS.demoTools);

  function choose(section: SettingsSectionLink) {
    if (section.comingSoon) {
      showComingSoon(section.comingSoon);
      return;
    }
    setActive(section.label);
    if (section.target) {
      document.getElementById(section.target)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
  }

  return { sections, active, choose };
}
