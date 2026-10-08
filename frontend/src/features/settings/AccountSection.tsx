"use client";

import { Input } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import { ComingSoonRow, FieldLabel } from "./SettingsLayout";
import { TimezoneField } from "./TimezoneField";

interface AccountSectionProps {
  displayName: string;
  timezone: string;
  onTimezoneChange: (zone: string) => void;
}

/**
 * The account fields. The API cannot rename a learner, so the display name is read-only; the time zone is
 * the one editable field. Sign-in details are Coming soon.
 */
export function AccountSection({ displayName, timezone, onTimezoneChange }: AccountSectionProps) {
  const showComingSoon = useComingSoon();
  return (
    <div className="space-y-6 pt-2">
      <div>
        <div className="mb-2">
          <FieldLabel htmlFor="setting-display-name">Display name</FieldLabel>
        </div>
        <Input id="setting-display-name" value={displayName} readOnly />
      </div>
      <TimezoneField value={timezone} onChange={onTimezoneChange} />
      <div>
        <ComingSoonRow label="Email" onSelect={() => showComingSoon("email sign-in")} />
        <ComingSoonRow label="Password" onSelect={() => showComingSoon("passwords")} />
      </div>
    </div>
  );
}
