/*
 * Sound effects, synthesized with WebAudio: no audio files. One AudioContext is created lazily (browsers only
 * let it start inside a user gesture), every effect goes through a master gain of 0.5, nothing plays while
 * the tab is hidden, and Settings → Sound effects mutes them all. Speech is separate (lib/tts.ts).
 */

export type SoundName =
  | "correct"
  | "incorrect"
  | "tap"
  | "matchCorrect"
  | "matchWrong"
  | "lessonComplete"
  | "streak"
  | "combo"
  | "outOfHearts"
  | "gems"
  | "achievement"
  | "tick";

const MASTER_GAIN = 0.5;
/** Count-up ticks closer together than this would blur into a buzz. */
const TICK_INTERVAL_MS = 40;
/** Envelopes ramp exponentially, which cannot reach zero. */
const SILENT = 0.0001;

interface Tone {
  wave?: OscillatorType;
  /** Hz. */
  freq: number;
  /** Glides to this frequency by the end of the hold. */
  glideTo?: number;
  /** Seconds after the sound starts. */
  at?: number;
  /** Seconds at full level after the 5 ms attack. */
  hold: number;
  /** Seconds of exponential fade after the hold. */
  decay: number;
  gain: number;
  lowpass?: number;
  vibrato?: { rate: number; depth: number };
}

interface NoiseBurst {
  at?: number;
  duration: number;
  gain: number;
  /** Band-pass centre in Hz, or a sweep [from, to] over the duration. */
  band: number | readonly [number, number];
}

interface Synth {
  note(tone: Tone): void;
  noise(burst: NoiseBurst): void;
}

/** The four rising notes shared by the lesson-complete and achievement sounds. */
function fanfare({ note }: Synth): void {
  [523, 659, 784].forEach((freq, i) => note({ wave: "triangle", freq, at: i * 0.11, hold: 0.1, decay: 0.08, gain: 0.55 }));
  note({ wave: "triangle", freq: 1047, at: 0.33, hold: 0.4, decay: 0.3, gain: 0.55, vibrato: { rate: 5, depth: 9 } });
}

/** Each effect's recipe: notes and noise bursts timed from the moment it plays. */
const RECIPES: Record<SoundName, (synth: Synth) => void> = {
  // A bright two-note rising chime with a short sparkle on top.
  correct: ({ note, noise }) => {
    for (const [wave, share] of [["sine", 0.6], ["triangle", 0.4]] as const) {
      note({ wave, freq: 1318.5, hold: 0.07, decay: 0.03, gain: 0.5 * share });
      note({ wave, freq: 1760, at: 0.07, hold: 0.14, decay: 0.25, gain: 0.5 * share });
    }
    noise({ duration: 0.03, band: 6000, gain: 0.12 });
  },
  // A low two-note "bonk" whose pitch sags.
  incorrect: ({ note }) => {
    note({ wave: "square", freq: 220, glideTo: 198, hold: 0.09, decay: 0.03, gain: 0.45, lowpass: 900 });
    note({ wave: "square", freq: 174.6, glideTo: 157, at: 0.09, hold: 0.16, decay: 0.22, gain: 0.45, lowpass: 900 });
  },
  tap: ({ note }) => note({ freq: 880, glideTo: 660, hold: 0.04, decay: 0.06, gain: 0.25 }),
  matchCorrect: ({ note }) => {
    note({ freq: 1046, hold: 0.05, decay: 0.03, gain: 0.35 });
    note({ freq: 1568, at: 0.05, hold: 0.06, decay: 0.08, gain: 0.35 });
  },
  matchWrong: ({ note }) => note({ wave: "square", freq: 160, hold: 0.12, decay: 0.05, gain: 0.3, lowpass: 1200 }),
  lessonComplete: fanfare,
  // A whoosh and a rising tone as the flame ignites.
  streak: ({ note, noise }) => {
    noise({ duration: 0.35, band: [400, 3000], gain: 0.35 });
    note({ freq: 300, glideTo: 900, hold: 0.3, decay: 0.15, gain: 0.5 });
  },
  combo: ({ note }) =>
    [1568, 1976, 2349].forEach((freq, i) => note({ freq, at: i * 0.06, hold: 0.06, decay: 0.08, gain: 0.4 })),
  outOfHearts: ({ note }) =>
    [330, 262, 220].forEach((freq, i) =>
      note({ wave: "triangle", freq, at: i * 0.15, hold: 0.15, decay: i === 2 ? 0.25 : 0.04, gain: 0.4 }),
    ),
  // A coin jingle: a few random high blips.
  gems: ({ note }) => {
    const blips = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < blips; i += 1) {
      note({ freq: 1800 + Math.random() * 800, at: i * 0.04, hold: 0.03, decay: 0.05, gain: 0.4 });
    }
  },
  achievement: (synth) => {
    fanfare(synth);
    synth.noise({ at: 0.1, duration: 0.5, band: 8000, gain: 0.18 });
  },
  tick: ({ note }) => note({ freq: 2000, hold: 0.015, decay: 0.01, gain: 0.15 }),
};

