"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronIcon, FlagIcon, FlameIcon, LeagueBadge } from "@/components/icons";
import { Illustration } from "@/components/illustrations/Illustration";
import { Character, Owl, SpeechBubble } from "@/components/mascot";
import { ButtonLink, Card, ProgressBar, Tooltip } from "@/components/ui";
import { ComingSoonProvider, useComingSoon } from "@/features/shell/ComingSoon";
import { Wordmark } from "@/features/shell/Wordmark";
import { cn } from "@/lib/cn";
import { DISCLAIMER } from "@/lib/constants";

/*
 * The public landing page (MORE → ABOUT THIS CLONE, and the 404 page). It is static: nothing here calls the
 * API, so it renders even while the server sleeps. Every CTA goes to the path.
 */

const COURSES = [
  { flag: "es", name: "Spanish", live: true },
  { flag: "fr", name: "French", live: false },
  { flag: "de", name: "German", live: false },
  { flag: "it", name: "Italian", live: false },
  { flag: "ja", name: "Japanese", live: false },
  { flag: "us", name: "English", live: false },
] as const;

/** The marketing headline style: lowercase, extra heavy, brand green. */
const HEADLINE = "text-[36px]/[40px] font-black tracking-[-0.02em] lowercase md:text-[48px]/[52px]";

/**
 * The closing band and the footer use the fixed brand green (it does not lighten in dark mode, so white text
 * keeps reading on it). The band hands it to its white button, whose label takes the band's colour.
 */
const BRAND_BAND = { "--surface": "var(--unit-green)" } as CSSProperties;

export default function WelcomePage() {
  return (
    <ComingSoonProvider>
      <div className="min-h-dvh bg-page">
        <TopBar />
        <main>
          <Hero />
          <CourseStrip />
          <FeatureSection title="small lessons. big progress." art={<LessonArt />}>
            Lessons take just a few minutes, so Spanish fits into a coffee break. Every lesson you finish fills in
            your path, one step at a time.
          </FeatureSection>
          <FeatureSection title="learn by playing." art={<PictureCardsArt />} flipped>
            Pick pictures, build sentences from word tiles and match pairs. Lessons feel like a game, and every right
            answer earns XP.
          </FeatureSection>
          <FeatureSection title="stay motivated." art={<StreakArt />}>
            Keep your streak alive, climb the weekly leagues and unlock achievements. A little friendly competition
            goes a long way.
          </FeatureSection>
          <FeatureSection title="made for you." art={<DailyGoalArt />} flipped>
            Choose a daily goal that suits your schedule, hear every phrase spoken aloud and practice the words you
            missed, at your own pace.
          </FeatureSection>
          <FinalBand />
        </main>
        <Footer />
      </div>
    </ComingSoonProvider>
  );
}

