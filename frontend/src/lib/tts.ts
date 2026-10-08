import { useEffect, useSyncExternalStore } from "react";

/*
 * Spanish speech through the browser's Web Speech API: prompts, tapped words and the listening exercise.
 * Lesson content, so Settings → Sound effects does not mute it. Voices load asynchronously in Chrome
 * (`getVoices()` is often empty at first), so "no Spanish voice on this device" is only decided after the
 * first `voiceschanged` event or 1.5 s, never on the first call.
 */

/** The parts of a `SpeechSynthesisVoice` the choice depends on. */
export interface VoiceLike {
  lang: string;
  name: string;
}

/** pending: still looking for a voice · ready: a voice speaks the course language · unavailable: none does. */
export type SpeechStatus = "pending" | "ready" | "unavailable";

export interface SpeechState {
  status: SpeechStatus;
  /** The key of the text being spoken (its `key` option, or the text itself), so its speaker can animate. */
  speaking: string | null;
}

const VOICE_DECISION_TIMEOUT_MS = 1_500;
/** The turtle button. */
const SLOW_RATE = 0.6;

/** Regional voices to try, in order, after the course's own locale. Other languages take any regional voice. */
const REGION_FALLBACKS: Record<string, readonly string[]> = { es: ["es-es", "es-mx", "es-us"] };

const tagOf = (lang: string) => lang.replace("_", "-").toLowerCase();

/**
 * The voice to speak `locale` with: the locale itself, then Spain, Mexico and US Spanish, then any voice of
 * the language. Android reports tags like "es_MX", so tags are compared normalized.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: string): V | null {
  const wanted = tagOf(locale);
  const language = wanted.split("-")[0];
  for (const tag of [wanted, ...(REGION_FALLBACKS[language] ?? [])]) {
    const exact = voices.find((voice) => tagOf(voice.lang) === tag);
    if (exact) return exact;
  }
  return voices.find((voice) => tagOf(voice.lang) === language || tagOf(voice.lang).startsWith(`${language}-`)) ?? null;
}

// ------------------------------------------------------------------------------------------------- the store

const SERVER_STATE: SpeechState = { status: "pending", speaking: null };

let state: SpeechState = SERVER_STATE;
const listeners = new Set<() => void>();
let discoveredLocale: string | null = null;
let voice: SpeechSynthesisVoice | null = null;
/** Increases with every utterance, so the end of an older one never clears the newer one's state. */
let utteranceId = 0;

function update(patch: Partial<SpeechState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function synthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** Looks for a voice for `locale` once, and keeps listening: voices can arrive in several batches. */
function discover(locale: string): void {
  if (discoveredLocale === locale) return;
  discoveredLocale = locale;
  const speech = synthesis();
  if (!speech) {
    update({ status: "unavailable" });
    return;
  }
  const choose = () => {
    voice = pickVoice(speech.getVoices(), locale);
    return voice !== null;
  };
  let decided = false;
  const decide = () => {
    if (choose()) update({ status: "ready" });
    else if (!decided) update({ status: "unavailable" });
    decided = true;
  };
  if (choose()) {
    decided = true;
    update({ status: "ready" });
  }
  speech.addEventListener("voiceschanged", decide);
  setTimeout(() => {
    if (!decided) decide();
  }, VOICE_DECISION_TIMEOUT_MS);
}

export interface SpeakOptions {
  /** The turtle: 0.6 × speed. */
  slow?: boolean;
  /** Names what is speaking (a prompt, a word) for `SpeechState.speaking`; defaults to the text. */
  key?: string;
}

/** Speaks `text` in the course language, cutting off anything still speaking. */
export function speak(text: string, { slow = false, key = text }: SpeakOptions = {}): void {
  const speech = synthesis();
  if (!speech || !text.trim()) return;
  speech.cancel();
  const id = ++utteranceId;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? discoveredLocale ?? "es-ES";
  if (voice) utterance.voice = voice;
  utterance.rate = slow ? SLOW_RATE : 1;
  utterance.pitch = 1;
  utterance.onstart = () => {
    if (id === utteranceId) update({ speaking: key });
  };
  utterance.onend = utterance.onerror = () => {
    if (id === utteranceId) update({ speaking: null });
  };
  speech.speak(utterance);
}

/** Stops speaking, e.g. when the learner leaves the lesson. */
export function cancelSpeech(): void {
  utteranceId += 1;
  synthesis()?.cancel();
  if (state.speaking !== null) update({ speaking: null });
}

/** Whether `locale` can be spoken on this device, and what is speaking right now. */
export function useSpeech(locale: string): SpeechState {
  useEffect(() => discover(locale), [locale]);
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
