import { ART } from "@/components/illustrations/palette";

/*
 * The owl's parts, drawn on a master grid where the owl is 200 units tall and centred on x = 100: an egg body
 * (no ear tufts), a heart-shaped face disc, medium eyes, a rounded-diamond beak, one curly tuft and a scarf.
 */

/** Egg body: 150 wide, 170 tall, bottom at y = 190, widest a little below the middle. */
const BODY_PATH = "M100 20C141 20 175 66 175 118C175 160 142 190 100 190C58 190 25 160 25 118C25 66 59 20 100 20Z";

/** Barn-owl face disc: a heart 104 wide and 80 tall whose point tucks under the scarf. */
const FACE_PATH = "M100 54C93 44 82 40 72 40C58 40 48 50 48 64C48 88 74 106 100 120C126 106 152 88 152 64C152 50 142 40 128 40C118 40 107 44 100 54Z";

/** Wing paddle, 40 × 64, hanging from its shoulder at (0, 0). */
const WING_PATH = "M0 0C11 0 20 12 20 30C20 50 11 64 0 64C-11 64 -20 50 -20 30C-20 12 -11 0 0 0Z";

/** A wing reaching forward looks shorter (foreshortened), so it uses a smaller paddle, 30 × 52. */
const REACHING_WING_PATH = "M0 0C9 0 15 9 15 24C15 40 8 52 0 52C-8 52 -15 40 -15 24C-15 9 -9 0 0 0Z";

const SHOULDERS = { left: { x: 44, y: 108 }, right: { x: 156, y: 108 } } as const;
const REACHING_SHOULDERS = { left: { x: 38, y: 112 }, right: { x: 162, y: 112 } } as const;
const EYE_CENTRES = { left: { x: 76, y: 78 }, right: { x: 124, y: 78 } } as const;
const EYE_RADIUS = 15;
const PUPIL_RADIUS = 7;

type Side = "left" | "right";

/** The body in owl green, a darker crescent down its right side and one highlight on the crown of the head. */
export function OwlBody({ clipId }: { clipId: string }) {
  return (
    <>
      <clipPath id={clipId}>
        <path d={BODY_PATH} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <path d={BODY_PATH} fill={ART.owlShade} />
        <path d={BODY_PATH} fill={ART.owl} transform="translate(-28 -6)" />
      </g>
      <rect x={60} y={26} width={26} height={9} rx={4.5} fill={ART.white} fillOpacity={0.45} transform="rotate(-24 73 30.5)" />
    </>
  );
}

/** Belly patch with three speckles. */
export function OwlBelly() {
  return (
    <>
      <ellipse cx={100} cy={158} rx={35} ry={30} fill={ART.maskGreen} />
      <circle cx={90} cy={150} r={3} fill={ART.owl} />
      <circle cx={106} cy={157} r={3} fill={ART.owl} />
      <circle cx={95} cy={168} r={3} fill={ART.owl} />
    </>
  );
}

export function OwlFace() {
  return <path d={FACE_PATH} fill={ART.turtle} />;
}

/** One curl from the top of the head, with a shaded copy behind it. */
export function OwlTuft() {
  const curl = "M100 26C99 15 104 6 112 6C119 6 121 13 116 17";
  return (
    <g fill="none" strokeWidth={8} strokeLinecap="round">
      <path d={curl} stroke={ART.owlShade} transform="translate(2.5 2)" />
      <path d={curl} stroke={ART.owl} />
    </g>
  );
}

export type EyeState =
  /** `look` moves both pupils (units); `lids` lowers the eyelids from 0 (open) to 1 (shut). */
  | { kind: "open"; look?: readonly [number, number]; lids?: number }
  /** Shut in a happy arch: ^ ^. */
  | { kind: "happy" }
  /** Shut in a relaxed curve, asleep. */
  | { kind: "closed" }
  /** Left eye open, right eye shut happily. */
  | { kind: "wink" };

