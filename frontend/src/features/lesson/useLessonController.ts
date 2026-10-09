"use client";

import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/errors";
import type { AnswerIn, ExerciseOut, MeOut, PromptOut, SessionOut } from "@/lib/api/types";
import { newIdempotencyKey } from "@/lib/idempotency";
import type { AnswerDraft } from "@/lib/lesson/answerDraft";
import { buildCelebrations } from "@/lib/lesson/celebrations";
import {
  SESSION_ENDED_NOTICE,
  currentItem,
  initLessonState,
  lessonReducer,
  shownItem,
  type LessonState,
  type Phase,
} from "@/lib/lesson/lessonMachine";
import { playSound, primeSoundOnFirstGesture, setSoundEffectsEnabled } from "@/lib/sound";
import { cancelSpeech, speak, useSpeech } from "@/lib/tts";
import type { LessonApi } from "./lessonApi";
import { answerSound, draftSound } from "./lessonSounds";
import type { LessonActions, LessonAudio, LessonPending } from "./playerTypes";

/** Used until `me` (and its course) has loaded. */
const FALLBACK_LOCALE = "es-ES";
/** Spoken prompts start shortly after their exercise appears. */
const AUTOPLAY_DELAY_MS = 300;
/** Timed practice keeps its clock running, so the feedback bar moves on by itself. */
const TIMED_CONTINUE_MS = { correct: 700, wrong: 1500 } as const;

const NOTICES = {
  listeningOff: "Listening exercises are off for this lesson",
  noVoice: "Audio isn't available on this device",
  practiceForHearts: "Practice to earn hearts!",
  heartsRefilled: "Hearts refilled!",
  notEnoughGems: "Not enough gems",
  report: "Thanks! Reporting is coming soon.",
} as const;

export interface LessonControllerOptions {
  session: SessionOut;
  /** The learner, for settings, gems and the course's speech locale; null while unknown. */
  me: MeOut | null;
  api: LessonApi;
  /** Leaves the player for another page (the app replaces the history entry). */
  navigate(href: string): void;
}

export interface LessonController {
  state: LessonState;
  actions: LessonActions;
  audio: LessonAudio;
  pending: LessonPending;
}

/**
 * Runs a lesson: the pure reducer holds the state, and this hook does everything else. It reacts to each
 * phase the reducer enters (sending the answer, completing, leaving, sounds), speaks prompts, and turns the
 * learner's actions into events. It is the only place in the player with side effects.
 */
