import { circlePath } from "@/components/illustrations/geometry";
import { ART } from "@/components/illustrations/palette";
import { TwoTone } from "@/components/illustrations/parts";
import styles from "../mascot.module.css";

/*
 * Things the owl holds, wears or thinks, in the same 200-unit grid as its parts (see parts.tsx). Theme-aware
 * pieces (bubbles, "z"s) use the UI tokens so they sit naturally on light and dark pages; everything else uses
 * fixed art colours.
 */

/** A rounded four-point sparkle of radius 10 around (0, 0). */
const SPARKLE_PATH = "M0 -10C1.6 -3.2 3.2 -1.6 10 0C3.2 1.6 1.6 3.2 0 10C-1.6 3.2 -3.2 1.6 -10 0C-3.2 -1.6 -1.6 -3.2 0 -10Z";

/** A thought bubble with three dots that light up in turn. */
export function ThoughtBubble() {
  return (
    <g className="fill-page stroke-line" strokeWidth={2}>
      <circle cx={149} cy={48} r={4} vectorEffect="non-scaling-stroke" />
      <circle cx={161} cy={35} r={6.5} vectorEffect="non-scaling-stroke" />
      <rect x={164} y={-8} width={52} height={32} rx={16} vectorEffect="non-scaling-stroke" />
      <g className="fill-fg-3" stroke="none">
        {[178, 190, 202].map((cx) => (
          <circle key={cx} cx={cx} cy={8} r={3.5} className={styles.thinkDot} />
        ))}
      </g>
    </g>
  );
}

/** Three "z"s, small to large, drifting up from a sleeping head. */
export function SleepZs() {
  const letters = [
    { x: 150, y: 46, size: 22 },
    { x: 168, y: 24, size: 30 },
    { x: 189, y: 0, size: 38 },
  ];
  return (
    <g className="fill-fg-3" fontWeight={900}>
      {letters.map(({ x, y, size }) => (
        <text key={size} x={x} y={y} fontSize={size} className={styles.sleepZ}>
          z
        </text>
      ))}
    </g>
  );
}

/** A chunky question mark with a darker lip, bobbing over a lost owl's head. */
export function QuestionMark() {
  return (
    <g fontSize={58} fontWeight={900} textAnchor="middle" className={styles.questionBob}>
      <text x={182} y={36} fill={ART.whale}>
        ?
      </text>
      <text x={180} y={33} fill={ART.macaw}>
        ?
      </text>
    </g>
  );
}

