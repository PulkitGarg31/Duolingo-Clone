/*
 * Confetti physics: plain functions over plain data, so they can be tested without a canvas.
 * Units are px, seconds and radians; y grows downwards, as on screen.
 */

export const CONFETTI_COLORS = ["#58CC02", "#1CB0F6", "#FFC800", "#FF4B4B", "#CE82FF", "#FF9600"] as const;

export type ConfettiShape = "rect" | "circle" | "streamer";

/** Width and height of each shape, in px. */
export const SHAPE_SIZE: Record<ConfettiShape, readonly [number, number]> = {
  rect: [8, 12],
  circle: [7, 7],
  streamer: [4, 16],
};

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  /** Phase of the 3D flip: the piece is drawn squashed vertically by cos(tilt). */
  tilt: number;
  tiltSpeed: number;
  /** Offsets the sideways sway, so pieces do not sway in step. */
  wobblePhase: number;
  shape: ConfettiShape;
  color: string;
  age: number;
  life: number;
}

/** Two cannons in the bottom corners of a viewport, or a radial burst from one point. */
export type Emitter = { kind: "cannons"; width: number; height: number } | { kind: "burst"; x: number; y: number };

/** A source of random numbers in [0, 1), like Math.random. */
type Random = () => number;

const GRAVITY = 1600;
const DRAG_PER_FRAME = 0.985;
const FADE_SECONDS = 0.4;
const PHONE_WIDTH = 700;
const RADIANS_PER_DEGREE = Math.PI / 180;

export function particleCount(viewportWidth: number): number {
  return viewportWidth < PHONE_WIDTH ? 70 : 120;
}

/** 60 % rounded rectangles, 25 % circles, 15 % streamers. */
export function pickShape(r: number): ConfettiShape {
  if (r < 0.6) return "rect";
  if (r < 0.85) return "circle";
  return "streamer";
}

/** Maps r in [0, 1) onto [min, max). */
function between(r: number, min: number, max: number): number {
  return min + r * (max - min);
}

export function createParticles(emitter: Emitter, count: number, random: Random): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const launch =
      emitter.kind === "cannons" ? cannonLaunch(emitter, index < count / 2, random) : burstLaunch(emitter, random);
    return {
      x: launch.x,
      y: launch.y,
      vx: launch.speed * Math.cos(launch.angle),
      vy: launch.speed * Math.sin(launch.angle),
      rotation: random() * 2 * Math.PI,
      spin: (random() < 0.5 ? -1 : 1) * between(random(), 180, 720) * RADIANS_PER_DEGREE,
      tilt: random() * 2 * Math.PI,
      tiltSpeed: between(random(), 4, 10),
      wobblePhase: random() * 2 * Math.PI,
      shape: pickShape(random()),
      color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
      age: 0,
      life: between(random(), 2.4, 3.2),
    };
  });
}

interface Launch {
  x: number;
  y: number;
  angle: number;
  speed: number;
}

/** Up and inwards from a bottom corner: -60° ± 15° on the left, -120° ± 15° on the right. */
function cannonLaunch(viewport: { width: number; height: number }, fromLeft: boolean, random: Random): Launch {
  const centre = fromLeft ? -60 : -120;
  return {
    x: fromLeft ? 0 : viewport.width,
    y: viewport.height,
    angle: (centre + between(random(), -15, 15)) * RADIANS_PER_DEGREE,
    speed: between(random(), 900, 1300),
  };
}

function burstLaunch(origin: { x: number; y: number }, random: Random): Launch {
  return { x: origin.x, y: origin.y, angle: random() * 2 * Math.PI, speed: between(random(), 400, 700) };
}

/** Advances a piece by `dt` seconds: gravity, then drag (scaled so any frame rate decays alike), then motion. */
export function step(particle: Particle, dt: number): Particle {
  const drag = DRAG_PER_FRAME ** (dt * 60);
  const vx = particle.vx * drag;
  const vy = (particle.vy + GRAVITY * dt) * drag;
  return {
    ...particle,
    x: particle.x + vx * dt,
    y: particle.y + vy * dt,
    vx,
    vy,
    rotation: particle.rotation + particle.spin * dt,
    tilt: particle.tilt + particle.tiltSpeed * dt,
    age: particle.age + dt,
  };
}

/** Fully opaque until the last 400 ms of its life, then fading to nothing. */
export function opacity(particle: Particle): number {
  const remaining = particle.life - particle.age;
  if (remaining <= 0) return 0;
  return Math.min(1, remaining / FADE_SECONDS);
}

export function isAlive(particle: Particle): boolean {
  return particle.age < particle.life;
}

/** Sideways sway added when drawing: sin(t · 10) · 12 px. */
export function wobbleOffset(particle: Particle): number {
  return Math.sin(particle.age * 10 + particle.wobblePhase) * 12;
}
