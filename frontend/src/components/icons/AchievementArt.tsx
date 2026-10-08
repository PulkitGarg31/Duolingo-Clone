import { useId, type ComponentType } from "react";
import type { AchievementCode } from "@/lib/api/types";
import { arcPath, roundedPolygon, shieldPath, starPoints } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, GREY } from "./palette";
import { Sparkle } from "./parts";
import { BOLT, BOLT_LEFT_HALF, FLAME, FLAME_CORE, FLAME_HIGHLIGHT } from "./shapes";

/** The seven achievements the API returns, plus the two shown as "Coming soon" (drawn in greys only). */
export type AchievementArtCode = AchievementCode | "friendly" | "photogenic";

/**
 * Picks a shape's colour: its own, or a grey while the badge is not earned. Main shapes turn koala; details
 * pass the tile's own grey, so on the grey tile they read as cut-outs.
 */
type Tone = (colour: string, muted?: string) => string;

const STROKE = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Wildfire: a flame throwing sparks. */
function Wildfire({ tone }: { tone: Tone }) {
  return (
    <>
      <g transform="translate(20 21) scale(1.15) translate(-16 -16)">
        <path d={FLAME} fill={tone(ART.cardinal)} />
        <path d={FLAME_CORE} fill={tone(ART.bee, GREY.base)} />
        <path
          d={FLAME_HIGHLIGHT}
          {...STROKE}
          stroke={tone(ART.white, GREY.base)}
          strokeOpacity={0.6}
          strokeWidth={2.2}
        />
      </g>
      <Sparkle cx={6.8} cy={11.4} r={3.2} color={tone(ART.bee)} />
      <Sparkle cx={33.6} cy={8.6} r={2.4} color={tone(ART.white)} />
      <Sparkle cx={34.4} cy={21.4} r={1.8} color={tone(ART.bee)} />
    </>
  );
}

/** Sage: a glowing orb holding the XP bolt. */
function Sage({ tone }: { tone: Tone }) {
  const clip = useId();
  return (
    <>
      <circle cx={20} cy={20} r={17.5} fill={tone(ART.white, GREY.base)} fillOpacity={0.2} />
      <circle cx={20} cy={20} r={13.5} fill={tone(ART.blueJay)} />
      <circle cx={19.3} cy={19.3} r={12.5} fill={tone(ART.iguana)} />
      <defs>
        <clipPath id={clip}>
          <path d={BOLT_LEFT_HALF} />
        </clipPath>
      </defs>
      <g transform="translate(20 20.6) scale(0.62) translate(-16 -16)">
        <path d={BOLT} fill={tone(ART.camel, GREY.base)} />
        <path d={BOLT} fill={tone(ART.bee, GREY.base)} clipPath={`url(#${clip})`} />
      </g>
      <path d={arcPath(19.3, 19.3, 10, 200, 245)} {...STROKE} stroke={tone(ART.white, GREY.base)} strokeWidth={2} />
    </>
  );
}

const BOOKS = [
  { y: 26, x: 5, width: 30, cover: ART.cardinal, band: ART.fireAnt, pagesLeft: false },
  { y: 18.2, x: 7.5, width: 26, cover: ART.macaw, band: ART.whale, pagesLeft: true },
  { y: 10.4, x: 9, width: 22, cover: ART.owl, band: ART.treeFrog, pagesLeft: false },
] as const;

/** Scholar: a stack of three books, their page edges alternating sides. */
function Scholar({ tone }: { tone: Tone }) {
  return (
    <>
      {BOOKS.map(({ y, x, width, cover, band, pagesLeft }) => (
        <g key={y}>
          <rect x={x} y={y} width={width} height={8} rx={2} fill={tone(cover)} />
          <rect x={pagesLeft ? x + width - 6.4 : x + 4} y={y} width={2.4} height={8} fill={tone(band)} />
          <rect
            x={pagesLeft ? x + 1.6 : x + width - 7.2}
            y={y + 1.6}
            width={5.6}
            height={4.8}
            rx={1}
            fill={tone(ART.white, GREY.base)}
          />
        </g>
      ))}
    </>
  );
}

