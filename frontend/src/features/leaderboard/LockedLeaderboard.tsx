import { LeagueBadge } from "@/components/icons/LeagueBadge";
import { Owl } from "@/components/mascot/Owl";
import { ButtonLink, ProgressBar } from "@/components/ui";
import { unlockMessage, unlockProgress } from "./leagueCopy";

/** Before the tenth finished lesson: a locked shield with the owl peeking out, and how far there is to go. */
export function LockedLeaderboard({ lessonsToUnlock }: { lessonsToUnlock: number }) {
  const { done, total } = unlockProgress(lessonsToUnlock);
  return (
    <section className="flex flex-col items-center px-4 pt-10 pb-12 text-center md:pt-16">
      <div className="relative">
        <Owl pose="idle" size={88} className="absolute -top-7 -right-12 rotate-[18deg]" />
        <LeagueBadge tier={1} locked size={120} className="relative" />
      </div>
      <h1 className="mt-8 text-[22px] leading-[30px] font-extrabold text-fg-strong md:text-title">Unlock Leaderboards!</h1>
      <p className="mt-2 text-body text-fg-2 md:text-subtitle">{unlockMessage(lessonsToUnlock)}</p>
      <ProgressBar
        value={done / total}
        tone="quest"
        height={18}
        label={`${done} / ${total}`}
        aria-label="Lessons completed"
        className="mt-6 max-w-[330px]"
      />
      <ButtonLink href="/learn" variant="secondary" className="mt-8 w-64">
        Start a lesson
      </ButtonLink>
    </section>
  );
}
