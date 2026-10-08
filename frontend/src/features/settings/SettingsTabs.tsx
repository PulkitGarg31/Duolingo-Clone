"use client";

import { ComingSoonPill, Tabs } from "@/components/ui";
import type { SettingsSections } from "./useSettingsSections";

/** The settings menu as a sideways-scrolling strip of tabs, for screens without the right rail. */
export function SettingsTabs({ sections, active, choose }: SettingsSections) {
  const items = sections.map((section) => ({
    value: section.label,
    label: section.comingSoon ? (
      <span className="flex items-center gap-2">
        {section.label}
        <ComingSoonPill short />
      </span>
    ) : (
      section.label
    ),
  }));

  return (
    <Tabs
      label="Settings"
      items={items}
      value={active}
      onValueChange={(label) => {
        const section = sections.find((candidate) => candidate.label === label);
        if (section) choose(section);
      }}
    />
  );
}