/** Sharpshooter: a target with an arrow in its bullseye. */
function Sharpshooter({ tone }: { tone: Tone }) {
  return (
    <>
      <circle cx={17} cy={23} r={12.5} fill={tone(ART.white, GREY.base)} />
      <circle cx={17} cy={23} r={9.4} fill={tone(ART.fireAnt)} />
      <circle cx={17} cy={23} r={6.2} fill={tone(ART.white, GREY.base)} />
      <circle cx={17} cy={23} r={3} fill={tone(ART.fireAnt)} />
      <path d="M17.6 22.4 31.6 8.4" {...STROKE} stroke={tone(ART.wood)} strokeWidth={2.6} />
      {/* two pairs of fletching feathers at the tail */}
      <path
        d="M30.6 5.6 31.6 8.4 34.4 9.4M28.6 7.6 29.6 10.4 32.4 11.4"
        {...STROKE}
        stroke={tone(ART.bee)}
        strokeWidth={2.2}
      />
    </>
  );
}

const CHAMPION_SHIELD = shieldPath(7, 3.5, 26, 33, 4.5);
const CHAMPION_STAR = roundedPolygon(starPoints(20, 19, 8.4, 4), [1.6, 0.8]);

/** Champion: a gold shield with a star. */
function Champion({ tone }: { tone: Tone }) {
  const clip = useId();
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={CHAMPION_SHIELD} />
        </clipPath>
      </defs>
      <path d={CHAMPION_SHIELD} fill={tone(ART.camel)} />
      <rect width={40} height={20} fill={tone(ART.bee)} clipPath={`url(#${clip})`} />
      <path d={CHAMPION_STAR} fill={tone(ART.white, GREY.base)} />
    </>
  );
}

const CUP = "M12 7H28V16C28 21.5 24.4 25.4 20 25.4C15.6 25.4 12 21.5 12 16Z";
// The cup's right side in shade: a crescent from the rim down to the bottom of the bowl.
const CUP_SHADE = "M23.6 7H28V16C28 20.8 25.3 24.4 21.6 25.2C23.1 22.6 23.6 19.6 23.6 16Z";
const LEFT_HANDLE = "M12.4 11H9.6C8.6 11 7.8 11.8 7.8 12.8C7.8 16.4 10.2 18.8 13.4 19.2";
const RIGHT_HANDLE = "M27.6 11H30.4C31.4 11 32.2 11.8 32.2 12.8C32.2 16.4 29.8 18.8 26.6 19.2";

/** Winner: a white cup with "1" on it. */
function Winner({ tone }: { tone: Tone }) {
  const white = tone(ART.white);
  const shadeColour = tone(ART.swan, GREY.lip);
  return (
    <>
      <path d={LEFT_HANDLE} {...STROKE} stroke={white} strokeWidth={2.6} />
      <path d={RIGHT_HANDLE} {...STROKE} stroke={shadeColour} strokeWidth={2.6} />
      <rect x={18} y={24.6} width={4} height={4.8} fill={white} />
      <rect x={20} y={24.6} width={2} height={4.8} fill={shadeColour} />
      <rect x={13} y={29} width={14} height={5} rx={1.8} fill={white} />
      <path d="M13 31.6H27V32.2A1.8 1.8 0 0 1 25.2 34H14.8A1.8 1.8 0 0 1 13 32.2Z" fill={shadeColour} />
      <path d={CUP} fill={white} />
      <path d={CUP_SHADE} fill={shadeColour} />
      <text x={19} y={20.4} textAnchor="middle" fontSize={11} fontWeight={900} fill={tone(ART.guineaPig, GREY.base)}>
        1
      </text>
    </>
  );
}

const LEGEND_CROWN = roundedPolygon(
  [
    [6, 15],
    [13, 21],
    [20, 9.5],
    [27, 21],
    [34, 15],
    [31.6, 31],
    [8.4, 31],
  ],
  [2, 1.6, 2, 1.6, 2, 2, 2],
);
const LEGEND_TIPS = [6, 20, 34].map((x) => [x, x === 20 ? 8 : 13.6] as const);

/** A diamond facet whose corners are softened by a stroke in its own colour. */
const facet = (colour: string) =>
  ({ fill: colour, stroke: colour, strokeWidth: 1.6, strokeLinejoin: "round" }) as const;

