"use client";

import { useToast } from "@/components/ui";
import { domainErrorMessage } from "@/features/shell/domainErrorMessage";
import type { SettingsPatchIn } from "@/lib/api/types";
import { useMe, useSettings } from "@/lib/queries/hooks";
import { useUpdateSettings } from "@/lib/queries/mutations";
import { DemoToolsSection } from "./DemoToolsSection";
import { SettingsSkeleton } from "./SettingsSkeleton";
import { SettingsView } from "./SettingsView";

/** `/settings`. A failed load goes to the route's error boundary, whose TRY AGAIN refetches. */
export function SettingsPage() {
  const me = useMe();
  const settings = useSettings();
  const update = useUpdateSettings();
  const { toast } = useToast();

  if (!me.data || !settings.data) {
    const error = me.error ?? settings.error;
    if (error) throw error;
    return <SettingsSkeleton />;
  }

  function save(patch: SettingsPatchIn, onSaved: () => void) {
    update.mutate(patch, {
      onSuccess: () => {
        onSaved();
        toast({ tone: "success", message: "Settings saved" });
      },
      // Every other field is picked from a fixed list, so the time zone is the one the server can refuse.
      onError: (error) => {
        const message = domainErrorMessage(error, { VALIDATION_ERROR: "That time zone isn't available. Pick another one." });
        if (message) toast({ tone: "error", message, requestId: error.requestId });
      },
    });
  }

  return (
    <SettingsView
      saved={settings.data}
      displayName={me.data.user.displayName}
      saving={update.isPending}
      onSave={save}
      demoTools={me.data.dev?.enabled ? <DemoToolsSection me={me.data} /> : undefined}
    />
  );
}