// ----------------------------------------------------------------------------------------------- playback

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = true;
let lastTickAt = -Infinity;
let primed = false;

/** Settings → Sound effects. */
export function setSoundEffectsEnabled(on: boolean): void {
  enabled = on;
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  if (!context) {
    context = new window.AudioContext();
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

/**
 * Creates (or wakes) the AudioContext on the next tap or key press, so effects that follow a server answer
 * can play even when the learner has only used the keyboard. Calling it again is a no-op.
 */
export function primeSoundOnFirstGesture(): void {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const unlock = () => {
    audioContext();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

export function playSound(name: SoundName): void {
  if (!enabled || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
  if (name === "tick") {
    const now = performance.now();
    if (now - lastTickAt < TICK_INTERVAL_MS) return;
    lastTickAt = now;
  }
  const ctx = audioContext();
  if (!ctx || !master) return;
  RECIPES[name](synthFor(ctx, master));
}

function synthFor(ctx: AudioContext, out: AudioNode): Synth {
  const start = ctx.currentTime;
  return {
    note({ wave = "sine", freq, glideTo, at = 0, hold, decay, gain, lowpass, vibrato }) {
      const t0 = start + at;
      const end = t0 + hold + decay;
      const oscillator = ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(freq, t0);
      if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, t0 + hold);
      const amp = envelope(ctx, t0, hold, decay, gain);
      let source: AudioNode = oscillator;
      if (lowpass) {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = lowpass;
        oscillator.connect(filter);
        source = filter;
      }
      source.connect(amp).connect(out);
      if (vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = vibrato.rate;
        depth.gain.value = vibrato.depth;
        lfo.connect(depth).connect(oscillator.frequency);
        lfo.start(t0);
        lfo.stop(end);
      }
      oscillator.start(t0);
      oscillator.stop(end + 0.02);
    },
    noise({ at = 0, duration, gain, band }) {
      const t0 = start + at;
      const source = ctx.createBufferSource();
      source.buffer = whiteNoise(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.2;
      const [from, to] = typeof band === "number" ? [band, band] : band;
      filter.frequency.setValueAtTime(from, t0);
      if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, t0 + duration);
      source.connect(filter).connect(envelope(ctx, t0, duration * 0.3, duration * 0.7, gain)).connect(out);
      source.start(t0);
      source.stop(t0 + duration + 0.02);
    },
  };
}

/** A 5 ms attack to `gain`, a hold, then an exponential fade. */
function envelope(ctx: AudioContext, t0: number, hold: number, decay: number, gain: number): GainNode {
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
  amp.gain.setValueAtTime(gain, t0 + Math.max(hold, 0.005));
  amp.gain.exponentialRampToValueAtTime(SILENT, t0 + hold + decay);
  return amp;
}

/** One second of white noise, made once and shared by every noise burst. */
function whiteNoise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}
