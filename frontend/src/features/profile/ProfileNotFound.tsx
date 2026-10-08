import { Owl } from "@/components/mascot";
import { ButtonLink } from "@/components/ui";

/** A profile link to a learner who does not exist, shown inside the app frame. */
export function ProfileNotFound() {
  return (
    <section className="mx-auto flex max-w-[420px] flex-col items-center px-4 py-12 text-center">
      <Owl pose="lost" size={200} />
      <h1 className="mt-6 text-title text-fg-strong">We couldn&apos;t find that learner</h1>
      <p className="mt-2 text-body text-fg-2">This profile doesn&apos;t exist or was removed.</p>
      <div className="mt-8 grid w-full max-w-[330px] gap-2">
        <ButtonLink href="/leaderboard" fullWidth>
          Go to leaderboard
        </ButtonLink>
        <ButtonLink href="/learn" variant="ghost" fullWidth>
          Back to learning
        </ButtonLink>
      </div>
      <p className="mt-6 text-caption text-fg-3">Error 404</p>
    </section>
  );
}
