import type { ReactNode } from "react";
import { roundedPolygon } from "./geometry";
import { ART, SKIN, type Skin } from "./palette";
import { DotEye, GroundShadow, TwoTone } from "./parts";

/*
 * Building blocks for people: round heads (never square), dot eyes with glints, simple mouths and
 * rounded-trapezoid bodies. Features are placed relative to the head's centre and radius, so children
 * (bigger heads) and adults share them.
 */

interface HeadProps {
  cx: number;
  cy: number;
  r: number;
  skin: Skin;
}

/** A round head with ears. */
export function Head({ cx, cy, r, skin }: HeadProps) {
  return (
    <>
      <circle cx={cx - r} cy={cy + r * 0.1} r={r * 0.24} fill={skin.shade} />
      <circle cx={cx + r} cy={cy + r * 0.1} r={r * 0.24} fill={skin.shade} />
      <circle cx={cx} cy={cy} r={r} fill={skin.base} />
    </>
  );
}

interface FaceProps extends HeadProps {
  /** A closed smile, or a happy open mouth. */
  mouth?: "smile" | "grin";
  /** Rosy cheeks; off for faces whose cheeks are covered (a beard). */
  blush?: boolean;
  /** Class for an open mouth drawn over the smile, toggled by CSS while the person speaks. */
  talkClassName?: string;
}

/** Eyes, nose, cheeks and mouth for a head drawn with `Head`. */
export function Face({ cx, cy, r, skin, mouth = "smile", blush = true, talkClassName }: FaceProps) {
  const eyeY = cy + r * 0.04;
  const eyeOffset = r * 0.36;
  return (
    <>
      {blush && (
        <g fill={ART.pig} fillOpacity={0.7}>
          <circle cx={cx - r * 0.58} cy={cy + r * 0.36} r={r * 0.13} />
          <circle cx={cx + r * 0.58} cy={cy + r * 0.36} r={r * 0.13} />
        </g>
      )}
      <DotEye cx={cx - eyeOffset} cy={eyeY} r={r * 0.15} />
      <DotEye cx={cx + eyeOffset} cy={eyeY} r={r * 0.15} />
      <circle cx={cx} cy={cy + r * 0.27} r={r * 0.09} fill={skin.shade} />
      {mouth === "smile" ? <Smile cx={cx} cy={cy} r={r} /> : <OpenMouth cx={cx} cy={cy} r={r} />}
      {talkClassName && (
        <g className={talkClassName}>
          <OpenMouth cx={cx} cy={cy} r={r} />
        </g>
      )}
    </>
  );
}

