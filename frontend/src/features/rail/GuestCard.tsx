import { ButtonLink } from "@/components/ui";
import { RailCard } from "./RailCard";

/**
 * Duolingo's guest card, for the shared demo learner: progress made here belongs to everyone trying the demo,
 * so it invites the visitor to an account of their own.
 */
export function GuestCard({ className }: { className?: string }) {
  return (
    <RailCard title="Create a profile to save your progress!" className={className}>
      <div className="flex flex-col gap-3">
        <ButtonLink href="/signup" fullWidth>
          Create a profile
        </ButtonLink>
        <ButtonLink href="/login" variant="secondary" fullWidth>
          Sign in
        </ButtonLink>
      </div>
    </RailCard>
  );
}
