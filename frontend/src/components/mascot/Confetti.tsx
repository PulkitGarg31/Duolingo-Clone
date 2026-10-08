"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  CONFETTI_COLORS,
  SHAPE_SIZE,
  createParticles,
  isAlive,
  opacity,
  particleCount,
  step,
  wobbleOffset,
  type Emitter,
  type Particle,
} from "./confettiPhysics";

interface ConfettiProps {
  /** "cannons": two cones from the bottom corners of the screen. "burst": outwards from `origin`. */
  variant?: "cannons" | "burst";
  /** Element the burst and the reduced-motion sparkle start from (the mascot); the screen centre if absent. */
  origin?: RefObject<Element | null>;
  /** Number of bursts, 450 ms apart: a perfect lesson gets two. */
  bursts?: number;
  /** Called once the last piece has faded. */
  onDone?: () => void;
}

const BURST_GAP_MS = 450;
const SPARKLE_MS = 600;
/** Longest step simulated at once, so a stalled tab does not make the pieces jump. */
const MAX_STEP_SECONDS = 1 / 20;

/**
 * A one-shot confetti celebration on a full-screen canvas that never takes clicks. It fires when mounted;
 * remount it (a new `key`) to fire again. With reduced motion it shows a still sparkle for 600 ms instead.
 */
export function Confetti({ variant = "cannons", origin, bursts = 1, onDone }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The latest callback, read when the show ends, so a new function identity never restarts it.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.scale(pixelRatio, pixelRatio);
    const target = originArea(origin?.current ?? null, width, height);
    const timers: number[] = [];

    if (document.documentElement.dataset.motion === "reduced") {
      drawSparkle(context, target);
      timers.push(
        window.setTimeout(() => {
          context.clearRect(0, 0, width, height);
          onDoneRef.current?.();
        }, SPARKLE_MS),
      );
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    const emitter: Emitter = variant === "cannons" ? { kind: "cannons", width, height } : { kind: "burst", x: target.x, y: target.y };
    let particles: Particle[] = [];
    let burstsLeft = bursts;
    const emit = () => {
      particles = particles.concat(createParticles(emitter, particleCount(width), Math.random));
      burstsLeft -= 1;
    };
    emit();
    for (let index = 1; index < bursts; index += 1) timers.push(window.setTimeout(emit, index * BURST_GAP_MS));

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_STEP_SECONDS);
      last = now;
      particles = particles.map((particle) => step(particle, dt)).filter(isAlive);
      context.clearRect(0, 0, width, height);
      particles.forEach((particle) => drawParticle(context, particle));
      if (particles.length > 0 || burstsLeft > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        onDoneRef.current?.();
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [variant, origin, bursts]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[var(--z-confetti)] h-full w-full"
    />
  );
}

interface Area {
  x: number;
  y: number;
  /** Half the size of the celebrated element, so the sparkle can ring it without covering it. */
  radius: number;
}

function originArea(element: Element | null, width: number, height: number): Area {
  if (!element) return { x: width / 2, y: height / 2, radius: 70 };
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2, radius: Math.max(box.width, box.height) / 2 };
}

function drawParticle(context: CanvasRenderingContext2D, particle: Particle): void {
  const [w, h] = SHAPE_SIZE[particle.shape];
  context.save();
  context.globalAlpha = opacity(particle);
  context.translate(particle.x + wobbleOffset(particle), particle.y);
  context.rotate(particle.rotation);
  // Squashing one axis as the piece turns reads as it flipping over in 3D.
  context.scale(1, Math.cos(particle.tilt));
  context.fillStyle = particle.color;
  context.beginPath();
  if (particle.shape === "circle") {
    context.arc(0, 0, w / 2, 0, 2 * Math.PI);
  } else {
    context.roundRect(-w / 2, -h / 2, w, h, 2);
  }
  context.fill();
  context.restore();
}

/** The reduced-motion stand-in: eight still rays in the confetti colours, ringing the celebrated element. */
function drawSparkle(context: CanvasRenderingContext2D, { x, y, radius }: Area): void {
  context.lineCap = "round";
  context.lineWidth = 6;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4;
    context.strokeStyle = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    context.beginPath();
    context.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    context.lineTo(x + Math.cos(angle) * (radius + 22), y + Math.sin(angle) * (radius + 22));
    context.stroke();
  }
}
