"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowIcon } from "@/components/icons/ArrowIcon";
import { BoltIcon } from "@/components/icons/BoltIcon";
import { GemIcon } from "@/components/icons/GemIcon";
import { HeartIcon } from "@/components/icons/HeartIcon";
import { LockGlyph } from "@/components/icons/LockGlyph";
import { PersonPlusIcon } from "@/components/icons/PersonPlusIcon";
import { ShareIcon } from "@/components/icons/ShareIcon";
import { SpeakerIcon } from "@/components/icons/SpeakerIcon";
import { TurtleIcon } from "@/components/icons/TurtleIcon";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardButton,
  ComingSoonModal,
  ComingSoonPage,
  ComingSoonPill,
  CountUp,
  Divider,
  HotkeyBadge,
  Input,
  List,
  ListItem,
  Modal,
  Pill,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  ProgressBar,
  ProgressRing,
  Select,
  Sheet,
  Skeleton,
  SkeletonGroup,
  Switch,
  Tabs,
  Tooltip,
  useToast,
  type ButtonVariant,
  type ProgressTone,
} from "@/components/ui";
import { AVATAR_COLORS } from "@/lib/constants";
import { useTheme } from "@/lib/theme/ThemeProvider";

/**
 * The variables a coloured panel sets for `white` buttons and `surface` popovers: its colour, and for light
 * colours a darker ink to write with.
 */
const surface = (color: string, ink?: string) => ({ "--surface": color, "--surface-ink": ink }) as CSSProperties;