function TopBar() {
  const showComingSoon = useComingSoon();
  return (
    <header className="mx-auto flex h-[70px] max-w-[988px] items-center justify-between px-[15px] md:px-10 min-[1080px]:px-0">
      <Wordmark />
      <button
        type="button"
        onClick={() => showComingSoon("more site languages")}
        className="flex cursor-pointer items-center gap-2 rounded-sm text-label text-fg-2 uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        <span>
          <span className="hidden sm:inline">Site language: </span>English
        </span>
        <ChevronIcon direction="down" size={16} />
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-[988px] flex-col items-center gap-8 px-4 pt-4 pb-14 min-[1080px]:flex-row min-[1080px]:justify-center min-[1080px]:gap-12 min-[1080px]:py-20">
      <HeroArt />
      <div className="flex w-full max-w-[424px] flex-col items-center text-center">
        <h1 className="text-[24px]/8 font-extrabold text-fg md:text-hero">The fun, free way to learn Spanish!</h1>
        <div className="mt-8 flex w-full max-w-[330px] flex-col gap-3">
          <ButtonLink href="/learn" fullWidth>
            Get started
          </ButtonLink>
          <ButtonLink href="/learn" variant="outline" fullWidth>
            I already have an account
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** The owl waving among three learners on a pale circle, greeting in both languages. */
function HeroArt() {
  return (
    <div aria-hidden="true" className="relative aspect-square w-full max-w-[424px]">
      <div className="absolute inset-[7%] rounded-full bg-selected" />
      <Owl pose="wave" className="absolute top-[3%] left-1/2 h-auto w-[50%] -translate-x-1/2" />
      <Character id="lucia" className="absolute bottom-[8%] left-[3%] h-auto w-[27%]" />
      <Character id="kai" className="absolute bottom-[5%] left-1/2 h-auto w-[23%] -translate-x-1/2" />
      <Character id="marco" className="absolute right-[3%] bottom-[8%] h-auto w-[27%]" />
      {/* Positioned through wrappers: the bubble keeps its own relative positioning for its tail. */}
      <div className="absolute top-[34%] left-[4%]">
        <SpeechBubble tail="bottom" className="text-exercise">
          ¡Hola!
        </SpeechBubble>
      </div>
      <div className="absolute top-[40%] right-[3%]">
        <SpeechBubble tail="bottom" className="text-exercise">
          Hello!
        </SpeechBubble>
      </div>
    </div>
  );
}

/** The course carousel. Spanish is live; the other courses say Coming soon. */
function CourseStrip() {
  const listRef = useRef<HTMLDivElement>(null);
  const showComingSoon = useComingSoon();
  const scrollBy = (direction: 1 | -1) =>
    listRef.current?.scrollBy({ left: direction * 240, behavior: "smooth" });

  return (
    <nav aria-label="Courses" className="border-t-2 border-line">
      <div className="mx-auto flex h-[72px] max-w-[988px] items-center gap-2 px-2 md:px-6 min-[1080px]:px-0">
        <StripArrow direction="left" onClick={() => scrollBy(-1)} />
        {/* Centred while the chips fit; on narrow screens the row starts at the left edge and scrolls. */}
        <div ref={listRef} className="flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
          <ul className="mx-auto flex w-max gap-1">
            {COURSES.map(({ flag, name, live }) => (
              <li key={flag} className="shrink-0 snap-start">
                {live ? (
                  <Link href="/learn" className={CHIP}>
                    <CourseLabel flag={flag} name={name} />
                  </Link>
                ) : (
                  <Tooltip content="Coming soon">
                    <button type="button" className={CHIP} onClick={() => showComingSoon(`the ${name} course`)}>
                      <CourseLabel flag={flag} name={name} />
                    </button>
                  </Tooltip>
                )}
              </li>
            ))}
          </ul>
        </div>
        <StripArrow direction="right" onClick={() => scrollBy(1)} />
      </div>
    </nav>
  );
}

const CHIP =
  "flex h-12 cursor-pointer items-center gap-2 rounded-md px-2 text-label text-fg-2 uppercase hover:bg-subtle " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

/** A course chip's flag and name. */
function CourseLabel({ flag, name }: { flag: string; name: string }) {
  return (
    <>
      <FlagIcon code={flag} size={40} />
      {name}
    </>
  );
}

function StripArrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Previous courses" : "More courses"}
      onClick={onClick}
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-fg-3 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
    >
      <ChevronIcon direction={direction} size={24} />
    </button>
  );
}

interface FeatureSectionProps {
  title: string;
  art: ReactNode;
  /** Puts the art on the right on wide screens, so sections alternate. */
  flipped?: boolean;
  children: ReactNode;
}

function FeatureSection({ title, art, flipped = false, children }: FeatureSectionProps) {
  return (
    <section className="mx-auto grid max-w-[988px] items-center gap-10 px-6 py-14 md:grid-cols-2 md:gap-12 md:px-10 md:py-20 min-[1080px]:px-0">
      <div className={flipped ? "md:order-2" : undefined}>{art}</div>
      <div className="mx-auto max-w-[424px] text-center md:mx-0 md:text-left">
        <h2 className={cn(HEADLINE, "text-owl")}>{title}</h2>
        <p className="mt-4 text-subtitle text-fg-2">{children}</p>
      </div>
    </section>
  );
}

/** The art panel every feature section sits on: a pale rounded square, the illustration centred. */
function ArtPanel({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="relative mx-auto flex aspect-[5/4] w-full max-w-[424px] items-center justify-center rounded-[32px] bg-selected">
      {children}
    </div>
  );
}

