"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { Illustration } from "@/components/illustrations/Illustration";
import { ILLUSTRATIONS, type IllustrationKey } from "@/components/illustrations/registry";
import { Character, CHARACTERS, Confetti, Owl, OWL_POSES, OwlHead, SpeechBubble, type OwlPose } from "@/components/mascot";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme/ThemeProvider";

/** Where each pose appears in the app. */
const POSE_USES: Record<OwlPose, string> = {
  idle: "Path, empty states",
  celebrate: "Lesson complete",
  sad: "Quit, out of hearts, errors",
  think: "Coming soon, loading",
  sleep: "Waking server",
  cheer: "Coach messages",
  wave: "Landing, unit 1",
  lost: "404",
  build: "Coming soon modal",
  cape: "Super promo",
  read: "Unit 2",
  coffee: "Unit 3",
  flag: "Unit 4",
  legend: "Legendary",
  stopwatch: "Timed practice",
};

/** The picture exercises of the course, as fixtures: prompt, then [image key, Spanish label] per card. */
const PICTURE_EXERCISES: { prompt: string; options: [IllustrationKey, string][] }[] = [
  { prompt: "hello", options: [["wave", "hola"], ["bye", "adiós"], ["thanks", "gracias"]] },
  { prompt: "good morning", options: [["sun", "buenos días"], ["moon", "buenas noches"], ["bye", "adiós"]] },
  { prompt: "the woman", options: [["woman", "la mujer"], ["man", "el hombre"], ["girl", "la niña"]] },
  { prompt: "the boy", options: [["boy", "el niño"], ["girl", "la niña"], ["man", "el hombre"]] },
  { prompt: "the bread", options: [["bread", "el pan"], ["apple", "la manzana"], ["cheese", "el queso"]] },
  { prompt: "the orange", options: [["orange", "la naranja"], ["apple", "la manzana"], ["bread", "el pan"]] },
  { prompt: "the tea", options: [["tea", "el té"], ["coffee", "el café"], ["milk", "la leche"]] },
  { prompt: "the juice", options: [["juice", "el jugo"], ["water", "el agua"], ["milk", "la leche"]] },
  { prompt: "the bill", options: [["bill", "la cuenta"], ["sugar", "el azúcar"], ["coffee", "el café"]] },
  { prompt: "the apple", options: [["apple", "la manzana"], ["orange", "la naranja"], ["cheese", "el queso"]] },
  { prompt: "the mother", options: [["mother", "la madre"], ["father", "el padre"], ["sister", "la hermana"]] },
  { prompt: "tall", options: [["tall", "alto"], ["short", "bajo"], ["girl", "la niña"]] },
  { prompt: "the father", options: [["father", "el padre"], ["mother", "la madre"], ["brother", "el hermano"]] },
];

type ConfettiShot = { id: number; variant: "cannons" | "burst"; bursts: number };

