"use client";

import { useState, type ReactNode } from "react";
import {
  AchievementBadge,
  ArrowIcon,
  BoltIcon,
  BookGlyph,
  CheckGlyph,
  CheckIcon,
  ChestIcon,
  ChevronIcon,
  ClockIcon,
  CloseIcon,
  CrossIcon,
  CrownIcon,
  DumbbellGlyph,
  FlagIcon,
  FlameIcon,
  FreezeIcon,
  GemBowlIcon,
  GemChestIcon,
  GemIcon,
  GemPileIcon,
  HeadphonesGlyph,
  HeartBrokenIcon,
  HeartIcon,
  HeartRefillIcon,
  LeaderboardsIcon,
  LeagueBadge,
  LearnIcon,
  LegendaryTrophyIcon,
  LightbulbIcon,
  LockGlyph,
  MedalIcon,
  MoonIcon,
  MoreIcon,
  NotebookIcon,
  PencilIcon,
  PersonPlusIcon,
  PlusIcon,
  PracticeIcon,
  QuestsIcon,
  RefreshIcon,
  ReportFlagIcon,
  SettingsIcon,
  ShareIcon,
  ShopIcon,
  SparkleIcon,
  SpeakerIcon,
  StarGlyph,
  StopwatchIcon,
  SunIcon,
  TargetIcon,
  TrophyGlyph,
  TurtleIcon,
  UnlimitedHeartIcon,
  XpPotionIcon,
  type AchievementArtCode,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme/ThemeProvider";

const SIZES = [20, 32, 64] as const;

/** White and one-colour artwork needs the surface it is designed for to be visible. */
type Surface = "page" | "node" | "locked" | "macaw" | "beetle" | "fox";

const SURFACES: Record<Surface, string> = {
  page: "text-fg",
  node: "bg-(--unit-green) text-on-color-fixed",
  locked: "bg-swan text-hare",
  macaw: "bg-macaw text-on-color-fixed",
  beetle: "bg-beetle text-on-color-fixed",
  fox: "bg-fox text-on-color-fixed",
};

interface Specimen {
  name: string;
  render: (size: number) => ReactNode;
  surface?: Surface;
}

const LEAGUES = ["Bronze", "Silver", "Gold", "Sapphire", "Ruby", "Emerald", "Amethyst", "Pearl", "Obsidian", "Diamond"];

const SECTIONS: { id: string; title: string; specimens: Specimen[] }[] = [
  {
    id: "nav",
    title: "Navigation",
    specimens: [
      { name: "LearnIcon", render: (s) => <LearnIcon size={s} /> },
      { name: "PracticeIcon", render: (s) => <PracticeIcon size={s} /> },
      { name: "LeaderboardsIcon", render: (s) => <LeaderboardsIcon size={s} /> },
      { name: "QuestsIcon", render: (s) => <QuestsIcon size={s} /> },
      { name: "ShopIcon", render: (s) => <ShopIcon size={s} /> },
      { name: "MoreIcon", render: (s) => <MoreIcon size={s} /> },
    ],
  },
  {
    id: "stats",
    title: "Stats, hearts and power-ups",
    specimens: [
      { name: "FlameIcon active", render: (s) => <FlameIcon size={s} /> },
      { name: "FlameIcon inactive", render: (s) => <FlameIcon size={s} variant="inactive" /> },
      { name: "FlameIcon perfect", render: (s) => <FlameIcon size={s} variant="perfect" /> },
      { name: "FlameIcon frozen", render: (s) => <FlameIcon size={s} variant="frozen" /> },
      { name: "FlameIcon mono (fox)", render: (s) => <FlameIcon size={s} variant="mono" className="text-fox" /> },
      { name: "BoltIcon", render: (s) => <BoltIcon size={s} /> },
      { name: "GemIcon", render: (s) => <GemIcon size={s} /> },
      { name: "GemIcon inactive", render: (s) => <GemIcon size={s} variant="inactive" /> },
      { name: "HeartIcon", render: (s) => <HeartIcon size={s} /> },
      { name: "HeartIcon empty", render: (s) => <HeartIcon size={s} variant="empty" /> },
      { name: "HeartBrokenIcon", render: (s) => <HeartBrokenIcon size={s} /> },
      { name: "HeartRefillIcon", render: (s) => <HeartRefillIcon size={s} /> },
      { name: "UnlimitedHeartIcon", render: (s) => <UnlimitedHeartIcon size={s} /> },
      { name: "FreezeIcon", render: (s) => <FreezeIcon size={s} /> },
      { name: "XpPotionIcon", render: (s) => <XpPotionIcon size={s} /> },
    ],
  },
  {
    id: "glyphs",
    title: "Path glyphs",
    specimens: [
      { name: "StarGlyph", render: (s) => <StarGlyph size={s} />, surface: "node" },
      { name: "CheckGlyph", render: (s) => <CheckGlyph size={s} />, surface: "node" },
      { name: "LockGlyph", render: (s) => <LockGlyph size={s} />, surface: "locked" },
      { name: "DumbbellGlyph", render: (s) => <DumbbellGlyph size={s} />, surface: "node" },
      { name: "BookGlyph", render: (s) => <BookGlyph size={s} />, surface: "node" },
      { name: "HeadphonesGlyph", render: (s) => <HeadphonesGlyph size={s} />, surface: "node" },
      { name: "TrophyGlyph", render: (s) => <TrophyGlyph size={s} />, surface: "node" },
      { name: "TrophyGlyph locked", render: (s) => <TrophyGlyph size={s} />, surface: "locked" },
    ],
  },
  {
    id: "rewards",
    title: "Rewards",
    specimens: [
      { name: "CrownIcon level 2", render: (s) => <CrownIcon size={s} level={2} /> },
      { name: "CrownIcon", render: (s) => <CrownIcon size={s} /> },
      { name: "CrownIcon mono", render: (s) => <CrownIcon size={s} variant="mono" className="text-gold-fg" /> },
      { name: "ChestIcon closed", render: (s) => <ChestIcon size={s} /> },
      { name: "ChestIcon open", render: (s) => <ChestIcon size={s} variant="open" /> },
      { name: "ChestIcon locked", render: (s) => <ChestIcon size={s} variant="locked" /> },
      { name: "GemPileIcon", render: (s) => <GemPileIcon size={s} /> },
      { name: "GemBowlIcon", render: (s) => <GemBowlIcon size={s} /> },
      { name: "GemChestIcon", render: (s) => <GemChestIcon size={s} /> },
      { name: "LegendaryTrophyIcon", render: (s) => <LegendaryTrophyIcon size={s} /> },
    ],
  },
  {
    id: "lesson",
    title: "Lesson",
    specimens: [
      { name: "CloseIcon", render: (s) => <CloseIcon size={s} className="text-fg-3" /> },
      { name: "SpeakerIcon", render: (s) => <SpeakerIcon size={s} />, surface: "macaw" },
      { name: "SpeakerIcon playing", render: (s) => <SpeakerIcon size={s} playing />, surface: "macaw" },
      { name: "TurtleIcon", render: (s) => <TurtleIcon size={s} />, surface: "macaw" },
      { name: "ReportFlagIcon", render: (s) => <ReportFlagIcon size={s} className="text-wrong-fg" /> },
      { name: "CheckIcon", render: (s) => <CheckIcon size={s} className="text-correct-fg" /> },
      { name: "CrossIcon", render: (s) => <CrossIcon size={s} className="text-wrong-fg" /> },
      { name: "SparkleIcon", render: (s) => <SparkleIcon size={s} />, surface: "beetle" },
      { name: "RefreshIcon", render: (s) => <RefreshIcon size={s} />, surface: "fox" },
      { name: "LightbulbIcon", render: (s) => <LightbulbIcon size={s} /> },
    ],
  },
  {
    id: "ui",
    title: "Interface",
    specimens: [
      { name: "SettingsIcon", render: (s) => <SettingsIcon size={s} className="text-fg-3" /> },
      { name: "ClockIcon", render: (s) => <ClockIcon size={s} className="text-fox" /> },
      { name: "StopwatchIcon", render: (s) => <StopwatchIcon size={s} className="text-beetle" /> },
      { name: "TargetIcon", render: (s) => <TargetIcon size={s} /> },
      { name: "ArrowIcon up", render: (s) => <ArrowIcon size={s} className="text-correct-fg" /> },
      { name: "ArrowIcon down", render: (s) => <ArrowIcon size={s} direction="down" className="text-wrong-fg" /> },
      { name: "ChevronIcon left", render: (s) => <ChevronIcon size={s} direction="left" className="text-fg-3" /> },
      { name: "ChevronIcon right", render: (s) => <ChevronIcon size={s} className="text-fg-3" /> },
      { name: "ChevronIcon down", render: (s) => <ChevronIcon size={s} direction="down" className="text-fg-3" /> },
      { name: "PlusIcon", render: (s) => <PlusIcon size={s} className="text-fg-2" /> },
      { name: "PencilIcon", render: (s) => <PencilIcon size={s} className="text-link" /> },
      { name: "ShareIcon", render: (s) => <ShareIcon size={s} className="text-link" /> },
      { name: "PersonPlusIcon", render: (s) => <PersonPlusIcon size={s} className="text-link" /> },
      { name: "SunIcon", render: (s) => <SunIcon size={s} className="text-fg-2" /> },
      { name: "MoonIcon", render: (s) => <MoonIcon size={s} className="text-fg-2" /> },
      { name: "NotebookIcon", render: (s) => <NotebookIcon size={s} />, surface: "node" },
    ],
  },
  {
    id: "flags",
    title: "Flags and medals",
    specimens: [
      ...["es", "fr", "de", "it", "ja", "us", "xx"].map((code) => ({
        name: `FlagIcon ${code}`,
        render: (s: number) => <FlagIcon size={s} code={code} />,
      })),
      ...([1, 2, 3] as const).map((rank) => ({
        name: `MedalIcon ${rank}`,
        render: (s: number) => <MedalIcon size={s} rank={rank} />,
      })),
    ],
  },
  {
    id: "leagues",
    title: "League badges",
    specimens: [
      ...LEAGUES.map((name, i) => ({
        name: `${i + 1} ${name}`,
        render: (s: number) => <LeagueBadge size={s} tier={i + 1} />,
      })),
      { name: "Gold locked", render: (s) => <LeagueBadge size={s} tier={3} locked /> },
      { name: "Ruby locked", render: (s) => <LeagueBadge size={s} tier={5} locked /> },
      { name: "Pearl locked", render: (s) => <LeagueBadge size={s} tier={8} locked /> },
    ],
  },
];

const ACHIEVEMENTS: AchievementArtCode[] = [
  "wildfire",
  "sage",
  "scholar",
  "sharpshooter",
  "champion",
  "winner",
  "legendary",
  "friendly",
  "photogenic",
];

function SpecimenCard({ name, render, surface = "page" }: Specimen) {
  return (
    <figure data-icon={name} className="flex flex-col gap-2 rounded-lg border-2 border-line p-3">
      <div className="flex items-end gap-3">
        {SIZES.map((size) => (
          <div key={size} className={cn("grid place-items-center rounded-md p-1.5", SURFACES[surface])}>
            {render(size)}
          </div>
        ))}
      </div>
      <figcaption className="text-caption text-fg-2 normal-case tracking-normal">{name}</figcaption>
    </figure>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <h2 className="text-heading text-fg-strong">{title}</h2>
      {children}
    </section>
  );
}

/** One "in context" mock-up, named so screenshots can target it. */
function Demo({ name, title, wide, children }: { name: string; title: string; wide?: boolean; children: ReactNode }) {
  return (
    <div data-context={name} className={cn("flex flex-col gap-3", wide && "xl:col-span-2")}>
      <h3 className="text-card-title">{title}</h3>
      {children}
    </div>
  );
}

const STAT = "flex items-center gap-2";

function StatsDemo() {
  return (
    <Demo name="stats" title="Stats bar (28 px)">
      <div className="flex flex-wrap items-center gap-5 text-stat tabular-nums">
        <FlagIcon code="es" size={32} />
        <span className={cn(STAT, "text-streak")}>
          <FlameIcon size={28} />
          12
        </span>
        <span className={cn(STAT, "text-xp-fg")}>
          <BoltIcon size={28} />
          1525
        </span>
        <span className={cn(STAT, "text-gem")}>
          <GemIcon size={28} />
          505
        </span>
        <span className={cn(STAT, "text-heart")}>
          <HeartIcon size={28} />5
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-5 text-stat tabular-nums text-fg-3">
        <FlagIcon code="fr" size={32} />
        <span className={STAT}>
          <FlameIcon size={28} variant="inactive" />0
        </span>
        <span className={STAT}>
          <GemIcon size={28} variant="inactive" />0
        </span>
        <span className={STAT}>
          <HeartIcon size={28} variant="empty" />0
        </span>
      </div>
    </Demo>
  );
}

const NAV_ITEMS = [
  { label: "Learn", icon: <LearnIcon /> },
  { label: "Practice", icon: <PracticeIcon /> },
  { label: "Leaderboards", icon: <LeaderboardsIcon /> },
  { label: "Quests", icon: <QuestsIcon /> },
  { label: "Shop", icon: <ShopIcon /> },
  { label: "More", icon: <MoreIcon /> },
];

function SidebarDemo() {
  return (
    <Demo name="nav" title="Sidebar (32 px)">
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ label, icon }, i) => (
          <div
            key={label}
            className={cn(
              "flex h-[52px] w-64 items-center gap-5 rounded-md border-2 px-2 text-label uppercase",
              i === 0 ? "border-line-selected bg-selected text-link" : "border-transparent text-fg-2",
            )}
          >
            <span className="ml-1.5">{icon}</span>
            {label}
          </div>
        ))}
      </div>
    </Demo>
  );
}

