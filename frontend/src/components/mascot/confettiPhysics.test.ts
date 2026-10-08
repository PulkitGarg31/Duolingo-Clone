import { describe, expect, it } from "vitest";
import {
  CONFETTI_COLORS,
  createParticles,
  isAlive,
  opacity,
  particleCount,
  pickShape,
  step,
  wobbleOffset,
  type Particle,
} from "./confettiPhysics";

/** A random source that always answers the same value. */
const always = (value: number) => () => value;

function particle(overrides: Partial<Particle> = {}): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
    spin: 0,
    tilt: 0,
    tiltSpeed: 0,
    wobblePhase: 0,
    shape: "rect",
    color: CONFETTI_COLORS[0],
    age: 0,
    life: 3,
    ...overrides,
  };
}

describe("particleCount", () => {
  it("throws 120 pieces on desktop and 70 on phones", () => {
    expect(particleCount(1440)).toBe(120);
    expect(particleCount(700)).toBe(120);
    expect(particleCount(699)).toBe(70);
    expect(particleCount(375)).toBe(70);
  });
});

describe("pickShape", () => {
  it("mixes 60 % rounded rectangles, 25 % circles and 15 % streamers", () => {
    expect(pickShape(0)).toBe("rect");
    expect(pickShape(0.59)).toBe("rect");
    expect(pickShape(0.6)).toBe("circle");
    expect(pickShape(0.84)).toBe("circle");
    expect(pickShape(0.85)).toBe("streamer");
    expect(pickShape(0.99)).toBe("streamer");
  });
});

describe("createParticles", () => {
  it("fires half from each bottom corner, up and inwards at 60° from the horizontal", () => {
    const particles = createParticles({ kind: "cannons", width: 1000, height: 800 }, 4, always(0.5));
    expect(particles).toHaveLength(4);
    const [left, right] = [particles.slice(0, 2), particles.slice(2)];
    for (const p of left) {
      expect([p.x, p.y]).toEqual([0, 800]);
      // Middle of the cone (-60°) and of the speed range (1100 px/s).
      expect(p.vx).toBeCloseTo(1100 * Math.cos((-60 * Math.PI) / 180));
      expect(p.vy).toBeCloseTo(1100 * Math.sin((-60 * Math.PI) / 180));
    }
    for (const p of right) {
      expect([p.x, p.y]).toEqual([1000, 800]);
      expect(p.vx).toBeCloseTo(1100 * Math.cos((-120 * Math.PI) / 180));
      expect(p.vy).toBeCloseTo(1100 * Math.sin((-120 * Math.PI) / 180));
    }
  });

  it("spreads the cannon cones ±15° and the speed over 900–1300 px/s", () => {
    const [low] = createParticles({ kind: "cannons", width: 1000, height: 800 }, 2, always(0));
    expect(Math.hypot(low.vx, low.vy)).toBeCloseTo(900);
    expect((Math.atan2(low.vy, low.vx) * 180) / Math.PI).toBeCloseTo(-75);
  });

  it("bursts outwards in every direction at 400–700 px/s", () => {
    const [down] = createParticles({ kind: "burst", x: 300, y: 200 }, 1, always(0.25));
    expect([down.x, down.y]).toEqual([300, 200]);
    // A quarter turn points straight down; a quarter of the speed range is 475 px/s.
    expect(down.vx).toBeCloseTo(0);
    expect(down.vy).toBeCloseTo(475);
  });

  it("gives every piece a palette colour, a spin of 180–720 °/s and a life of 2.4–3.2 s", () => {
    for (const r of [0, 0.5, 0.999]) {
      for (const p of createParticles({ kind: "burst", x: 0, y: 0 }, 3, always(r))) {
        expect(CONFETTI_COLORS).toContain(p.color);
        const degreesPerSecond = (Math.abs(p.spin) * 180) / Math.PI;
        expect(degreesPerSecond).toBeGreaterThanOrEqual(180);
        expect(degreesPerSecond).toBeLessThanOrEqual(720);
        expect(p.life).toBeGreaterThanOrEqual(2.4);
        expect(p.life).toBeLessThanOrEqual(3.2);
        expect(p.age).toBe(0);
      }
    }
  });
});

describe("step", () => {
  it("pulls a piece down at 1600 px/s² and slows it by 1.5 % per 60 fps frame", () => {
    const next = step(particle(), 1 / 60);
    expect(next.vx).toBe(0);
    expect(next.vy).toBeCloseTo((1600 / 60) * 0.985);
    expect(next.y).toBeCloseTo(next.vy / 60);
  });

  it("applies the same drag whatever the frame rate", () => {
    const oneFrame = step(particle({ vx: 600 }), 1 / 60);
    const twoHalfFrames = step(step(particle({ vx: 600 }), 1 / 120), 1 / 120);
    expect(oneFrame.vx).toBeCloseTo(600 * 0.985);
    expect(twoHalfFrames.vx).toBeCloseTo(oneFrame.vx);
  });

  it("spins, flips and ages the piece", () => {
    const next = step(particle({ spin: 2, tiltSpeed: 6, age: 1 }), 0.5);
    expect(next.rotation).toBeCloseTo(1);
    expect(next.tilt).toBeCloseTo(3);
    expect(next.age).toBeCloseTo(1.5);
  });

  it("leaves the original piece untouched", () => {
    const before = particle({ vx: 10 });
    step(before, 0.1);
    expect(before).toEqual(particle({ vx: 10 }));
  });
});

describe("opacity and life", () => {
  it("stays opaque until the last 400 ms, then fades out", () => {
    expect(opacity(particle({ age: 0, life: 3 }))).toBe(1);
    expect(opacity(particle({ age: 2.6, life: 3 }))).toBeCloseTo(1);
    expect(opacity(particle({ age: 2.8, life: 3 }))).toBeCloseTo(0.5);
    expect(opacity(particle({ age: 3, life: 3 }))).toBe(0);
    expect(opacity(particle({ age: 4, life: 3 }))).toBe(0);
  });

  it("is alive until its life runs out", () => {
    expect(isAlive(particle({ age: 2.99, life: 3 }))).toBe(true);
    expect(isAlive(particle({ age: 3, life: 3 }))).toBe(false);
  });
});

describe("wobbleOffset", () => {
  it("sways a piece sideways by up to 12 px", () => {
    expect(wobbleOffset(particle({ age: 0 }))).toBeCloseTo(0);
    expect(wobbleOffset(particle({ age: Math.PI / 20 }))).toBeCloseTo(12);
    expect(wobbleOffset(particle({ age: 0, wobblePhase: -Math.PI / 2 }))).toBeCloseTo(-12);
  });
});