function LessonArt() {
  return (
    <ArtPanel>
      <Owl pose="read" className="h-auto w-[56%] translate-y-[6%]" />
      <div className="absolute top-[9%] left-1/2 w-[74%] -translate-x-1/2 rounded-lg border-2 border-line bg-page p-3 shadow-[0_2px_0_var(--c-line)]">
        <ProgressBar value={0.6} height={16} />
      </div>
    </ArtPanel>
  );
}

const PICTURE_CARDS = [
  { image: "apple", label: "la manzana", selected: false },
  { image: "bread", label: "el pan", selected: true },
  { image: "coffee", label: "el café", selected: false },
] as const;

function PictureCardsArt() {
  return (
    <ArtPanel>
      <div className="grid w-[86%] grid-cols-3 gap-3">
        {PICTURE_CARDS.map(({ image, label, selected }) => (
          <Card key={image} tile interactive selected={selected} padding="sm" className="flex flex-col items-center gap-2 px-2">
            <Illustration name={image} className="h-auto w-[86%]" />
            <span className="text-center text-[15px] leading-5 font-semibold">{label}</span>
          </Card>
        ))}
      </div>
    </ArtPanel>
  );
}

function StreakArt() {
  return (
    <ArtPanel>
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-3">
          <FlameIcon size={88} />
          <span className="text-[72px] leading-none font-black text-streak tabular-nums">14</span>
        </div>
        <span className="mt-1 text-title text-streak">day streak!</span>
        <div className="mt-5 flex items-end gap-3">
          <LeagueBadge tier={1} size={44} />
          <LeagueBadge tier={2} size={60} />
          <LeagueBadge tier={3} size={44} locked />
        </div>
      </div>
    </ArtPanel>
  );
}

const GOALS = [
  { name: "Casual", xp: 10, selected: false },
  { name: "Regular", xp: 20, selected: true },
  { name: "Serious", xp: 30, selected: false },
] as const;

function DailyGoalArt() {
  return (
    <ArtPanel>
      <div className="flex w-[84%] flex-col">
        <div className="flex items-center gap-2">
          <Owl pose="cheer" size={76} className="shrink-0" />
          <SpeechBubble tail="left" className="mb-3 text-[15px] leading-5 font-semibold">
            What&apos;s your daily goal?
          </SpeechBubble>
        </div>
        <ul className="mt-2 overflow-hidden rounded-[14px] border-2 border-line bg-page">
          {GOALS.map(({ name, xp, selected }) => (
            <li
              key={name}
              className={cn(
                "flex justify-between border-t-2 border-line px-4 py-2.5 text-[15px] leading-5 font-semibold first:border-t-0",
                selected ? "bg-selected text-fg-selected" : "text-fg",
              )}
            >
              <span className="font-extrabold">{name}</span>
              <span className={selected ? undefined : "text-fg-2"}>{xp} XP per day</span>
            </li>
          ))}
        </ul>
      </div>
    </ArtPanel>
  );
}

function FinalBand() {
  return (
    <section style={BRAND_BAND} className="bg-(--unit-green) px-6 py-20 text-center">
      <h2 className={cn(HEADLINE, "text-on-color-fixed")}>learn on your schedule.</h2>
      <ButtonLink href="/learn" variant="white" className="mt-8 w-full max-w-[330px]">
        Get started
      </ButtonLink>
    </section>
  );
}

const FOOTER_LINKS = [
  { label: "Help", feature: "the help center" },
  { label: "Terms", feature: "the terms page" },
  { label: "Privacy", feature: "the privacy page" },
] as const;

function Footer() {
  const showComingSoon = useComingSoon();
  return (
    <footer className="border-t-2 border-on-color-fixed/20 bg-(--unit-green) px-6 pt-8 pb-10 text-on-color-fixed md:px-10">
      <div className="mx-auto max-w-[988px]">
        <ul className="flex flex-wrap gap-x-8 gap-y-2">
          {FOOTER_LINKS.map(({ label, feature }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => showComingSoon(feature)}
                className="cursor-pointer rounded-sm text-small hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-color-fixed"
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[640px] text-[13px] leading-[18px] font-semibold opacity-80">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