/** Legendary: a gold crown set with a diamond. */
function Legendary({ tone }: { tone: Tone }) {
  return (
    <>
      <path d={LEGEND_CROWN} fill={tone(ART.bee)} />
      {LEGEND_TIPS.map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r={2.4} fill={tone(ART.bee)} />
      ))}
      <rect x={8.2} y={26.4} width={23.6} height={5.4} rx={2} fill={tone(ART.camel, GREY.lip)} />
      <path d="M20 15.6 25.4 21 20 26.4 14.6 21Z" {...facet(tone(ART.blueJay, GREY.base))} />
      <path d="M20 15.6 14.6 21 20 26.4Z" {...facet(tone(ART.iguana, GREY.base))} />
      <Sparkle cx={31.6} cy={6.6} r={2.6} color={tone(ART.white, GREY.base)} />
      <Sparkle cx={8.2} cy={6.4} r={1.8} color={tone(ART.white, GREY.base)} />
    </>
  );
}

/** A raised hand: palm, four fingers and a thumb. */
function HandShapes({ fill, outline }: { fill: string; outline?: string }) {
  return (
    <g fill={fill} stroke={outline} strokeWidth={outline ? 3 : undefined} strokeLinejoin="round">
      <rect x={8.4} y={16.6} width={11.6} height={11.4} rx={3.6} />
      <rect x={8.6} y={11.6} width={2.4} height={8} rx={1.2} />
      <rect x={11.6} y={9.8} width={2.4} height={9} rx={1.2} />
      <rect x={14.6} y={9.6} width={2.4} height={9} rx={1.2} />
      <rect x={17.6} y={11} width={2.4} height={8} rx={1.2} />
      <rect x={4.4} y={18.6} width={7} height={2.8} rx={1.4} transform="rotate(-38 9.4 20)" />
    </g>
  );
}

/** One hand of the high five, leaning in. The front hand gets an outline in the tile colour so the two separate. */
function Hand({ front = false }: { front?: boolean }) {
  return (
    <g transform="rotate(10 13 31)">
      {front ? <HandShapes fill={GREY.base} outline={GREY.base} /> : null}
      <HandShapes fill={GREY.mid} />
      <rect x={9} y={27} width={10.4} height={5} rx={1.6} fill={GREY.lip} />
    </g>
  );
}

/** Friendly (Coming soon): two hands meeting in a high five. */
function Friendly() {
  return (
    <>
      <Hand />
      <g transform="translate(40 0) scale(-1 1)">
        <Hand front />
      </g>
      <path d="M20 2.8V6.2M13.6 4.8 15.4 7.6M26.4 4.8 24.6 7.6" {...STROKE} stroke={GREY.mid} strokeWidth={2.2} />
    </>
  );
}

/** Photogenic (Coming soon): a camera. */
function Photogenic() {
  return (
    <>
      <rect x={13.5} y={9} width={10} height={6} rx={2} fill={GREY.mid} />
      <rect x={6} y={13} width={28} height={19} rx={4.5} fill={GREY.mid} />
      <circle cx={20} cy={22.5} r={6.8} fill={GREY.base} />
      <circle cx={20} cy={22.5} r={4.6} fill={GREY.mid} />
      <circle cx={18.6} cy={21.1} r={1.5} fill={GREY.base} />
      <rect x={27} y={16.4} width={4} height={2.4} rx={1.2} fill={GREY.base} />
    </>
  );
}

const DRAWINGS: Record<AchievementArtCode, ComponentType<{ tone: Tone }>> = {
  wildfire: Wildfire,
  sage: Sage,
  scholar: Scholar,
  sharpshooter: Sharpshooter,
  champion: Champion,
  winner: Winner,
  legendary: Legendary,
  friendly: Friendly,
  photogenic: Photogenic,
};

/**
 * The illustration on an achievement badge (40-unit artboard). `muted` draws it in the theme's greys for a
 * badge that is not earned yet; Friendly and Photogenic are always grey.
 */
export function AchievementArt({
  code,
  muted = false,
  ...props
}: IconProps & { code: AchievementArtCode; muted?: boolean }) {
  const Drawing = DRAWINGS[code];
  const tone: Tone = (colour, mutedColour = GREY.mid) => (muted ? mutedColour : colour);
  return (
    <SvgIcon box={[40, 40]} {...props}>
      <Drawing tone={tone} />
    </SvgIcon>
  );
}