const NODE_FACES = {
  unit: "bg-(--unit-green) shadow-[0_8px_0_var(--unit-green-lip)] text-on-color-fixed",
  locked: "bg-(--c-node-locked) shadow-[0_8px_0_var(--c-node-locked-lip)] text-(--c-node-locked-glyph)",
  gold: "bg-(--unit-gold) shadow-[0_8px_0_var(--unit-gold-lip)] text-on-color-fixed",
};

/** A path node face (70 × 57 with an 8 px lip) holding a glyph and, optionally, its crown badge. */
function Node({ face, crown, children }: { face: keyof typeof NODE_FACES; crown?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn("relative grid h-[57px] w-[70px] place-items-center rounded-[50%]", NODE_FACES[face])}>
      {children}
      {crown ? <span className="absolute -right-1.5 bottom-1">{crown}</span> : null}
    </div>
  );
}

function PathDemo() {
  return (
    <Demo name="path" title="Path nodes">
      <div className="flex flex-wrap items-start gap-6 pb-3">
        <Node face="unit">
          <StarGlyph />
        </Node>
        <Node face="unit" crown={<CrownIcon level={2} />}>
          <CheckGlyph />
        </Node>
        <Node face="locked">
          <LockGlyph />
        </Node>
        <Node face="locked">
          <TrophyGlyph />
        </Node>
        <Node face="unit">
          <TrophyGlyph />
        </Node>
        <Node face="gold" crown={<CrownIcon />}>
          <StarGlyph />
        </Node>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <ChestIcon size={80} />
        <ChestIcon size={80} variant="locked" />
        <ChestIcon size={80} variant="open" />
      </div>
    </Demo>
  );
}