/** Every mascot pose, speaker and picture at the sizes the app uses, for checking the artwork in both themes. */
export default function ArtKitchenSinkPage() {
  const [talking, setTalking] = useState(false);
  const [shot, setShot] = useState<ConfettiShot | null>(null);
  const celebrationOwl = useRef<HTMLDivElement>(null);
  const fire = (variant: ConfettiShot["variant"], bursts = 1) => setShot({ id: Date.now(), variant, bursts });

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-12 px-4 pb-24 md:px-8">
      <Toolbar talking={talking} onTalkingChange={setTalking} />

      <Section title="Mascot poses" note="200 px, the path decoration size. Each pose moves gently; reduced motion stills them.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {OWL_POSES.map((pose) => (
            <figure key={pose} className="flex flex-col items-center gap-1 rounded-lg border-2 border-line px-2 pb-3 pt-2">
              <Owl pose={pose} size={200} className="h-auto max-w-full" />
              <figcaption className="text-center">
                <span className="block text-body font-extrabold text-fg">{pose}</span>
                <span className="block text-small text-fg-2">{POSE_USES[pose]}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Mascot sizes" note="Lesson complete 200 / 160, coach 160, modals 120–160, empty states 96, logo head 40, favicon.">
        <div className="flex flex-wrap items-end gap-6">
          {[200, 160, 120, 96, 72].map((size) => (
            <figure key={size} className="flex flex-col items-center gap-1">
              <Owl size={size} />
              <figcaption className="text-small text-fg-2">{size}</figcaption>
            </figure>
          ))}
          <figure className="flex flex-col items-center gap-1">
            <OwlHead size={40} />
            <figcaption className="text-small text-fg-2">head 40</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <div className="flex items-end gap-3">
              {[16, 32, 48].map((size) => (
                <Image key={size} src="/favicon.svg" width={size} height={size} alt="" unoptimized />
              ))}
            </div>
            <figcaption className="text-small text-fg-2">favicon 16 / 32 / 48</figcaption>
          </figure>
        </div>
      </Section>

      <Section title="Speakers" note="120 px (96 on phones), standing on the first answer line. Mouths move while speech plays.">
        <div className="flex flex-col gap-8">
          {[120, 96].map((size) => (
            <div key={size} className="flex flex-wrap items-end gap-x-10 gap-y-6">
              {CHARACTERS.map((id) => (
                <div key={id} className="flex items-end gap-3 border-b-2 border-line pr-2">
                  <Character id={id} size={size} talking={talking} />
                  <SpeechBubble className="mb-5">
                    <span className="text-exercise">{id === "owl" ? "¡Hola!" : "Yo como una manzana."}</span>
                  </SpeechBubble>
                </div>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-4">
            <Owl pose="cheer" size={160} />
            <SpeechBubble size="lg" className="max-w-[320px]">
              <span className="text-subtitle text-fg">Amazing! 5 in a row!</span>
            </SpeechBubble>
          </div>
        </div>
      </Section>

      <Section title="Celebration" note="Confetti: two corner cannons, or a burst from the owl. A perfect lesson fires twice.">
        <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-line py-8">
          <div ref={celebrationOwl}>
            <Owl pose="celebrate" size={200} />
          </div>
          <p className="text-title-xl text-gold">Lesson Complete!</p>
          <div className="flex flex-wrap justify-center gap-3">
            <DemoButton onClick={() => fire("cannons")}>Cannons</DemoButton>
            <DemoButton onClick={() => fire("burst")}>Burst from the owl</DemoButton>
            <DemoButton onClick={() => fire("cannons", 2)}>Perfect lesson</DemoButton>
          </div>
        </div>
        {shot && (
          <Confetti key={shot.id} variant={shot.variant} bursts={shot.bursts} origin={celebrationOwl} onDone={() => setShot(null)} />
        )}
      </Section>

      <Section title="Picture cards" note="The course's picture exercises, 3-up in the 600 px lesson column. The first card is shown selected.">
        <div className="flex flex-col gap-10">
          {PICTURE_EXERCISES.map(({ prompt, options }) => (
            <div key={prompt} className="max-w-[600px]">
              <p className="mb-4 text-heading text-fg">Which one of these is “{prompt}”?</p>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {options.map(([key, label], index) => (
                  <PictureCard key={key} imageKey={key} label={label} hotkey={index + 1} selected={index === 0} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="All pictures" note="Every image key at 120 px and at 64 px.">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
          {Object.keys(ILLUSTRATIONS).map((key) => (
            <figure key={key} className="flex flex-col items-center gap-1">
              <Illustration name={key} size={120} />
              <div className="flex items-center gap-2">
                <Illustration name={key} size={64} />
                <figcaption className="text-small text-fg-2">{key}</figcaption>
              </div>
            </figure>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Toolbar({ talking, onTalkingChange }: { talking: boolean; onTalkingChange: (talking: boolean) => void }) {
  const { resolvedTheme, previewTheme, reducedMotion } = useTheme();
  const setMotion = (reduced: boolean) => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  };
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] -mx-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b-2 border-line bg-page px-4 py-4 md:-mx-8 md:px-8">
      <h1 className="mr-auto text-title-lg text-fg-strong">Art</h1>
      <Toggle label="Theme" options={["light", "dark"]} value={resolvedTheme} onChange={(theme) => previewTheme(theme)} />
      <Toggle
        label="Motion"
        options={["full", "reduced"]}
        value={reducedMotion ? "reduced" : "full"}
        onChange={(motion) => setMotion(motion === "reduced")}
      />
      <Toggle label="Speech" options={["quiet", "talking"]} value={talking ? "talking" : "quiet"} onChange={(value) => onTalkingChange(value === "talking")} />
    </header>
  );
}

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-small text-fg-2">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            "h-8 rounded-sm border-2 px-3 text-label uppercase",
            option === value ? "border-line-selected bg-selected text-fg-selected" : "border-line text-fg-2",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading text-fg-strong">{title}</h2>
        <p className="text-small text-fg-2">{note}</p>
      </div>
      {children}
    </section>
  );
}

function DemoButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable h-[50px] rounded-md bg-primary px-6 text-label uppercase text-on-color shadow-[0_4px_0_var(--c-primary-lip)] [--lip:4px]"
    >
      {children}
    </button>
  );
}

/** A picture choice as the lesson draws it: 3 : 4 card, picture at 72 % width, Spanish label, hotkey badge. */
function PictureCard({ imageKey, label, hotkey, selected }: { imageKey: IllustrationKey; label: string; hotkey: number; selected: boolean }) {
  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] flex-col items-center justify-between rounded-md border-2 px-3 py-4",
        selected
          ? "border-line-selected bg-selected text-fg-selected shadow-[0_2px_0_var(--c-line-selected)]"
          : "border-line bg-page text-fg shadow-[0_2px_0_var(--c-line)]",
      )}
    >
      <span
        className={cn(
          "absolute left-2.5 top-2.5 hidden size-[30px] place-items-center rounded-sm border-2 text-[15px] font-extrabold leading-none md:grid",
          selected ? "border-line-selected text-fg-selected" : "border-line text-fg-3",
        )}
      >
        {hotkey}
      </span>
      <div className="flex w-full flex-1 items-center justify-center">
        <Illustration name={imageKey} className="h-auto w-[72%]" />
      </div>
      <span className="text-center text-exercise">{label}</span>
    </div>
  );
}