export function OwlEyes({ state }: { state: EyeState }) {
  switch (state.kind) {
    case "open":
      return (
        <>
          <OpenEye side="left" look={state.look} lids={state.lids} />
          <OpenEye side="right" look={state.look} lids={state.lids} />
        </>
      );
    case "happy":
      return (
        <>
          <ShutEye side="left" curve="happy" />
          <ShutEye side="right" curve="happy" />
        </>
      );
    case "closed":
      return (
        <>
          <ShutEye side="left" curve="asleep" />
          <ShutEye side="right" curve="asleep" />
        </>
      );
    case "wink":
      return (
        <>
          <OpenEye side="left" />
          <ShutEye side="right" curve="happy" />
        </>
      );
  }
}

function OpenEye({ side, look = [0, 0], lids = 0 }: { side: Side; look?: readonly [number, number]; lids?: number }) {
  const { x, y } = EYE_CENTRES[side];
  // Pupils sit 2 units towards the beak, which reads as a friendly, focused gaze.
  const pupilX = x + (side === "left" ? 2 : -2) + look[0];
  const pupilY = y + look[1];
  return (
    <>
      <circle cx={x} cy={y} r={EYE_RADIUS} fill={ART.white} />
      <circle cx={pupilX} cy={pupilY} r={PUPIL_RADIUS} fill={ART.eel} />
      <circle cx={pupilX - 2.5} cy={pupilY - 2.5} r={2} fill={ART.white} />
      {lids > 0 && <path d={lidPath(x, y, EYE_RADIUS, lids)} fill={ART.owl} />}
    </>
  );
}

/** A cap of body colour over the top of an eye, reaching `closed` (0 to 1) of the way down. */
function lidPath(cx: number, cy: number, r: number, closed: number): string {
  const edgeY = cy - r + 2 * r * closed;
  const halfWidth = Math.sqrt(Math.max(r * r - (edgeY - cy) ** 2, 0));
  const largeArc = closed > 0.5 ? 1 : 0;
  return `M${cx - halfWidth} ${edgeY}A${r} ${r} 0 ${largeArc} 1 ${cx + halfWidth} ${edgeY}Z`;
}

function ShutEye({ side, curve }: { side: Side; curve: "happy" | "asleep" }) {
  const { x, y } = EYE_CENTRES[side];
  const d =
    curve === "happy"
      ? `M${x - 11} ${y + 4}Q${x} ${y - 10} ${x + 11} ${y + 4}`
      : `M${x - 11} ${y - 1}Q${x} ${y + 10} ${x + 11} ${y - 1}`;
  return <path d={d} fill="none" stroke={ART.eel} strokeWidth={5} strokeLinecap="round" />;
}

export type BrowMood = "worried" | "curious" | "determined";

/** Brows only appear when an expression needs them. */
export function OwlBrows({ mood }: { mood: BrowMood }) {
  // Each pair is [outer end, inner end] of the left brow; the right brow mirrors it around x = 100.
  const left: Record<BrowMood, readonly [number, number, number, number]> = {
    worried: [64, 58, 80, 52],
    curious: [64, 54, 82, 52],
    determined: [64, 54, 82, 60],
  };
  const [x1, y1, x2, y2] = left[mood];
  // A curious face raises only the right brow higher.
  const rightLift = mood === "curious" ? -6 : 0;
  return (
    <g stroke={ART.owlShade} strokeWidth={4} strokeLinecap="round">
      <path d={`M${x1} ${y1}L${x2} ${y2}`} />
      <path d={`M${200 - x1} ${y1 + rightLift}L${200 - x2} ${y2 + rightLift}`} />
    </g>
  );
}

/**
 * Rounded-diamond beak in one orange with a lighter top half. Open, the top half lifts over a darker mouth
 * with a tongue.
 */
export function OwlBeak({ open }: { open: boolean }) {
  if (open) {
    return (
      <g strokeLinejoin="round">
        <path d="M89 97Q100 125 111 97Z" fill={ART.fox} stroke={ART.fox} strokeWidth={3} />
        <path d="M92 98Q100 116 108 98Z" fill={ART.foxShade} />
        <path d="M94.5 106Q100 101 105.5 106Q100 112 94.5 106Z" fill={ART.pig} />
        <path d="M100 87L111 97H89Z" fill={ART.lion} stroke={ART.lion} strokeWidth={4} />
      </g>
    );
  }
  return (
    <g strokeLinejoin="round" strokeWidth={4}>
      <path d="M100 92L109 100L100 108L91 100Z" fill={ART.fox} stroke={ART.fox} />
      <path d="M100 92L109 100H91Z" fill={ART.lion} stroke={ART.lion} />
    </g>
  );
}

