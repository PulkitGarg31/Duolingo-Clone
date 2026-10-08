import { ComingSoonPill, List, ListItem } from "@/components/ui";
import type { SettingsSections } from "./useSettingsSections";

/**
 * The settings menu as a bordered list, for the 380 px right rail on wide screens: Preferences, Demo tools,
 * then the sections that are Coming soon. Narrower screens get `SettingsTabs` at the top of the page.
 */
export function SettingsNav({ sections, active, choose }: SettingsSections) {
  return (
    <nav aria-label="Settings">
      <List>
        {sections.map((section) => (
          <ListItem
            key={section.label}
            selected={section.label === active}
            aria-current={section.label === active ? "true" : undefined}
            detail={section.comingSoon ? <ComingSoonPill /> : undefined}
            onClick={() => choose(section)}
          >
            {section.label}
          </ListItem>
        ))}
      </List>
    </nav>
  );
}