const MACAW_KEY = "grid place-items-center bg-macaw text-on-color-fixed shadow-[0_4px_0_var(--c-secondary-lip)]";
const LABEL_DOT = "grid size-6 place-items-center rounded-full text-on-color-fixed";
const FEEDBACK_BADGE = "grid size-20 place-items-center rounded-full bg-badge outline-2";

function LessonDemo() {
  const [playing, setPlaying] = useState(true);
  return (
    <Demo name="lesson" title="Lesson">
      <div className="flex items-center gap-4">
        <CloseIcon className="text-fg-3" />
        <div className="h-4 flex-1 rounded-full bg-track">
          <div className="h-4 w-2/5 rounded-full bg-fill" />
        </div>
        <span className="flex min-w-12 items-center gap-2 text-stat text-heart">
          <HeartIcon size={25} />4
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <span className="flex items-center gap-2 text-label uppercase text-beetle">
          <span className={cn(LABEL_DOT, "bg-beetle")}>
            <SparkleIcon size={14} />
          </span>
          New word
        </span>
        <span className="flex items-center gap-2 text-label uppercase text-fox">
          <span className={cn(LABEL_DOT, "bg-fox")}>
            <RefreshIcon size={16} />
          </span>
          Previous mistake
        </span>
        <span className="flex items-center gap-1 text-caption text-fill-hot">
          <FlameIcon size={14} variant="mono" />6 in a row
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className={cn(MACAW_KEY, "size-[140px] rounded-[20px]")}
        >
          <SpeakerIcon size={70} playing={playing} title={playing ? "Stop" : "Play"} />
        </button>
        <div className={cn(MACAW_KEY, "size-[70px] rounded-lg")}>
          <TurtleIcon size={42} />
        </div>
        <div className={cn(FEEDBACK_BADGE, "text-correct-fg outline-correct-line")}>
          <CheckIcon />
        </div>
        <div className={cn(FEEDBACK_BADGE, "text-wrong-fg outline-wrong-line")}>
          <CrossIcon />
        </div>
      </div>
    </Demo>
  );
}