const SOLID_VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "danger", "gold", "super"];
const OUTLINE_VARIANTS: readonly ButtonVariant[] = ["outline", "outline-muted", "outline-ink", "ghost", "ghost-danger"];
const PROGRESS_TONES: readonly ProgressTone[] = ["fill", "hot", "fire", "gold", "beetle", "quest"];
const THEME_OPTIONS = [
  { value: "system", label: "System default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;
const DAILY_GOALS = [
  { xp: 10, name: "Casual" },
  { xp: 20, name: "Regular" },
  { xp: 30, name: "Serious" },
  { xp: 50, name: "Intense" },
] as const;
const SETTINGS_SECTIONS = ["Preferences", "Demo tools", "Profile", "Notifications"] as const;
const PEOPLE = [
  { name: "Lucía Fernández", size: 128 },
  { name: "Marco Rossi", size: 56 },
  { name: "Kai", size: 48 },
  { name: "Ana Pérez", size: 40 },
  { name: "Sam Lee", size: 32 },
] as const;

export default function UiKitchenSinkPage() {
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-12 px-4 py-8 md:px-6">
      <PageHeader />
      <ButtonsSection />
      <CardsSection />
      <BadgesSection />
      <ProgressSection />
      <AvatarsSection />
      <FormsSection />
      <TabsAndListsSection />
      <OverlaysSection />
      <ToastsSection />
      <LoadingSection />
      <ComingSoonSection />
    </main>
  );
}

function PageHeader() {
  const { previewTheme } = useTheme();
  const [theme, setTheme] = useState<string>("system");
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.5rem] leading-[1.875rem] font-extrabold text-fg-strong md:text-title-lg">UI primitives</h1>
        <p className="mt-1 text-body text-fg-2">Every variant and state of components/ui, in both themes.</p>
      </div>
      <Select
        aria-label="Theme"
        className="w-[220px]"
        value={theme}
        options={THEME_OPTIONS}
        onValueChange={(next) => {
          setTheme(next);
          previewTheme(next === "light" || next === "dark" ? next : "system");
        }}
      />
    </header>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading text-fg-strong">{title}</h2>
        {note && <p className="text-small text-fg-2">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-fg-3 uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ButtonsSection() {
  const [loading, setLoading] = useState(false);
  return (
    <Section title="Button" note="Hover, press (mouse, Space or Enter) and focus with Tab to see the 3D lip at work.">
      <Row label="Solid">
        {SOLID_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Row>
      <Row label="Outline and ghost">
        {OUTLINE_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Row>
      <Row label="States: rest · pressed · disabled · loading">
        <Button>Check</Button>
        <Button data-pressed="">Check</Button>
        <Button disabled>Check</Button>
        <Button loading>Check</Button>
        <Button variant="outline">Review</Button>
        <Button variant="outline" data-pressed="">
          Review
        </Button>
        <Button variant="outline" disabled>
          Full
        </Button>
        <Button variant="outline" loading>
          Review
        </Button>
        <Button variant="locked">
          <LockGlyph size={16} />
          Locked
        </Button>
      </Row>
      <Row label="With icons">
        <Button variant="outline">
          <GemIcon size={20} />
          350
        </Button>
        <Button variant="outline" className="min-w-[200px]">
          <PersonPlusIcon size={22} />
          Add friends
        </Button>
        <Button variant="secondary" loading={loading} onClick={() => setLoading(true)} onBlur={() => setLoading(false)}>
          Refill hearts
        </Button>
      </Row>
      <Row label="Sizes: key · sm · md · lg · icon · round · inline">
        <Button size="key" variant="outline">
          á
        </Button>
        <Button size="sm" variant="gold">
          Legendary
        </Button>
        <Button size="md">Continue</Button>
        <Button size="lg">Check</Button>
        <Button size="icon" variant="outline-ink" aria-label="Share">
          <ShareIcon size={24} />
        </Button>
        <Button size="round" variant="outline" aria-label="Go to current unit" className="text-link">
          <ArrowIcon direction="down" size={24} />
        </Button>
        <Button size="inline" variant="ghost">
          View all
        </Button>
      </Row>
      <Row label="Speakers: speaker-xl · speaker-slow · speaker-sm">
        <Button size="speaker-xl" variant="secondary" aria-label="Play">
          <SpeakerIcon />
        </Button>
        <Button size="speaker-slow" variant="secondary" aria-label="Play slowly">
          <TurtleIcon />
        </Button>
        <Button size="speaker-sm" variant="secondary" aria-label="Play">
          <SpeakerIcon />
        </Button>
      </Row>
      <Row label="White, on coloured panels">
        {[
          { color: "var(--unit-green)", label: "Start +10 XP" },
          { color: "var(--unit-purple)", label: "Continue" },
          { color: "var(--unit-gold)", ink: "var(--unit-gold-dark)", label: "Practice +5 XP" },
        ].map((panel) => (
          <div
            key={panel.color}
            className="w-[260px] rounded-[15px] p-4"
            style={{ ...surface(panel.color, panel.ink), background: panel.color }}
          >
            <Button variant="white" fullWidth>
              {panel.label}
            </Button>
          </div>
        ))}
      </Row>
      <Row label="Full width and links">
        <div className="grid w-full max-w-[330px] gap-3">
          <ButtonLink href="/kitchen-sink/ui" fullWidth>
            Get started
          </ButtonLink>
          <ButtonLink href="/kitchen-sink/ui" variant="outline" fullWidth>
            I already have an account
          </ButtonLink>
        </div>
      </Row>
    </Section>
  );
}

function CardsSection() {
  const [picked, setPicked] = useState(1);
  return (
    <Section title="Card" note="Static, interactive, selected and checked. Click a tile to select it.">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-card-title text-fg-strong">Daily Quests</h3>
          <p className="mt-1 text-small text-fg-2">A static rail card: 2 px line, 16 px radius.</p>
        </Card>
        <Card interactive padding="lg">
          <h3 className="text-card-title text-fg-strong">Practice to earn hearts</h3>
          <p className="mt-1 text-small text-fg-2">Interactive: lip, hover tint, press.</p>
        </Card>
        <Card padding="sm" className="grid grid-cols-[28px_1fr] gap-x-3">
          <BoltIcon size={28} className="row-span-2" />
          <span className="text-[20px] leading-6 font-extrabold text-fg-strong">1525</span>
          <span className="text-small text-fg-2">Total XP</span>
        </Card>
      </div>
      <div role="radiogroup" aria-label="Pick a word" className="grid max-w-[600px] grid-cols-3 gap-4">
        {["la manzana", "el pan", "el queso"].map((word, index) => (
          <CardButton
            key={word}
            role="radio"
            aria-checked={picked === index}
            tile
            selected={picked === index}
            onClick={() => setPicked(index)}
            className="relative flex aspect-[3/4] items-end justify-center text-exercise"
          >
            <HotkeyBadge tone={picked === index ? "selected" : "idle"} className="absolute top-2.5 left-2.5">
              {index + 1}
            </HotkeyBadge>
            {word}
          </CardButton>
        ))}
      </div>
      <div className="grid max-w-[600px] grid-cols-2 gap-4">
        <CardButton tile status="correct" disabled className="relative min-h-14 text-exercise">
          <HotkeyBadge tone="inherit" className="absolute top-1/2 left-4 -translate-y-1/2">
            1
          </HotkeyBadge>
          hola
        </CardButton>
        <CardButton tile status="incorrect" disabled className="relative min-h-14 text-exercise">
          <HotkeyBadge tone="inherit" className="absolute top-1/2 left-4 -translate-y-1/2">
            2
          </HotkeyBadge>
          adiós
        </CardButton>
      </div>
    </Section>
  );
}

function BadgesSection() {
  return (
    <Section title="Pill, hotkey badge, divider">
      <Row label="Pills">
        <ComingSoonPill />
        <ComingSoonPill short />
        <Pill tone="beetle">Dev</Pill>
        <Pill tone="bee">Perfect</Pill>
        <Pill tone="super">Super</Pill>
      </Row>
      <Row label="Hotkey badges: idle · selected">
        <HotkeyBadge>1</HotkeyBadge>
        <HotkeyBadge tone="selected">2</HotkeyBadge>
        <span className="text-small text-fg-3">(hidden below 700 px and on touch screens)</span>
      </Row>
      <div className="flex max-w-[600px] flex-col gap-4">
        <Divider />
        <div className="flex items-stretch gap-6">
          {["Courses", "Following", "Followers"].map((label, index) => (
            <div key={label} className="flex items-stretch gap-6">
              {index > 0 && <Divider orientation="vertical" />}
              <div>
                <div className="text-[19px] leading-6 font-extrabold text-fg-strong">{index === 0 ? "1" : "0"}</div>
                <div className="text-small text-fg-2">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ProgressSection() {
  return (
    <Section title="Progress bar and ring">
      <div className="grid max-w-[600px] gap-4">
        {PROGRESS_TONES.map((tone, index) => (
          <div key={tone} className="grid grid-cols-[64px_1fr] items-center gap-3">
            <span className="text-caption text-fg-3 uppercase">{tone}</span>
            {tone === "quest" ? (
              <ProgressBar tone="quest" height={18} value={12 / 20} label="12 / 20" />
            ) : (
              <ProgressBar tone={tone} value={0.15 + index * 0.15} aria-label={`${tone} progress`} />
            )}
          </div>
        ))}
        <div className="grid grid-cols-[64px_1fr] items-center gap-3">
          <span className="text-caption text-fg-3 uppercase">empty</span>
          <ProgressBar value={0} aria-label="Empty" />
        </div>
      </div>
      <Row label="Daily-goal ring (0 · 40% · met) and a node ring">
        {[0, 0.4, 1].map((value) => (
          <ProgressRing key={value} value={value} size={32} stroke={2} color="var(--c-xp)" label={`Daily goal ${value * 100}%`}>
            <BoltIcon size={20} />
          </ProgressRing>
        ))}
        <ProgressRing value={2 / 3} size={98} stroke={8} color="var(--unit-green)" />
      </Row>
    </Section>
  );
}

function AvatarsSection() {
  return (
    <Section title="Avatar" note="Initials on the API colour; the dashed placeholder when there is none.">
      <div className="flex flex-wrap items-end gap-4">
        {PEOPLE.map((person, index) => (
          <Avatar key={person.name} name={person.name} size={person.size} color={AVATAR_COLORS[index]} />
        ))}
        <Avatar name="Lucía" size={128} />
        <Avatar name="Lucía" size={48} />
      </div>
    </Section>
  );
}

function FormsSection() {
  const [name, setName] = useState("Lucía");
  const [mode, setMode] = useState("system");
  const [sound, setSound] = useState(true);
  const [animations, setAnimations] = useState(false);
  return (
    <Section title="Input, select, switch">
      <div className="grid max-w-[600px] gap-4">
        <Input aria-label="Display name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input aria-label="Empty field" placeholder="Type in Spanish" />
        <Input aria-label="Email" defaultValue="lucia@" error="Enter a valid email address" />
        <Input aria-label="Read-only" value="lucia_learns" readOnly />
        <Select aria-label="Dark mode" value={mode} onValueChange={setMode} options={THEME_OPTIONS} />
        <Select aria-label="Disabled select" value="system" onValueChange={() => undefined} options={THEME_OPTIONS} disabled />
        <div className="flex flex-col">
          {[
            { label: "Sound effects", checked: sound, onChange: setSound },
            { label: "Animations", checked: animations, onChange: setAnimations },
          ].map((toggle) => (
            <label key={toggle.label} className="flex items-center justify-between border-b-2 border-line py-4">
              <span className="text-body font-extrabold text-fg-strong">{toggle.label}</span>
              <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} />
            </label>
          ))}
          <div className="flex items-center justify-between border-b-2 border-line py-4">
            <span className="flex items-center gap-2 text-body font-extrabold text-fg-strong">
              Speaking exercises <ComingSoonPill />
            </span>
            <Switch checked={false} onCheckedChange={() => undefined} disabled aria-label="Speaking exercises" />
          </div>
        </div>
      </div>
    </Section>
  );
}

function TabsAndListsSection() {
  const [friendsTab, setFriendsTab] = useState<"following" | "followers">("following");
  const [pageTab, setPageTab] = useState<"overview" | "achievements" | "stats">("overview");
  const [goal, setGoal] = useState(20);
  const [sectionName, setSectionName] = useState<string>("Preferences");
  return (
    <Section title="Tabs and list">
      <div className="grid gap-8 md:grid-cols-2">
        <Tabs
          label="Profile sections"
          value={pageTab}
          onValueChange={setPageTab}
          items={[
            { value: "overview", label: "Overview" },
            { value: "achievements", label: "Achievements" },
            { value: "stats", label: "Stats", disabled: true },
          ]}
        />
        <Card padding="none" className="overflow-hidden pt-4">
          <Tabs
            label="Friends"
            stretch
            value={friendsTab}
            onValueChange={setFriendsTab}
            items={[
              { value: "following", label: "Following" },
              { value: "followers", label: "Followers" },
            ]}
          >
            {(tab) => <p className="p-6 text-center text-body text-fg-2">No {tab} yet. Learning is more fun with friends!</p>}
          </Tabs>
        </Card>
        <List aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((name) => (
            <ListItem
              key={name}
              selected={sectionName === name}
              aria-current={sectionName === name ? "page" : undefined}
              onClick={() => setSectionName(name)}
            >
              {name}
            </ListItem>
          ))}
        </List>
        <List role="radiogroup" aria-label="Daily goal">
          {DAILY_GOALS.map((option) => (
            <ListItem
              key={option.xp}
              role="radio"
              aria-checked={goal === option.xp}
              selected={goal === option.xp}
              checkBadge
              detail={`${option.xp} XP per day`}
              onClick={() => setGoal(option.xp)}
            >
              <span className="font-extrabold">{option.name}</span>
            </ListItem>
          ))}
        </List>
      </div>
    </Section>
  );
}

function OverlaysSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [soonOpen, setSoonOpen] = useState(false);
  return (
    <Section title="Tooltip, popover, modal, sheet" note="Modals turn into bottom sheets below 530 px.">
      <Row label="Tooltip and popovers">
        <Tooltip content="Leaderboards">
          <Button variant="outline-ink" id="tooltip-trigger">
            Hover me
          </Button>
        </Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" id="popover-default">
              Gems
            </Button>
          </PopoverTrigger>
          <PopoverContent width={320} className="flex flex-col items-center gap-4 px-4 py-6 text-center" aria-label="Gems">
            <h3 className="text-heading text-fg-strong">Gems</h3>
            <p className="text-body text-fg-2">You have 505 gems</p>
            <PopoverClose asChild>
              <Button variant="outline" fullWidth>
                Go to shop
              </Button>
            </PopoverClose>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline-muted" id="popover-subtle">
              Locked node
            </Button>
          </PopoverTrigger>
          <PopoverContent width={295} tone="subtle" className="p-4" aria-label="Locked lesson">
            <h3 className="text-card-title text-fg-2">Introduce yourself</h3>
            <p className="mt-1 text-body text-fg-3">Complete all levels above to unlock this!</p>
            <Button variant="locked" fullWidth className="mt-4">
              <LockGlyph size={16} />
              Locked
            </Button>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button id="popover-surface">Active node</Button>
          </PopoverTrigger>
          <PopoverContent width={295} tone="surface" style={surface("var(--unit-green)")} className="p-4" aria-label="Lesson">
            <h3 className="text-card-title">Introduce yourself</h3>
            <p className="mt-1 text-body">Lesson 2 of 3</p>
            <PopoverClose asChild>
              <Button variant="white" fullWidth className="mt-4">
                Start +10 XP
              </Button>
            </PopoverClose>
          </PopoverContent>
        </Popover>
      </Row>
      <Row label="Modal and sheets">
        <Button variant="secondary" id="open-modal" onClick={() => setModalOpen(true)}>
          Quit modal
        </Button>
        <Button variant="danger" id="open-confirm" onClick={() => setConfirmOpen(true)}>
          Confirm dialog
        </Button>
        <Button variant="outline" id="open-sheet" onClick={() => setSheetOpen(true)}>
          Bottom sheet
        </Button>
        <Button variant="outline" id="open-dropdown" onClick={() => setDropdownOpen(true)}>
          Top sheet
        </Button>
        <Button variant="outline" id="open-soon" onClick={() => setSoonOpen(true)}>
          Coming soon modal
        </Button>
      </Row>
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Wait, don't go! You'll lose your progress if you quit now"
        actions={
          <>
            <Button variant="secondary" autoFocus onClick={() => setModalOpen(false)}>
              Keep learning
            </Button>
            <Button variant="ghost-danger" onClick={() => setModalOpen(false)}>
              End session
            </Button>
          </>
        }
      />
      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        layout="dialog"
        title="Reset all progress?"
        description="This restores the sample learner to its seeded state."
        actions={
          <>
            <Button variant="danger" onClick={() => setConfirmOpen(false)}>
              Reset
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
          </>
        }
      />
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Hearts">
        <div className="flex justify-center gap-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <HeartIcon key={index} size={32} variant={index < 4 ? "full" : "empty"} />
          ))}
        </div>
        <p className="mt-4 text-center text-body text-fg-2">Swipe the handle down, press Esc or tap outside to close.</p>
        <Button variant="secondary" fullWidth className="mt-6" onClick={() => setSheetOpen(false)}>
          Keep learning
        </Button>
      </Sheet>
      <Sheet open={dropdownOpen} onOpenChange={setDropdownOpen} side="top" title="Daily goal">
        <ProgressBar tone="quest" height={18} value={0.6} label="12 / 20 XP" />
        <p className="mt-4 text-body text-fg-2">Earn 8 more XP to reach your daily goal</p>
      </Sheet>
      <ComingSoonModal open={soonOpen} onOpenChange={setSoonOpen} feature="Stories" />
    </Section>
  );
}

function ToastsSection() {
  const { toast } = useToast();
  return (
    <Section title="Toast" note="Top centre, at most three; hover pauses the timer, a swipe up dismisses on touch.">
      <Row label="Tones">
        <Button variant="outline" id="toast-success" onClick={() => toast({ tone: "success", message: "Settings saved" })}>
          Success
        </Button>
        <Button
          variant="outline"
          id="toast-reward"
          onClick={() =>
            toast({
              tone: "reward",
              icon: <GemIcon size={28} />,
              message: (
                <>
                  <strong className="font-extrabold text-gem">+20 gems</strong> from the chest
                </>
              ),
            })
          }
        >
          Reward
        </Button>
        <Button variant="outline" id="toast-info" onClick={() => toast({ message: "Listening exercises are off for this lesson" })}>
          Info
        </Button>
        <Button variant="outline" id="toast-warning" onClick={() => toast({ tone: "warning", message: "Not enough gems" })}>
          Warning
        </Button>
        <Button
          variant="outline"
          id="toast-error"
          onClick={() =>
            toast({
              tone: "error",
              message: "Couldn't reach the server. Try again.",
              requestId: "a1b2c3",
              action: { label: "Try again", onClick: () => toast({ tone: "success", message: "Back online" }) },
            })
          }
        >
          Error
        </Button>
      </Row>
    </Section>
  );
}

function LoadingSection() {
  const [run, setRun] = useState(0);
  return (
    <Section title="Skeleton and count-up">
      <SkeletonGroup className="grid max-w-[600px] gap-4">
        <Skeleton className="h-[82px] w-full rounded-md" />
        <div className="flex flex-col items-center gap-4">
          {[0, -45, -70, -45, 0].map((offset, index) => (
            <Skeleton key={index} className="h-[57px] w-[70px] rounded-[50%]" style={{ transform: `translateX(${offset}px)` }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-7 w-16 rounded-[14px]" />
          ))}
        </div>
      </SkeletonGroup>
      <Row label="Count-up">
        <Card padding="sm" className="flex min-w-[163px] items-center justify-center gap-2 text-[20px] font-extrabold text-xp-fg">
          <BoltIcon size={20} />
          <CountUp key={`xp-${run}`} value={15} />
        </Card>
        <Card padding="sm" className="flex min-w-[163px] items-center justify-center text-[20px] font-extrabold text-secondary">
          <CountUp key={`time-${run}`} value={102} format={(seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`} />
        </Card>
        <Button variant="outline" onClick={() => setRun((count) => count + 1)}>
          Replay
        </Button>
      </Row>
    </Section>
  );
}

function ComingSoonSection() {
  return (
    <Section title="Coming soon page">
      <Card padding="none">
        <ComingSoonPage feature="Super" />
      </Card>
    </Section>
  );
}