export interface WingPose {
  /** Degrees from hanging straight down; positive swings the tip away from the body. */
  angle: number;
  /**
   * "behind": tucked behind the body (the default). "over": a full wing drawn over the body, e.g. raised to
   * hold something up. "reach": a shorter wing reaching forward to hold something in front of the belly.
   */
  place?: "behind" | "over" | "reach";
  /** Where the wing joins the body when it is not the usual shoulder, e.g. lower down for a wing at the chin. */
  joint?: readonly [number, number];
  /** Motion class, rotating the wing around its shoulder. */
  motionClass?: string;
}

/** Whether a wing is drawn after the body and held items, rather than before the body. */
export function isFrontWing(wing: WingPose): boolean {
  return wing.place === "over" || wing.place === "reach";
}

/**
 * A wing hanging from its shoulder. The right wing is the left one mirrored, so one angle describes both sides
 * and any rotation animation mirrors with it.
 */
export function OwlWing({ side, pose }: { side: Side; pose: WingPose }) {
  const reaching = pose.place === "reach";
  const shoulder = (reaching ? REACHING_SHOULDERS : SHOULDERS)[side];
  const [x, y] = pose.joint ?? [shoulder.x, shoulder.y];
  const mirror = side === "right" ? " scale(-1 1)" : "";
  return (
    <g transform={`translate(${x} ${y})${mirror}`}>
      <g className={pose.motionClass}>
        <path d={reaching ? REACHING_WING_PATH : WING_PATH} fill={ART.owlShade} transform={`rotate(${pose.angle})`} />
      </g>
    </g>
  );
}

/** "scarf": band, knot and tails. "band": the band alone, for the small head glyph. "collar": the cape's collar. */
export type Neckwear = "scarf" | "band" | "collar" | "none";

/**
 * The signature macaw scarf: a band hugging the body under the face, clipped to the body outline, and a knot
 * with two tails on the lit side. The caped hero wears a purple collar with a gold clasp instead.
 */
export function OwlNeck({ wear, clipId }: { wear: Neckwear; clipId: string }) {
  if (wear === "none") return null;
  const collar = wear === "collar";
  return (
    <>
      <g clipPath={`url(#${clipId})`}>
        {/* The band sags in the middle like fabric, with a darker rolled edge underneath. */}
        <path d="M16 96Q100 124 184 96V114Q100 142 16 114Z" fill={collar ? ART.beetle : ART.macaw} />
        <path d="M16 109Q100 137 184 109V114Q100 142 16 114Z" fill={collar ? ART.beetleShade : ART.whale} />
      </g>
      {collar && (
        <>
          <circle cx={100} cy={119} r={8.5} fill={ART.bee} />
          <circle cx={97.5} cy={116.5} r={2.5} fill={ART.white} fillOpacity={0.6} />
        </>
      )}
      {wear === "scarf" && (
        <g fill={ART.whale} stroke={ART.whale} strokeWidth={4} strokeLinejoin="round">
          {/* Two tails that widen towards their ends, then the knot over them. */}
          <path d="M-4 0H4L6 28H-6Z" transform="translate(64 121) rotate(34)" />
          <path d="M-4 0H4L6 32H-6Z" transform="translate(75 121) rotate(-10)" />
          <circle cx={70} cy={118} r={7} />
        </g>
      )}
    </>
  );
}

/** Two double-bump feet standing on the shadow. */
export function OwlFeet() {
  return (
    <g fill={ART.fox}>
      {[80, 120].map((x) => (
        <g key={x}>
          <rect x={x - 10} y={182} width={20} height={8} rx={3} />
          <circle cx={x - 6} cy={189} r={5.5} />
          <circle cx={x + 6} cy={189} r={5.5} />
        </g>
      ))}
    </g>
  );
}