function LeagueDemo() {
  return (
    <Demo name="leagues" title="League carousel (52 / 80 px) and medals">
      <div className="flex flex-wrap items-center gap-7">
        <LeagueBadge tier={1} />
        <LeagueBadge tier={2} size={80} />
        <LeagueBadge tier={3} locked />
        <LeagueBadge tier={4} locked />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <MedalIcon rank={1} />
        <MedalIcon rank={2} />
        <MedalIcon rank={3} />
        <span className="flex items-center gap-1 text-label uppercase text-correct-fg">
          <ArrowIcon size={16} /> Promotion zone <ArrowIcon size={16} />
        </span>
      </div>
    </Demo>
  );
}

function QuestDemo() {
  const [apart, setApart] = useState(true);
  return (
    <Demo name="quests" title="Quests (40 px), rewards and the broken heart (click it)">
      <div className="flex flex-wrap items-center gap-4">
        <BoltIcon size={40} />
        <BookGlyph size={40} className="text-macaw" />
        <TargetIcon size={40} />
        <FlameIcon size={40} />
        <ChestIcon size={32} />
        <ChestIcon size={32} variant="open" />
        <button type="button" onClick={() => setApart((value) => !value)}>
          <HeartBrokenIcon size={96} apart={apart} title={apart ? "Join the halves" : "Split the halves"} />
        </button>
      </div>
    </Demo>
  );
}