/** One tear under the left eye. */
export function Tear() {
  return (
    <path
      d="M63 94C66 99 69 102 69 106A6 6 0 0 1 57 106C57 102 60 99 63 94Z"
      fill={ART.blueJay}
      stroke={ART.blueJay}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

/** Gold sparkles around a legend, twinkling out of step. */
export function LegendSparkles() {
  const sparkles = [
    { x: 30, y: 34, scale: 1, color: ART.bee },
    { x: 172, y: 30, scale: 0.8, color: ART.bee },
    { x: 186, y: 84, scale: 0.6, color: ART.lion },
    { x: 14, y: 92, scale: 0.6, color: ART.lion },
  ];
  return (
    <>
      {sparkles.map(({ x, y, scale, color }, index) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${scale})`}>
          <path
            d={SPARKLE_PATH}
            fill={color}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            className={styles.twinkle}
            style={{ animationDelay: `${index * 0.4}s` }}
          />
        </g>
      ))}
    </>
  );
}

/** The thumb of a raised wing, giving a thumbs-up. */
export function ThumbUp() {
  return <rect x={162} y={30} width={12} height={22} rx={6} fill={ART.owlShade} transform="rotate(-14 168 41)" />;
}

/** A small gold crown perched on the head beside the tuft. */
export function Crown() {
  return (
    <g transform="translate(82 14) rotate(-14)">
      <path
        d="M-16 8L-15 -10L-6 -2L0 -14L6 -2L15 -10L16 8Z"
        fill={ART.bee}
        stroke={ART.bee}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <rect x={-17} y={4} width={34} height={9} rx={3} fill={ART.camel} />
      <g fill={ART.bee}>
        <circle cx={-15} cy={-10} r={3.5} />
        <circle cx={0} cy={-14} r={3.5} />
        <circle cx={15} cy={-10} r={3.5} />
      </g>
      <rect x={-12} y={-3} width={4} height={8} rx={2} fill={ART.white} fillOpacity={0.6} />
    </g>
  );
}

/** Confetti pieces hanging in the air around a celebrating owl. */
export function ConfettiBits() {
  const bits = [
    { x: 4, y: 56, rotate: 25, color: ART.macaw },
    { x: 194, y: 50, rotate: -30, color: ART.cardinal },
    { x: 176, y: 2, rotate: 45, color: ART.beetle },
    { x: 202, y: 116, rotate: 15, color: ART.owl },
  ];
  const dots = [
    { cx: 22, cy: 10, color: ART.bee },
    { cx: -6, cy: 118, color: ART.fox },
  ];
  return (
    <>
      {bits.map(({ x, y, rotate, color }) => (
        <rect key={`${x}-${y}`} x={x - 4} y={y - 6} width={8} height={12} rx={2.5} fill={color} transform={`rotate(${rotate} ${x} ${y})`} />
      ))}
      {dots.map(({ cx, cy, color }) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4.5} fill={color} />
      ))}
    </>
  );
}

/** A yellow hard hat over the top of the head (the tuft hides underneath). */
export function HardHat() {
  return (
    <>
      <TwoTone d="M46 46C46 18 70 4 100 4C130 4 154 18 154 46Z" fill={ART.bee} shade={ART.lion} offset={[14, 0]} />
      <rect x={93} y={4} width={14} height={40} rx={6} fill={ART.lion} />
      <rect x={36} y={40} width={128} height={11} rx={5.5} fill={ART.camel} />
      <rect x={60} y={18} width={20} height={8} rx={4} fill={ART.white} fillOpacity={0.45} transform="rotate(-28 70 22)" />
    </>
  );
}

/** A grey wrench in the raised wing, tapping: it rocks around the grip, which sits at the group's origin. */
export function Wrench() {
  return (
    <g transform="translate(186 56)">
      <g className={styles.wrenchTap}>
        <g transform="rotate(-16)" fill={ART.hare}>
          <rect x={-4.5} y={-46} width={9} height={52} rx={4.5} />
          <rect x={-13} y={-58} width={9} height={18} rx={4.5} />
          <rect x={4} y={-58} width={9} height={18} rx={4.5} />
          <rect x={-13} y={-50} width={26} height={12} rx={6} />
        </g>
      </g>
    </g>
  );
}

/** A purple cape streaming out behind the body, fluttering from the shoulders. */
export function Cape() {
  return (
    <g className={styles.capeFlutter}>
      <TwoTone
        d="M52 94C30 110 16 138 9 170Q7 180 17 178Q44 172 70 182Q104 170 136 180Q174 168 205 133Q211 125 202 122C188 115 174 102 150 92Q100 80 52 94Z"
        fill={ART.beetle}
        shade={ART.beetleShade}
        offset={[18, 0]}
      />
    </g>
  );
}

/** An open book held in front of the belly. */
export function Book() {
  return (
    <>
      <TwoTone d="M58 140Q58 132 66 132H134Q142 132 142 140V176Q142 184 134 184H66Q58 184 58 176Z" fill={ART.macaw} shade={ART.whale} />
      <path d="M64 138Q82 133 99 140V178Q82 172 64 176Z" fill={ART.white} stroke={ART.white} strokeWidth={2} strokeLinejoin="round" />
      <path d="M136 138Q118 133 101 140V178Q118 172 136 176Z" fill={ART.iguana} stroke={ART.iguana} strokeWidth={2} strokeLinejoin="round" />
      <g stroke={ART.anchovy} strokeWidth={3} strokeLinecap="round">
        <path d="M72 148Q82 145 91 149M72 157Q82 154 91 158" fill="none" />
        <path d="M109 149Q118 145 128 148M109 158Q118 154 128 157" fill="none" />
      </g>
    </>
  );
}

/** A red mug of coffee with two wisps of steam. */
export function Mug() {
  return (
    <>
      <g fill="none" stroke={ART.hare} strokeWidth={4} strokeLinecap="round">
        <path d="M90 132C86 127 94 123 90 117" />
        <path d="M102 133C98 128 106 124 102 118" />
      </g>
      <circle cx={114} cy={152} r={9} fill="none" stroke={ART.fireAnt} strokeWidth={6} />
      <TwoTone d="M80 142Q80 136 86 136H106Q112 136 112 142V164Q112 170 106 170H86Q80 170 80 164Z" fill={ART.cardinal} shade={ART.fireAnt} />
      <rect x={85} y={141} width={6} height={14} rx={3} fill={ART.white} fillOpacity={0.45} />
    </>
  );
}

/** A Spanish flag on a pole, raised high. */
export function FlagOnPole() {
  return (
    <>
      <rect x={10} y={-12} width={6} height={130} rx={3} fill={ART.wood} />
      <circle cx={13} cy={-14} r={5} fill={ART.bee} />
      <rect x={16} y={-8} width={44} height={30} rx={5} fill={ART.cardinal} />
      <rect x={16} y={-0.5} width={44} height={15} fill={ART.bee} />
    </>
  );
}

/** A folded map held upside down: the north arrow points at the ground. */
export function UpsideDownMap() {
  return (
    <>
      <rect x={50} y={124} width={34} height={54} rx={4} fill={ART.iguana} />
      <rect x={83} y={124} width={34} height={54} fill={ART.anchovy} />
      <rect x={116} y={124} width={34} height={54} rx={4} fill={ART.iguana} />
      <path d="M88 150C96 140 116 142 122 152C127 162 110 170 102 166C93 163 84 158 88 150Z" fill={ART.turtle} />
      <path d="M100 129V143M100 143L94 137M100 143L106 137" fill="none" stroke={ART.eel} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 168C82 168 84 156 98 158C110 160 114 170 126 166" fill="none" stroke={ART.cardinal} strokeWidth={4} strokeLinecap="round" strokeDasharray="1 8" />
      <path d="M126 134L135 143M135 134L126 143" stroke={ART.cardinal} strokeWidth={4.5} strokeLinecap="round" />
    </>
  );
}

/** A purple stopwatch whose hand ticks round. */
export function Stopwatch() {
  return (
    <>
      <rect x={94} y={122} width={12} height={10} rx={3} fill={ART.beetleShade} />
      <rect x={90} y={118} width={20} height={7} rx={3.5} fill={ART.beetle} />
      <TwoTone d={circlePath(100, 154, 24)} fill={ART.beetle} shade={ART.beetleShade} offset={[5, 4]} />
      <circle cx={100} cy={154} r={17} fill={ART.white} />
      <g transform="translate(100 154)">
        <g className={styles.stopwatchHand}>
          <path d="M0 0V-12" stroke={ART.eel} strokeWidth={4} strokeLinecap="round" />
        </g>
      </g>
      <circle cx={100} cy={154} r={3} fill={ART.eel} />
    </>
  );
}
