import { BookGlyph } from "@/components/icons/BookGlyph";
import { DumbbellGlyph } from "@/components/icons/DumbbellGlyph";
import { HeartIcon } from "@/components/icons/HeartIcon";
import { RefreshIcon } from "@/components/icons/RefreshIcon";
import { StopwatchIcon } from "@/components/icons/StopwatchIcon";
import type { MeOut, PathNodeOut, PathOut } from "@/lib/api/types";
import { ComingSoonPracticeCard } from "./ComingSoonPracticeCard";
import { GlyphTile } from "./GlyphTile";
import { LegendaryCard } from "./LegendaryCard";
import { MicrophoneGlyph } from "./MicrophoneGlyph";
import { PracticeCard } from "./PracticeCard";
import { earnHeartsAvailability, legendarySkills, timedAvailability } from "./practiceOptions";

export interface PracticeHubProps {
  me: MeOut;
  path: PathOut;
  /** A practice session is being created for "Practice to earn hearts". */
  practiceStarting: boolean;
  onEarnHearts: () => void;
  /** Opens the Timed practice intro; the session is created only from there. */
  onTimed: () => void;
  /** Opens the Legendary intro for a finished skill. */
  onLegendary: (node: PathNodeOut) => void;
}

/** The blue dumbbell tile with a heart on its corner: practice that pays a heart back. */
function EarnHeartsPicture() {
  return (
    <>
      <GlyphTile color="blue">
        <DumbbellGlyph size={40} />
      </GlyphTile>
      <HeartIcon size={28} className="absolute -right-2 -bottom-2" />
    </>
  );
}

/** /practice: earn hearts, Timed practice, Legendary challenges and the modes still to come. */
export function PracticeHub({ me, path, practiceStarting, onEarnHearts, onTimed, onLegendary }: PracticeHubProps) {
  const earnHearts = earnHeartsAvailability(path, me.hearts);
  const timed = timedAvailability(path);
  return (
    <div className="mx-auto w-full max-w-[592px] px-4 pt-6 pb-12 lg:px-0">
      <h1 className="text-[24px]/[30px] font-extrabold text-fg-strong md:text-title-lg">Practice</h1>
      <p className="mt-1 text-body text-fg-2 md:text-subtitle">Review what you&apos;ve learned and earn hearts</p>
      <div className="mt-6 grid grid-cols-1 gap-4">
        <PracticeCard
          icon={<EarnHeartsPicture />}
          title="Practice to earn hearts"
          note={earnHearts.note}
          disabled={!earnHearts.enabled}
          busy={practiceStarting}
          onClick={onEarnHearts}
        />
        <PracticeCard
          icon={
            <GlyphTile color="purple">
              <StopwatchIcon size={38} />
            </GlyphTile>
          }
          title="Timed practice"
          note={timed.note}
          disabled={!timed.enabled}
          onClick={onTimed}
        />
        <LegendaryCard skills={legendarySkills(path)} gems={me.gems} onLegendary={onLegendary} />
        <ComingSoonPracticeCard
          icon={
            <GlyphTile color="orange">
              <RefreshIcon size={38} />
            </GlyphTile>
          }
          title="Mistakes review"
          note="Practice the exercises you got wrong"
          feature="Mistakes review"
        />
        <ComingSoonPracticeCard
          icon={
            <GlyphTile color="green">
              <BookGlyph size={38} />
            </GlyphTile>
          }
          title="Stories"
          note="Read short stories in Spanish"
          feature="Stories"
        />
        <ComingSoonPracticeCard
          icon={
            <GlyphTile color="red">
              <MicrophoneGlyph size={38} />
            </GlyphTile>
          }
          title="Speaking"
          note="Say words and sentences out loud"
          feature="speaking practice"
        />
      </div>
    </div>
  );
}
