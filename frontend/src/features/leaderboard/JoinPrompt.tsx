import { Owl } from "@/components/mascot/Owl";
import { ButtonLink } from "@/components/ui";

/** Unlocked, but no XP yet this week: the learner joins a cohort with their first lesson. */
export function JoinPrompt() {
  return (
    <section className="flex flex-col items-center px-4 pt-10 pb-12 text-center">
      <Owl pose="think" size={140} />
      <p className="mt-6 max-w-[420px] text-body text-fg-2 md:text-subtitle">
        Complete a lesson to join this week&apos;s leaderboard and compete against other learners
      </p>
      <ButtonLink href="/learn" variant="secondary" className="mt-8 w-64">
        Start a lesson
      </ButtonLink>
    </section>
  );
}
