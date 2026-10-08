import { ART, HAIR, SKIN } from "@/components/illustrations/palette";
import { Highlight } from "@/components/illustrations/parts";
import { Bust } from "@/components/illustrations/people";
import styles from "../mascot.module.css";
import { CAST_FRAME, CastSvg, type CastMemberProps } from "./CastSvg";

/** Curls behind the head as [cx, cy, r]: a big cloud of hair down to the shoulders. */
const BACK_CURLS = [
  [50, 40, 26],
  [27, 57, 10],
  [73, 57, 10],
  [25, 43, 11],
  [75, 43, 11],
  [31, 25, 12],
  [69, 25, 12],
  [50, 16, 13],
  [38, 18, 11],
  [62, 18, 11],
] as const;

/** Curls over the forehead. */
const FRINGE = [
  [36, 30, 8],
  [46, 26, 8.5],
  [57, 26, 8.5],
  [66, 31, 7.5],
] as const;

/** Lucía: dark curly hair and a yellow sweater. */
export function Lucia({ size, talking = false, className, title }: CastMemberProps) {
  return (
    <CastSvg size={size} className={className} title={title}>
      <Bust
        frame={CAST_FRAME.adult}
        skin={SKIN.tan}
        shirt={ART.bee}
        shirtShade={ART.camel}
        shadow={false}
        talkClassName={talking ? styles.talk : undefined}
        behind={
          <g fill={HAIR.dark.shade}>
            {BACK_CURLS.map(([cx, cy, r]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
            ))}
          </g>
        }
        clothes={<path d="M41 74.5Q50 83 59 74.5" fill="none" stroke={ART.lion} strokeWidth={4} strokeLinecap="round" />}
        hair={
          <>
            <g fill={HAIR.dark.base}>
              {FRINGE.map(([cx, cy, r]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
              ))}
            </g>
            <Highlight x={36} y={18} width={9} height={5} rotate={-30} />
          </>
        }
      />
    </CastSvg>
  );
}
