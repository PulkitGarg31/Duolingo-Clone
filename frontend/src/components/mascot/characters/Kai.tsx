import { roundedPolygon } from "@/components/illustrations/geometry";
import { ART, HAIR, SKIN } from "@/components/illustrations/palette";
import { Highlight, TwoTone } from "@/components/illustrations/parts";
import { Bust } from "@/components/illustrations/people";
import styles from "../mascot.module.css";
import { CAST_FRAME, CastSvg, type CastMemberProps } from "./CastSvg";

/** Kai: a child in an orange cap, worn sideways, and a blue shirt. */
export function Kai({ size, talking = false, className, title }: CastMemberProps) {
  return (
    <CastSvg size={size} className={className} title={title}>
      <Bust
        frame={CAST_FRAME.child}
        skin={SKIN.brown}
        shirt={ART.macaw}
        shirtShade={ART.whale}
        shadow={false}
        talkClassName={talking ? styles.talk : undefined}
        hair={
          <>
            <g fill={HAIR.dark.base}>
              <rect x={27.5} y={42} width={6} height={10} rx={3} />
              <rect x={66.5} y={42} width={6} height={10} rx={3} />
            </g>
            <TwoTone d="M27 49C27 24 73 24 73 49Q50 42 27 49Z" fill={ART.fox} shade={ART.foxShade} offset={[8, 0]} />
            <path d={roundedPolygon([[56, 43], [88, 41], [87, 49], [57, 50]], 3.5)} fill={ART.foxShade} />
            <circle cx={50} cy={28.5} r={3} fill={ART.foxShade} />
            <Highlight x={35} y={32} width={10} height={5} rotate={-30} />
          </>
        }
      />
    </CastSvg>
  );
}
