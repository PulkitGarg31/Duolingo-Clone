"use client";

import { Button, Input } from "@/components/ui";
import { GuestCard } from "@/features/rail/GuestCard";
import { useComingSoon } from "@/features/shell/ComingSoon";
import type { MeUser } from "@/lib/api/types";
import { useLogout } from "@/lib/queries/mutations";
import { ComingSoonRow, FieldLabel } from "./SettingsLayout";
import { TimezoneField } from "./TimezoneField";

export type AccountUser = Pick<MeUser, "displayName" | "email" | "isDemo">;

interface AccountSectionProps {
  user: AccountUser;
  timezone: string;
  onTimezoneChange: (zone: string) => void;
}

/**
 * The account fields. The API cannot rename a learner or change sign-in details, so the display name and the
 * email are read-only; the time zone is the one editable field. A signed-in learner can log out here (phones
 * have no MORE menu); a demo learner is invited to create a profile instead.
 */
export function AccountSection({ user, timezone, onTimezoneChange }: AccountSectionProps) {
  return (
    <div className="space-y-6 pt-2">
      <div>
        <div className="mb-2">
          <FieldLabel htmlFor="setting-display-name">Display name</FieldLabel>
        </div>
        <Input id="setting-display-name" value={user.displayName} readOnly />
      </div>
      <TimezoneField value={timezone} onChange={onTimezoneChange} />
      {user.isDemo ? <GuestCard /> : <SignInDetails email={user.email} />}
    </div>
  );
}

function SignInDetails({ email }: { email: string | null }) {
  const showComingSoon = useComingSoon();
  const logout = useLogout();
  return (
    <>
      {email && (
        <div>
          <div className="mb-2">
            <FieldLabel htmlFor="setting-email">Email</FieldLabel>
          </div>
          <Input id="setting-email" type="email" value={email} readOnly />
        </div>
      )}
      <div>
        <ComingSoonRow label="Password" onSelect={() => showComingSoon("password changes")} />
        <Button variant="outline" fullWidth className="mt-6" loading={logout.isPending} onClick={() => logout.mutate()}>
          Log out
        </Button>
      </div>
    </>
  );
}
