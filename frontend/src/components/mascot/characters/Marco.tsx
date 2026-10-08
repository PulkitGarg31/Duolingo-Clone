import { roundedPolygon } from "@/components/illustrations/geometry";
import { ART, HAIR, SKIN } from "@/components/illustrations/palette";
import { Highlight, TwoTone } from "@/components/illustrations/parts";
import { Bust } from "@/components/illustrations/people";
import styles from "../mascot.module.css";
import { CAST_FRAME, CastSvg, type CastMemberProps } from "./CastSvg";

const BEARD = HAIR.brown;

/** Marco: a brown beard, round glasses and a teal shirt. */
export function Marco({ size, talking = false, className, title }: CastMemberProps) {
  return (
    <CastSvg size={size} className={className} title={title}>
      <Bust
        frame={CAST_FRAME.adult}
        skin={SKIN.light}
        shirt={ART.peacock}
        shirtShade={ART.peacockShade}
        shadow={false}
        blush={false}
        talkClassName={talking ? styles.talk : undefined}
        clothes={
          <g fill={ART.white}>
            <path d={roundedPolygon([[39.5, 72], [50, 78], [42.5, 85]], 2)} />
            <path d={roundedPolygon([[60.5, 72], [50, 78], [57.5, 85]], 2)} />
          </g>
        }
        hair={
          <>
            <TwoTone
              d="M29 45C28 26 39 19 50 19C62 19 73 26 71 45C67 37 59 32 50 33C41 32 33 37 29 45Z"
              fill={BEARD.base}
              shade={BEARD.shade}
              offset={[6, 0]}
            />
            <Highlight x={37} y={22} width={10} height={5} rotate={-24} />
            {/* The beard frames the jaw and leaves the mouth clear. */}
            <path d="M29 47C29 64 38 72 50 72C62 72 71 64 71 47C67 56 60 59 50 59C40 59 33 56 29 47Z" fill={BEARD.base} />
          </>
        }
        front={
          <>
            <path d="M42 55Q50 49 58 55Q50 56.5 42 55Z" fill={BEARD.base} />
            <g fill="none" stroke={ART.eel} strokeWidth={2.2} strokeLinecap="round">
              <circle cx={42.4} cy={46.8} r={6.3} />
              <circle cx={57.6} cy={46.8} r={6.3} />
              <path d="M48.7 46Q50 44.6 51.3 46M36.1 46.2L30 45M63.9 46.2L70 45" />
            </g>
          </>
        }
      />
    </CastSvg>
  );
}