export function useLessonController({ session, me, api, navigate }: LessonControllerOptions): LessonController {
  const [state, dispatch] = useReducer(lessonReducer, session, (initial) =>
    initLessonState(initial, { motivational: me?.settings.motivationalMessages ?? true }),
  );
  const { toast } = useToast();
  const speech = useSpeech(me?.course.ttsLocale ?? FALLBACK_LOCALE);
  const [pending, setPending] = useState<LessonPending>({ quitting: false, refilling: false, restarting: false });
  // Why the next CAN'T LISTEN NOW happens: the learner's choice, or a device without a Spanish voice.
  const cantListenNotice = useRef<string>(NOTICES.listeningOff);
  const { phase } = state;
  const sessionId = state.session.id;

  // ------------------------------------------------------------------------------------------- settings

  const soundEffects = me?.settings.soundEffects ?? true;
  useEffect(() => {
    setSoundEffectsEnabled(soundEffects);
  }, [soundEffects]);
  useEffect(() => {
    primeSoundOnFirstGesture();
    return () => cancelSpeech();
  }, []);

  // ------------------------------------------------------------------------------------ server requests

  function resync(onFailure: () => void = () => undefined) {
    api.reload(sessionId).then((fresh) => dispatch({ type: "SYNCED", session: fresh }), onFailure);
  }

  function submit(payload: AnswerIn) {
    const item = currentItem(state.session);
    if (!item) return;
    api.submitAnswer(sessionId, item.id, payload).then(
      (result) => {
        const sound = answerSound(result.result);
        if (sound) playSound(sound);
        if (result.result === "cant_listen") toast({ message: cantListenNotice.current });
        dispatch({ type: "ANSWER_OK", result });
      },
      (error: unknown) => {
        const failure = asApiError(error);
        dispatch({ type: "ANSWER_FAILED", error: failure });
        // Another tab moved this session on: start again from the server's copy.
        if (failure.code === "ITEM_OUT_OF_ORDER" || failure.code === "ITEM_ALREADY_ANSWERED") resync();
      },
    );
  }

  function complete() {
    api.complete(sessionId).then(
      (completion) => {
        playSound("lessonComplete");
        dispatch({ type: "COMPLETE_OK", completion, steps: buildCelebrations(completion) });
      },
      (error: unknown) => {
        const failure = asApiError(error);
        const failed = () => dispatch({ type: "COMPLETE_FAILED", error: failure });
        // The server still has something to answer (its timed clock is a moment behind ours, say): carry on
        // from its copy of the session rather than calling it an error.
        if (failure.code === "SESSION_INCOMPLETE") resync(failed);
        else failed();
      },
    );
  }

  // Each phase is entered once: React runs effects twice in development, and the reducer creates a new
  // phase object for every transition, so comparing identities tells a re-run from a new phase.
  const entered = useRef<Phase | null>(null);
  const enterPhase = useEffectEvent((next: Phase) => {
    switch (next.name) {
      case "checking":
        submit(next.payload);
        break;
      case "completing":
        complete();
        break;
      case "blocked":
        playSound("outOfHearts");
        break;
      case "coach":
        playSound("combo");
        break;
      case "exiting":
        if (next.notice) toast({ message: next.notice });
        navigate(next.href);
        break;
    }
  });
  useEffect(() => {
    if (entered.current === phase) return;
    entered.current = phase;
    enterPhase(phase);
  }, [phase]);

  // Timed practice: CONTINUE comes by itself (Enter is still quicker), paused while the quit modal is open.
  const timedFeedback = phase.name === "feedback" && state.session.kind === "timed" && !state.quitOpen;
  const timedCorrect = phase.name === "feedback" && phase.result.isCorrect;
  useEffect(() => {
    if (!timedFeedback) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "CONTINUE" }),
      timedCorrect ? TIMED_CONTINUE_MS.correct : TIMED_CONTINUE_MS.wrong,
    );
    return () => window.clearTimeout(timer);
  }, [timedFeedback, timedCorrect, phase]);

  // ----------------------------------------------------------------------------------------------- speech

  const answeringItem = phase.name === "answering" ? currentItem(state.session) : undefined;
  const autoplayed = useRef(new Set<number>());
  const playPromptOf = (itemId: number, exercise: ExerciseOut, slow = false) => {
    const prompt = spokenPrompt(exercise);
    if (prompt) speak(prompt.text, { slow, key: promptKey(itemId) });
  };

  // A spoken prompt plays once when its exercise appears, as soon as a voice is known to exist.
  const autoplay = useEffectEvent((itemId: number, exercise: ExerciseOut) => {
    autoplayed.current.add(itemId);
    playPromptOf(itemId, exercise);
  });
  const autoplayCandidate = speech.status === "ready" ? answeringItem : undefined;
  useEffect(() => {
    if (!autoplayCandidate || autoplayed.current.has(autoplayCandidate.id) || !spokenPrompt(autoplayCandidate.exercise)) return;
    const timer = window.setTimeout(() => autoplay(autoplayCandidate.id, autoplayCandidate.exercise), AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplayCandidate]);

  // Without a Spanish voice, listening exercises cannot be done: they are skipped with no penalty.
  const unplayableItemId =
    speech.status === "unavailable" && answeringItem && isListening(answeringItem.exercise) ? answeringItem.id : null;
  useEffect(() => {
    if (unplayableItemId === null) return;
    cantListenNotice.current = NOTICES.noVoice;
    dispatch({ type: "CANT_LISTEN" });
  }, [unplayableItemId]);

  const onScreen = shownItem(state);
  const audio: LessonAudio = {
    available: speech.status === "ready",
    promptPlaying: onScreen !== undefined && speech.speaking === promptKey(onScreen.id),
    playPrompt: (slow = false) => {
      if (onScreen) playPromptOf(onScreen.id, onScreen.exercise, slow);
    },
    speak: (text) => {
      if (speech.status === "ready") speak(text);
    },
  };

  // ---------------------------------------------------------------------------------------------- actions

  const setFlag = (flag: keyof LessonPending, on: boolean) => setPending((current) => ({ ...current, [flag]: on }));

  function quitAndLeave(notice: string | null) {
    if (pending.quitting) return;
    setFlag("quitting", true);
    api.quit(sessionId).then(
      () => {
        if (notice) toast({ message: notice });
        navigate("/learn");
      },
      (error: unknown) => {
        // A session that no longer exists (the demo was reset) has nothing left to quit.
        if (asApiError(error).code === "NOT_FOUND") {
          toast({ message: SESSION_ENDED_NOTICE });
          navigate("/learn");
          return;
        }
        // An unreachable server is already announced app-wide; the learner can press the button again.
        setFlag("quitting", false);
      },
    );
  }

  const actions: LessonActions = {
    draft(next: AnswerDraft | null) {
      const sound = draftSound(state.draft, next);
      if (sound) playSound(sound);
      dispatch({ type: "DRAFT_CHANGED", draft: next });
    },
    tap: () => playSound("tap"),
    check: () => dispatch({ type: "CHECK" }),
    skip: () => dispatch({ type: "SKIP" }),
    cantListen() {
      cantListenNotice.current = NOTICES.listeningOff;
      dispatch({ type: "CANT_LISTEN" });
    },
    continue: () => dispatch({ type: "CONTINUE" }),
    openQuit: () => dispatch({ type: "QUIT_OPEN" }),
    cancelQuit: () => dispatch({ type: "QUIT_CANCEL" }),
    endSession: () => quitAndLeave(null),
    noThanks: () => quitAndLeave(NOTICES.practiceForHearts),
    refill() {
      if (pending.refilling) return;
      // One key per press: automatic retries of this purchase reuse it, so it can never charge twice.
      const idempotencyKey = newIdempotencyKey();
      setFlag("refilling", true);
      api.refillHearts(idempotencyKey).then(
        (purchase) => {
          setFlag("refilling", false);
          toast({ tone: "success", message: NOTICES.heartsRefilled });
          dispatch({ type: "REFILLED", hearts: purchase.effect.hearts });
        },
        (error: unknown) => {
          setFlag("refilling", false);
          const failure = asApiError(error);
          if (failure.code === "INSUFFICIENT_GEMS") toast({ tone: "warning", message: NOTICES.notEnoughGems });
          // Hearts came back on their own meanwhile: the server's copy of the session is no longer blocked.
          if (failure.code === "HEARTS_ALREADY_FULL") resync();
        },
      );
    },
    tryAgain() {
      const nodeId = state.session.node?.id;
      if (nodeId === undefined || pending.restarting) return;
      setFlag("restarting", true);
      api.startLegendary(nodeId).catch((error: unknown) => {
        setFlag("restarting", false);
        if (asApiError(error).code === "INSUFFICIENT_GEMS") toast({ tone: "warning", message: NOTICES.notEnoughGems });
      });
    },
    leave: () => navigate("/learn"),
    retry: () => dispatch({ type: "RETRY" }),
    nextCelebration: () => dispatch({ type: "NEXT_CELEBRATION" }),
    timeUp: () => dispatch({ type: "TIME_UP" }),
    report: () => toast({ message: NOTICES.report }),
    replay: (slow) => audio.playPrompt(slow),
  };

  return { state, actions, audio, pending };
}

/** Every API call rejects with an ApiError; anything else is treated as an unreachable server. */
function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : ApiError.network(error);
}

function promptKey(itemId: number): string {
  return `prompt-${itemId}`;
}

function isListening(exercise: ExerciseOut): boolean {
  return exercise.type === "type_answer" && exercise.audioOnly;
}

/**
 * The exercise's sentence when it is Spanish and can be read aloud. A fill-in-the-blank sentence cannot:
 * its gap would be read out.
 */
function spokenPrompt(exercise: ExerciseOut): PromptOut | null {
  if (exercise.type === "match_pairs" || exercise.type === "fill_blank") return null;
  return exercise.prompt?.speak ? exercise.prompt : null;
}
