"use client";

import { useEffect, useRef, useState } from "react";
import { GemIcon } from "@/components/icons";
import { Button, useToast } from "@/components/ui";
import { LeagueResultModal } from "@/features/path/LeagueResultModal";
import { LegendaryIntroModal } from "@/features/path/LegendaryIntroModal";
import { NeedHeartsModal } from "@/features/path/NeedHeartsModal";
import type { NodeActionKind, PendingNodeAction } from "@/features/path/nodePopoverModel";
import { PathView } from "@/features/path/PathView";
import type { MeOut, PathNodeOut, PathOut } from "@/lib/api/types";
import { PATH, PATH_DRINKS_DONE, PATH_DRINKS_TWO } from "./fixtures";

/** The path through one lesson after another, for watching the return-from-lesson animations. */
const LESSON_STEPS: readonly PathOut[] = [PATH, PATH_DRINKS_TWO, PATH_DRINKS_DONE];

/** How long a pretend session start shows its loading button. */
const PRETEND_REQUEST_MS = 1_200;

interface LearnPreviewProps {
  me: MeOut;
  initialPath: PathOut;
  /** Opens last week's league result on load. */
  showResult?: boolean;
  /** Shows a button that plays the next lesson's result on the path. */
  controls?: boolean;
}

/**
 * The /learn page on fixture data: the real path view and modals, with every server call replaced by a toast
 * and a little local state (a chest opens, starting shows its loading button).
 */
export function LearnPreview({ me, initialPath, showResult = false, controls = false }: LearnPreviewProps) {
  const { toast } = useToast();
  const [path, setPath] = useState(initialPath);
  const [openNodeId, setOpenNodeId] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingNodeAction | null>(null);
  const [legendaryNode, setLegendaryNode] = useState<PathNodeOut | null>(null);
  const [legendaryOpen, setLegendaryOpen] = useState(false);
  const [needHeartsOpen, setNeedHeartsOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(showResult);
  const [lessonStep, setLessonStep] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function pretendToStart(node: PathNodeOut, kind: NodeActionKind) {
    setPending({ nodeId: node.id, kind });
    timer.current = setTimeout(() => {
      setPending(null);
      setOpenNodeId(null);
      toast({ tone: "info", message: `A ${kind} session on "${node.title}" would start here.` });
    }, PRETEND_REQUEST_MS);
  }

  function onAction(node: PathNodeOut, kind: NodeActionKind) {
    if (kind === "legendary") {
      setOpenNodeId(null);
      setLegendaryNode(node);
      setLegendaryOpen(true);
    } else if (kind === "lesson" && me.hearts.current === 0) {
      setOpenNodeId(null);
      setNeedHeartsOpen(true);
    } else {
      pretendToStart(node, kind);
    }
  }

  function onClaimChest(chest: PathNodeOut) {
    setPath((current) => ({
      ...current,
      units: current.units.map((unit) => ({
        ...unit,
        nodes: unit.nodes.map((candidate) => (candidate.id === chest.id ? { ...candidate, state: "completed" } : candidate)),
      })),
    }));
    toast({ tone: "reward", icon: <GemIcon size={28} />, message: `+${chest.chestGems ?? 0} gems` });
  }

  function playNextLesson() {
    const next = (lessonStep + 1) % LESSON_STEPS.length;
    setLessonStep(next);
    setPath(LESSON_STEPS[next]);
  }

  return (
    <>
      <PathView
        path={path}
        gems={me.gems}
        focusNodeId={null}
        openNodeId={openNodeId}
        onOpenNodeChange={setOpenNodeId}
        pending={pending}
        onAction={onAction}
        onClaimChest={onClaimChest}
      />
      {controls && (
        <div className="fixed top-20 right-4 z-(--z-dev) lg:top-4">
          <Button size="sm" variant="secondary" onClick={playNextLesson}>
            Play next lesson
          </Button>
        </div>
      )}
      <LegendaryIntroModal
        open={legendaryOpen}
        onOpenChange={setLegendaryOpen}
        node={legendaryNode}
        gems={me.gems}
        starting={false}
        onStart={() => {
          setLegendaryOpen(false);
          toast({ tone: "info", message: "A Legendary session would start here." });
        }}
      />
      <NeedHeartsModal
        open={needHeartsOpen}
        onOpenChange={setNeedHeartsOpen}
        hearts={me.hearts}
        gems={me.gems}
        refilling={false}
        practicing={false}
        onRefill={() => setNeedHeartsOpen(false)}
        onPractice={() => toast({ tone: "info", message: "A practice session would start here." })}
        onUnlimited={() => toast({ tone: "info", message: "Unlimited Hearts is coming soon." })}
      />
      <LeagueResultModal result={me.pendingLeagueResult} open={resultOpen} onContinue={() => setResultOpen(false)} />
    </>
  );
}
