import type { SelectOption } from "@/components/ui";

/** "America/New_York" → "America/New York". */
export function timeZoneLabel(zone: string): string {
  return zone.replaceAll("_", " ");
}

/**
 * Select options for `available` zones, alphabetical. `required` zones (the saved one, the device's) are
 * added when the list lacks them, so the current choice is always selectable.
 */
export function timeZoneOptions(available: readonly string[], ...required: string[]): SelectOption[] {
  const zones = [...new Set([...available, ...required])].sort();
  return zones.map((zone) => ({ value: zone, label: timeZoneLabel(zone) }));
}

/** The browser's IANA zone, e.g. "Europe/Madrid". Browser only. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

let knownZones: readonly string[] | undefined;

/**
 * Every zone the browser knows, read once. Browser only. Older browsers cannot list them; the field then
 * offers the saved and the device zones only.
 */
export function browserTimeZones(): readonly string[] {
  knownZones ??= typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return knownZones;
}
