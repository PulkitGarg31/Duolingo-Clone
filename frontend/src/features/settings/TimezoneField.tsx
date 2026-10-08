"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Button, Select } from "@/components/ui";
import { FieldLabel } from "./SettingsLayout";
import { browserTimeZones, deviceTimeZone, timeZoneOptions } from "./timeZones";

const NO_ZONES: readonly string[] = [];

/** The zone list and the device zone never change while the page is open, so there is nothing to observe. */
function subscribeToNothing(): () => void {
  return () => undefined;
}

interface TimezoneFieldProps {
  value: string;
  onChange: (zone: string) => void;
}

/**
 * The learner's time zone: when their day starts and ends, for the streak, the daily goal and quests. The
 * browser's list and zone are only read in the browser, so the server render never disagrees with it.
 */
export function TimezoneField({ value, onChange }: TimezoneFieldProps) {
  const device = useSyncExternalStore(subscribeToNothing, deviceTimeZone, () => null);
  const zones = useSyncExternalStore(subscribeToNothing, browserTimeZones, () => NO_ZONES);
  const options = useMemo(() => timeZoneOptions(zones, value, ...(device ? [device] : [])), [zones, value, device]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <FieldLabel htmlFor="setting-time-zone">Time zone</FieldLabel>
        <Button variant="ghost" size="inline" disabled={!device || device === value} onClick={() => device && onChange(device)}>
          Use device time zone
        </Button>
      </div>
      <Select id="setting-time-zone" value={value} options={options} onValueChange={onChange} />
    </div>
  );
}
