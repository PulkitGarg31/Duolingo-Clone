"use client";

import { useComingSoon } from "@/features/shell/ComingSoon";
import { ErrorState } from "@/features/shell/ErrorState";
import { useHeartActions } from "@/features/stats/useHeartActions";
import { useMe, usePath } from "@/lib/queries/hooks";
import { LegendaryIntroModal } from "./LegendaryIntroModal";
import { NeedHeartsModal } from "./NeedHeartsModal";
import { PathSkeleton } from "./PathSkeleton";
import { PathView } from "./PathView";
import { PendingLeagueResultModal } from "./LeagueResultModal";
import { usePathActions } from "./usePathActions";

/**
 * The /learn page: the path, with the modals its clicks can open, and last week's league result if it has not
 * been seen yet. `focusNodeId` comes from `?focus=` when the lesson player sends the learner back here.
 */
export function LearnScreen({ focusNodeId }: { focusNodeId: number | null }) {
  const me = useMe();
  const path = usePath();
  const actions = usePathActions(me.data?.hearts.current ?? 0);
  const hearts = useHeartActions();
  const showComingSoon = useComingSoon();

  const error = path.error ?? me.error;
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void me.refetch();
          void path.refetch();
        }}
      />
    );
  }
  if (!path.data || !me.data) return <PathSkeleton />;

  return (
    <>
      <PathView
        path={path.data}
        gems={me.data.gems}
        focusNodeId={focusNodeId}
        openNodeId={actions.openNodeId}
        onOpenNodeChange={actions.setOpenNodeId}
        pending={actions.pending}
        onAction={actions.onAction}
        onClaimChest={actions.onClaimChest}
      />
      <LegendaryIntroModal
        open={actions.legendary.open}
        onOpenChange={actions.setLegendaryOpen}
        node={actions.legendary.subject}
        gems={me.data.gems}
        starting={actions.legendaryStarting}
        onStart={actions.startLegendary}
      />
      <NeedHeartsModal
        open={actions.needHeartsOpen}
        onOpenChange={actions.setNeedHeartsOpen}
        hearts={me.data.hearts}
        gems={me.data.gems}
        refilling={hearts.refilling}
        practicing={hearts.practicing}
        onRefill={() => hearts.refill(() => actions.setNeedHeartsOpen(false))}
        onPractice={hearts.practice}
        onUnlimited={() => showComingSoon("Unlimited Hearts")}
      />
      <PendingLeagueResultModal />
    </>
  );
}