function Smile({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const y = cy + r * 0.47;
  const halfWidth = r * 0.24;
  return (
    <path
      d={`M${cx - halfWidth} ${y}Q${cx} ${y + r * 0.24} ${cx + halfWidth} ${y}`}
      fill="none"
      stroke={ART.eel}
      strokeWidth={r * 0.11}
      strokeLinecap="round"
    />
  );
}

/** A half-disc mouth with a tongue. */
function OpenMouth({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const top = cy + r * 0.42;
  const halfWidth = r * 0.27;
  const tongueTop = top + halfWidth * 0.45;
  const tongueHalfWidth = halfWidth * 0.5;
  return (
    <>
      <path
        d={`M${cx - halfWidth} ${top}H${cx + halfWidth}A${halfWidth} ${halfWidth} 0 0 1 ${cx - halfWidth} ${top}Z`}
        fill={ART.eel}
      />
      <path
        d={`M${cx - tongueHalfWidth} ${tongueTop}H${cx + tongueHalfWidth}A${tongueHalfWidth} ${tongueHalfWidth} 0 0 1 ${cx - tongueHalfWidth} ${tongueTop}Z`}
        fill={ART.pig}
      />
    </>
  );
}

/** A body: a trapezoid with round shoulders, wider at the bottom. */
function torsoPath(cx: number, top: number, bottom: number, topHalfWidth: number, bottomHalfWidth: number): string {
  const shoulder = topHalfWidth * 0.6;
  return roundedPolygon(
    [
      [cx - topHalfWidth, top],
      [cx + topHalfWidth, top],
      [cx + bottomHalfWidth, bottom],
      [cx - bottomHalfWidth, bottom],
    ],
    [shoulder, shoulder, 4, 4],
  );
}

/** Where a portrait's head and body sit: the same frame keeps everyone of an age at the same scale. */
export interface Frame {
  head: { cx: number; cy: number; r: number };
  body: { cx: number; top: number; bottom: number; topHalfWidth: number; bottomHalfWidth: number };
}

/**
 * Picture-card portraits on the 120-unit artboard: big heads on short shoulders, so faces read on a small card.
 * Younger people have narrower shoulders and sit lower.
 */
export const PORTRAIT = {
  adult: { head: { cx: 60, cy: 45, r: 27 }, body: { cx: 60, top: 80, bottom: 114, topHalfWidth: 26, bottomHalfWidth: 40 } },
  teen: { head: { cx: 60, cy: 47, r: 26 }, body: { cx: 60, top: 81, bottom: 114, topHalfWidth: 23, bottomHalfWidth: 35 } },
  child: { head: { cx: 60, cy: 50, r: 26 }, body: { cx: 60, top: 84, bottom: 114, topHalfWidth: 20, bottomHalfWidth: 30 } },
} as const satisfies Record<string, Frame>;

interface BustProps {
  frame: Frame;
  skin: Skin;
  shirt: string;
  shirtShade: string;
  mouth?: "smile" | "grin";
  blush?: boolean;
  /** Class for a mouth that opens and closes while the person speaks. */
  talkClassName?: string;
  /** Stands on a pill shadow (picture cards) or on the frame's edge (speakers on an answer line). */
  shadow?: boolean;
  /** Drawn first: long hair, a bun, a ponytail. */
  behind?: ReactNode;
  /** Over the shirt: collars, hoods, necklines. */
  clothes?: ReactNode;
  /** Over the head, under the face: hair, a cap, a beard. */
  hair?: ReactNode;
  /** Over everything: glasses, a moustache, a baby in the arms. */
  front?: ReactNode;
}

/** A head-and-shoulders portrait, layered back to front, with slots for what makes each person themselves. */
export function Bust({ frame, skin, shirt, shirtShade, mouth, blush, talkClassName, shadow = true, behind, clothes, hair, front }: BustProps) {
  const { head, body } = frame;
  const neckTop = head.cy + head.r * 0.6;
  return (
    <>
      {shadow && <GroundShadow cx={body.cx} y={body.bottom - 4} width={body.bottomHalfWidth * 2 + 8} />}
      {behind}
      <rect x={body.cx - 5} y={neckTop} width={10} height={body.top + 4 - neckTop} rx={4} fill={skin.shade} />
      <TwoTone
        d={torsoPath(body.cx, body.top, body.bottom, body.topHalfWidth, body.bottomHalfWidth)}
        fill={shirt}
        shade={shirtShade}
        offset={[body.bottomHalfWidth * 0.25, 0]}
      />
      {clothes}
      <Head {...head} skin={skin} />
      {hair}
      <Face {...head} skin={skin} mouth={mouth} blush={blush} talkClassName={talkClassName} />
      {front}
    </>
  );
}

interface BabyProps {
  /** Centre of the baby's head; the blanket hangs below it. */
  cx: number;
  cy: number;
  blanket: string;
  blanketShade: string;
}

/** A sleepy baby wrapped in a blanket, for a parent to hold. */
export function Baby({ cx, cy, blanket, blanketShade }: BabyProps) {
  return (
    <>
      <TwoTone
        d={roundedPolygon([[cx - 18, cy], [cx + 22, cy], [cx + 26, cy + 30], [cx - 22, cy + 30]], [14, 14, 6, 6])}
        fill={blanket}
        shade={blanketShade}
        offset={[6, 0]}
      />
      <circle cx={cx} cy={cy} r={11} fill={SKIN.light.base} />
      <path d={`M${cx - 1} ${cy - 11}Q${cx + 3} ${cy - 15} ${cx + 6} ${cy - 11}`} fill="none" stroke={ART.wood} strokeWidth={2.5} strokeLinecap="round" />
      <g fill="none" stroke={ART.eel} strokeWidth={1.8} strokeLinecap="round">
        <path d={`M${cx - 6} ${cy}Q${cx - 4} ${cy - 2.5} ${cx - 2} ${cy}M${cx + 2} ${cy}Q${cx + 4} ${cy - 2.5} ${cx + 6} ${cy}`} />
        <path d={`M${cx - 1.5} ${cy + 4.5}Q${cx} ${cy + 6} ${cx + 1.5} ${cy + 4.5}`} />
      </g>
      <g fill={ART.pig} fillOpacity={0.8}>
        <circle cx={cx - 6.5} cy={cy + 3.5} r={1.8} />
        <circle cx={cx + 6.5} cy={cy + 3.5} r={1.8} />
      </g>
    </>
  );
}
