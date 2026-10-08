import type { ReactNode } from "react";
import styles from "../mascot.module.css";
import {
  Book,
  Cape,
  ConfettiBits,
  Crown,
  FlagOnPole,
  HardHat,
  LegendSparkles,
  Mug,
  QuestionMark,
  SleepZs,
  Stopwatch,
  Tear,
  ThoughtBubble,
  ThumbUp,
  UpsideDownMap,
  Wrench,
} from "./accessories";
import type { BrowMood, EyeState, Neckwear, WingPose } from "./parts";

export const OWL_POSES = [
  "idle",
  "celebrate",
  "sad",
  "think",
  "sleep",
  "cheer",
  "wave",
  "lost",
  "build",
  "cape",
  "read",
  "coffee",
  "flag",
  "legend",
  "stopwatch",
] as const;

export type OwlPose = (typeof OWL_POSES)[number];

/** Whole-body motion; "still" leaves the movement to the pose's details (a waving wing, ticking hand...). */
export type BodyMotion = "bob" | "jump" | "hop" | "droop" | "tilt" | "still";

interface PoseDefinition {
  eyes: EyeState;
  /** Blinks every few seconds. Only for open eyes. */
  blink?: boolean;
  brows?: BrowMood;
  beakOpen?: boolean;
  wings: { left: WingPose; right: WingPose };
  motion: BodyMotion;
  /** Defaults to the scarf. */
  neck?: Neckwear;
  /** Defaults to true; a hat hides it. */
  tuft?: boolean;
  /** Behind the body. */
  back?: ReactNode;
  /** Over the body and under the front wings: things the owl holds. */
  held?: ReactNode;
  /** On the face. */
  face?: ReactNode;
  /** On the head. */
  head?: ReactNode;
  /** Floating near the owl. It stays put while the body moves. */
  around?: ReactNode;
}

const AT_SIDES: WingPose = { angle: 26 };
const DROOPING: WingPose = { angle: 6 };
const ON_HIPS: WingPose = { angle: 44 };
const RAISED_FLAPPING: WingPose = { angle: 150, motionClass: styles.flap };
const WAVING: WingPose = { angle: 145, motionClass: styles.wave };
const HOLDING_LOW: WingPose = { angle: -40, place: "reach" };
const RAISED_HOLDING: WingPose = { angle: 150, place: "over" };

/** Every pose is the same parts in a different arrangement. */
export const POSES: Record<OwlPose, PoseDefinition> = {
  idle: {
    eyes: { kind: "open" },
    blink: true,
    wings: { left: AT_SIDES, right: AT_SIDES },
    motion: "bob",
  },
  celebrate: {
    eyes: { kind: "happy" },
    beakOpen: true,
    wings: { left: RAISED_FLAPPING, right: RAISED_FLAPPING },
    motion: "jump",
    around: <ConfettiBits />,
  },
  sad: {
    eyes: { kind: "open", look: [0, 3], lids: 0.45 },
    brows: "worried",
    wings: { left: DROOPING, right: DROOPING },
    motion: "droop",
    face: <Tear />,
  },
  think: {
    eyes: { kind: "open", look: [4, -4] },
    blink: true,
    brows: "curious",
    wings: { left: { angle: -124, place: "reach", joint: [44, 144] }, right: AT_SIDES },
    motion: "still",
    around: <ThoughtBubble />,
  },
  sleep: {
    eyes: { kind: "closed" },
    wings: { left: AT_SIDES, right: AT_SIDES },
    motion: "tilt",
    around: <SleepZs />,
  },
  cheer: {
    eyes: { kind: "wink" },
    beakOpen: true,
    wings: { left: AT_SIDES, right: { angle: 160, place: "over" } },
    motion: "hop",
    held: <ThumbUp />,
  },
  wave: {
    eyes: { kind: "open" },
    blink: true,
    beakOpen: true,
    wings: { left: AT_SIDES, right: WAVING },
    motion: "still",
  },
  lost: {
    eyes: { kind: "open", look: [0, -4] },
    blink: true,
    brows: "curious",
    wings: { left: { angle: -30, place: "reach" }, right: { angle: -30, place: "reach" } },
    motion: "still",
    held: <UpsideDownMap />,
    around: <QuestionMark />,
  },
  build: {
    eyes: { kind: "open" },
    blink: true,
    wings: { left: AT_SIDES, right: RAISED_HOLDING },
    motion: "still",
    tuft: false,
    head: <HardHat />,
    held: <Wrench />,
  },
  cape: {
    eyes: { kind: "open" },
    blink: true,
    brows: "determined",
    wings: { left: ON_HIPS, right: ON_HIPS },
    motion: "still",
    neck: "collar",
    back: <Cape />,
  },
  read: {
    eyes: { kind: "open", look: [0, 4] },
    blink: true,
    wings: { left: HOLDING_LOW, right: HOLDING_LOW },
    motion: "bob",
    held: <Book />,
  },
  coffee: {
    eyes: { kind: "open" },
    blink: true,
    wings: { left: { angle: -46, place: "reach" }, right: AT_SIDES },
    motion: "bob",
    held: <Mug />,
  },
  flag: {
    eyes: { kind: "open" },
    blink: true,
    beakOpen: true,
    wings: { left: RAISED_HOLDING, right: AT_SIDES },
    motion: "bob",
    back: <FlagOnPole />,
  },
  legend: {
    eyes: { kind: "happy" },
    wings: { left: AT_SIDES, right: AT_SIDES },
    motion: "still",
    head: <Crown />,
    around: <LegendSparkles />,
  },
  stopwatch: {
    eyes: { kind: "open", look: [0, 3] },
    blink: true,
    wings: { left: HOLDING_LOW, right: HOLDING_LOW },
    motion: "still",
    held: <Stopwatch />,
  },
};
