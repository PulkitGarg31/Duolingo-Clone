import { matchesRoute } from "./routes";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Part = readonly [value: number, unit: "d" | "h" | "m"];

/**
 * How far the demo clock runs ahead of real time, in its two largest units and rounded down:
 * "+1d 5h", "+2h 30m", "+30m". A smaller unit that comes out as 0 is left out.
 */
export function formatClockOffset(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / DAY);
  const hours = Math.floor((total % DAY) / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);
  const [largest, smaller]: Part[] =
    days > 0 ? [[days, "d"], [hours, "h"]] : hours > 0 ? [[hours, "h"], [minutes, "m"]] : [[minutes, "m"]];
  const shown = smaller && smaller[0] > 0 ? [largest, smaller] : [largest];
  return `+${shown.map(([value, unit]) => `${value}${unit}`).join(" ")}`;
}

/**
 * The DEV badge shows while the demo clock runs ahead (an offset of 0 means real time, or dev tools off), except
 * on /settings: its Demo tools card shows the simulated time already, and on phones the badge would sit on the
 * pinned SAVE CHANGES bar.
 */
export function showsDevTimeBadge(pathname: string, offsetSeconds: number): boolean {
  return offsetSeconds > 0 && !matchesRoute(pathname, "/settings");
}
