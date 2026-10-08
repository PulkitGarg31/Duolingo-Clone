/** Outlines shared by several icons, all on the 32-unit grid. */
import { roundedPolygon, starPoints } from "./geometry";

/** A plump heart with a rounded tip (x 2.8–29.2, y 5–27.9). */
export const HEART =
  "M16 8.6C14.4 6.2 11.9 5 9.4 5C5.6 5 2.8 8 2.8 11.9C2.8 18.2 10.2 23.9 14.3 27.1" +
  "C15.3 27.9 16.7 27.9 17.7 27.1C21.8 23.9 29.2 18.2 29.2 11.9C29.2 8 26.4 5 22.6 5C20.1 5 17.6 6.2 16 8.6Z";

/** The streak flame: a round-bottomed flame with its main tip at the top and a smaller lick on the left. */
export const FLAME =
  "M16.8 2.4C18 2.4 18.6 4 19.8 6.2C22.4 10.8 26 14.2 26 19.8C26 25.6 21.6 29.4 16 29.4C10.4 29.4 6 25.6 6 19.8" +
  "C6 16.6 7.2 13.6 8.8 11.4C9.3 10.8 10.1 11 10.3 11.7C10.6 12.8 11 13.4 11.6 13.4C12.3 13.4 12.6 12.4 12.9 11" +
  "C13.6 7.6 15 2.4 16.8 2.4Z";

/** The flame's inner drop, sitting low inside FLAME with its tip under the main tip. */
export const FLAME_CORE =
  "M16.4 13C16.9 13 17.3 13.5 17.8 14.2C18.6 15.3 19.4 16.2 20.1 17.1C21.1 18.5 21.6 20.2 21.6 22" +
  "C21.6 24.9 19.2 27 16.2 27C13.2 27 10.8 24.9 10.8 22C10.8 19.9 11.9 18.3 13.3 16.8" +
  "C14.3 15.7 15.2 14.6 15.6 13.6C15.8 13.2 16 13 16.4 13Z";

/** The flame's white highlight, a short curved stroke along its lower left. */
export const FLAME_HIGHLIGHT = "M9.4 21.6C9.3 19.8 9.6 18.4 10.2 17.2";

/** A five-point star with soft points and notches, its bounding box centred on the grid. */
export const STAR = roundedPolygon(starPoints(16, 17.36, 15.4, 7.3), [2.8, 1.4]);

/** The XP bolt. Corners: top tip, left point, left notch, bottom tip, right point, right notch. */
export const BOLT = roundedPolygon(
  [
    [20, 2.6],
    [6, 18.2],
    [13.6, 18.2],
    [12, 29.4],
    [26, 13.2],
    [18.4, 13.2],
  ],
  [2.4, 2, 1, 2.4, 2, 1],
);

/** Everything left of the line through BOLT's two tips, for splitting the bolt lengthwise into two tones. */
export const BOLT_LEFT_HALF = "M0 0H20.78L11.22 32H0Z";
