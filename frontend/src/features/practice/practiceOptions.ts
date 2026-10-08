import { domainErrorMessage } from "@/features/shell/domainErrorMessage";
import type { ApiError, ApiErrorCode } from "@/lib/api/errors";
import type { HeartsOut, PathNodeOut, PathOut, PathUnitOut } from "@/lib/api/types";

/** Whether a practice card can be used, and the line it shows: its pitch, or why it is off. */
export interface PracticeAvailability {
  enabled: boolean;
  note: string;
}

const LOCKED_NOTE = "Complete a lesson to unlock practice";

/** Practice and Timed practice draw on finished lessons, so they need at least one (the server's rule too). */
export function hasCompletedLesson(path: PathOut): boolean {
  return path.units.some((unit) => unit.nodes.some((node) => node.lessonsCompleted > 0));
}

/** "Practice to earn hearts" is a global practice session, which pays one heart back. */
export function earnHeartsAvailability(path: PathOut, hearts: HeartsOut): PracticeAvailability {
  if (!hasCompletedLesson(path)) return { enabled: false, note: LOCKED_NOTE };
  if (hearts.current >= hearts.max) return { enabled: false, note: "You have full hearts" };
  return { enabled: true, note: "+1 heart" };
}

export function timedAvailability(path: PathOut): PracticeAvailability {
  return hasCompletedLesson(path) ? { enabled: true, note: "Race the clock to earn XP" } : { enabled: false, note: LOCKED_NOTE };
}

export interface LegendarySkill {
  node: PathNodeOut;
  unit: PathUnitOut;
}

/** Finished skills in path order: the completed ones can be played as Legendary, the gold ones already were. */
export function legendarySkills(path: PathOut): LegendarySkill[] {
  return path.units.flatMap((unit) =>
    unit.nodes
      .filter((node) => node.kind === "skill" && (node.state === "completed" || node.state === "legendary"))
      .map((node) => ({ node, unit })),
  );
}

const START_ERRORS: Partial<Record<ApiErrorCode, string>> = {
  NOTHING_TO_PRACTICE: LOCKED_NOTE,
  INSUFFICIENT_GEMS: "Not enough gems",
  ALREADY_LEGENDARY: "This lesson is currently unavailable",
  NODE_LOCKED: "This lesson is currently unavailable",
  NODE_NOT_PLAYABLE: "This lesson is currently unavailable",
};

/**
 * The toast for a session that could not start. Null when the app-wide toast already covers the failure (an
 * unreachable server or a server bug), so the learner never sees two.
 */
export function startErrorMessage(error: ApiError): string | null {
  return domainErrorMessage(error, START_ERRORS);
}
