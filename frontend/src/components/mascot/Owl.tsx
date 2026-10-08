"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/cn";
import styles from "./mascot.module.css";
import {
  OwlBeak,
  OwlBelly,
  OwlBody,
  OwlBrows,
  OwlEyes,
  OwlFace,
  OwlFeet,
  OwlNeck,
  OwlTuft,
  OwlWing,
  isFrontWing,
} from "./owl/parts";
import { POSES, type BodyMotion, type OwlPose } from "./owl/poses";
import { usePauseWhenOffscreen } from "./usePauseWhenOffscreen";

export { OWL_POSES, type OwlPose } from "./owl/poses";

export interface OwlProps {
  pose?: OwlPose;
  /** Width and height of the square box, in px. The owl stands on its bottom edge. */
  size?: number;
  /** Opens and closes the beak every 150 ms, for while speech plays. */
  talking?: boolean;
  className?: string;
  /** Accessible name. Without one the owl is decorative and hidden from assistive technology. */
  title?: string;
}

const BODY_MOTION: Record<BodyMotion, string | undefined> = {
  bob: styles.bob,
  jump: styles.jump,
  hop: styles.hop,
  droop: styles.droop,
  tilt: styles.tilt,
  still: undefined,
};

const SHADOW_MOTION: Record<BodyMotion, string | undefined> = {
  bob: styles.shadowBob,
  jump: styles.shadowJump,
  hop: styles.shadowHop,
  droop: undefined,
  tilt: undefined,
  still: undefined,
};

/**
 * The mascot: an original green owl (egg body, heart-shaped face disc, one curly tuft, a blue scarf) in one of
 * its poses. Each pose moves gently through CSS, which stops under reduced motion and pauses while the owl is
 * off-screen.
 */
export function Owl({ pose = "idle", size = 200, talking = false, className, title }: OwlProps) {
  const definition = POSES[pose];
  const { left, right } = definition.wings;
  const bodyClipId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  usePauseWhenOffscreen(svgRef);

  return (
    <svg
      ref={svgRef}
      viewBox="-20 -36 240 240"
      width={size}
      height={size}
      className={cn(styles.root, className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <rect
        x={40}
        y={189}
        width={120}
        height={10}
        rx={5}
        className={cn(styles.shadow, SHADOW_MOTION[definition.motion], "fill-[rgb(0_0_0/.08)] dark:fill-[rgb(0_0_0/.25)]")}
      />
      <g className={cn(styles.body, BODY_MOTION[definition.motion])}>
        {definition.back}
        {!isFrontWing(left) && <OwlWing side="left" pose={left} />}
        {!isFrontWing(right) && <OwlWing side="right" pose={right} />}
        {definition.tuft !== false && <OwlTuft />}
        <OwlBody clipId={bodyClipId} />
        <OwlBelly />
        <OwlFace />
        <g className={definition.blink ? styles.blink : undefined}>
          <OwlEyes state={definition.eyes} />
        </g>
        {definition.brows && <OwlBrows mood={definition.brows} />}
        {/* While talking the beak rests closed and an open copy flickers over it. */}
        <OwlBeak open={Boolean(definition.beakOpen) && !talking} />
        {talking && (
          <g className={styles.talk}>
            <OwlBeak open />
          </g>
        )}
        <OwlNeck wear={definition.neck ?? "scarf"} clipId={bodyClipId} />
        <OwlFeet />
        {definition.face}
        {definition.held}
        {isFrontWing(left) && <OwlWing side="left" pose={left} />}
        {isFrontWing(right) && <OwlWing side="right" pose={right} />}
        {definition.head}
      </g>
      {definition.around}
    </svg>
  );
}
