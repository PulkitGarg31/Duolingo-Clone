import { Select } from "@/components/ui";
import type { Theme } from "@/lib/api/types";
import { SettingRow } from "./SettingsLayout";

/** "Dark mode": on, off, or following the device. */
const THEME_OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: "system", label: "System default" },
  { value: "dark", label: "On" },
  { value: "light", label: "Off" },
];

interface ThemeSelectProps {
  value: Theme;
  onChange: (theme: Theme) => void;
}

export function ThemeSelect({ value, onChange }: ThemeSelectProps) {
  function handleChange(next: string) {
    const option = THEME_OPTIONS.find((candidate) => candidate.value === next);
    if (option) onChange(option.value);
  }
  return (
    <SettingRow label="Dark mode" htmlFor="setting-theme" stackOnPhones>
      <Select id="setting-theme" value={value} options={THEME_OPTIONS} onValueChange={handleChange} className="sm:w-[216px] sm:shrink-0" />
    </SettingRow>
  );
}
