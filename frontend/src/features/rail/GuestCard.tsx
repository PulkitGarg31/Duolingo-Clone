import { ButtonLink } from "@/components/ui";
import { RailCard } from "./RailCard";

/**
 * Duolingo's guest card, for a private demo: its progress lives only in this browser, so the card invites the
 * visitor to an account of their own. A new account starts fresh; the demo's progress is not carried over.
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