function AchievementDemo() {
  return (
    <Demo name="achievements" title="Achievement tiles" wide>
      <div className="flex flex-wrap items-start gap-3">
        {ACHIEVEMENTS.map((code, i) => (
          <AchievementBadge key={code} code={code} level={i < 7 ? (i % 3) + 1 : 0} maxLevel={i === 2 ? 3 : 10} />
        ))}
        <AchievementBadge code="sage" level={0} />
        <AchievementBadge code="wildfire" level={2} variant="modal" />
        <AchievementBadge code="legendary" level={1} variant="modal" />
      </div>
    </Demo>
  );
}

function ShopDemo() {
  return (
    <Demo name="shop" title="Shop art (96 px) and the legendary trophy (140 px)" wide>
      <div className="flex flex-wrap items-center gap-6">
        <HeartRefillIcon size={96} />
        <UnlimitedHeartIcon size={96} />
        <FreezeIcon size={96} />
        <XpPotionIcon size={96} />
        <GemPileIcon size={96} />
        <GemBowlIcon size={96} />
        <GemChestIcon size={96} />
        <LegendaryTrophyIcon size={140} />
      </div>
    </Demo>
  );
}

/** Light and dark previews of the page, through the same switch Settings uses for its live preview. */
function ThemeSwitch() {
  const { resolvedTheme, previewTheme } = useTheme();
  return (
    <div className="flex gap-2">
      {(["light", "dark"] as const).map((theme) => (
        <button
          key={theme}
          type="button"
          onClick={() => previewTheme(theme)}
          className={cn(
            "h-10 rounded-md border-2 px-4 text-label uppercase",
            resolvedTheme === theme ? "border-line-selected bg-selected text-link" : "border-line text-fg-2",
          )}
        >
          {theme}
        </button>
      ))}
    </div>
  );
}

/** Contact sheet for every icon: three sizes per icon, the artwork in context, light and dark themes. */
export default function IconsKitchenSink() {
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-title-lg text-fg-strong">Icons</h1>
          <p className="text-body text-fg-2">
            Every icon at 20, 32 and 64 px. White glyphs sit on the colour they are drawn for.
          </p>
        </div>
        <ThemeSwitch />
      </header>
      {SECTIONS.map(({ id, title, specimens }) => (
        <Section key={id} id={id} title={title}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
            {specimens.map((specimen) => (
              <SpecimenCard key={specimen.name} {...specimen} />
            ))}
          </div>
        </Section>
      ))}
      <Section id="context" title="In context">
        <div className="grid gap-8 xl:grid-cols-2">
          <StatsDemo />
          <SidebarDemo />
          <PathDemo />
          <LessonDemo />
          <LeagueDemo />
          <QuestDemo />
          <AchievementDemo />
          <ShopDemo />
        </div>
      </Section>
    </main>
  );
}
