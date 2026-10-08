"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CompletionSequence } from "@/features/lesson/completion/CompletionSequence";
import { buildCelebrations } from "@/lib/lesson/celebrations";
import { SCENARIO_IDS, SCENARIOS, isScenarioId, type ScenarioId } from "./fixtures";

interface CompletionPreviewProps {
  initialScenario: ScenarioId;
  initialStep: number;
  showControls: boolean;
}

/**
 * Plays a fixture receipt through the real sequence. CONTINUE moves on; after the last step it starts over. Like
 * the lesson player, the preview owns Enter, so a key press works wherever the focus is.
 */
export function CompletionPreview({ initialScenario, initialStep, showControls }: CompletionPreviewProps) {
  const [scenarioId, setScenarioId] = useState(initialScenario);
  const [index, setIndex] = useState(initialStep);
  // Bumped to replay: a new key remounts the sequence, so every screen plays its entrance again.
  const [run, setRun] = useState(0);
  const scenario = SCENARIOS[scenarioId];
  const steps = buildCelebrations(scenario.completion);
  const current = Math.min(index, steps.length - 1);

  function show(stepIndex: number) {
    setIndex(stepIndex);
    setRun((count) => count + 1);
  }

  function next() {
    if (current + 1 < steps.length) setIndex(current + 1);
    else show(0);
  }

  const onEnter = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.repeat) next();
  });
  useEffect(() => {
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, []);

  return (
    <>
      <CompletionSequence
        key={`${scenarioId}-${run}`}
        completion={scenario.completion}
        steps={steps}
        index={current}
        onNext={next}
        reviewItems={scenario.reviewItems}
      />
      {showControls && (
        <aside className="fixed top-3 left-3 z-[600] flex max-w-[calc(100vw-24px)] flex-col gap-2 rounded-lg border-2 border-line bg-page p-3 text-small text-fg shadow-[0_2px_0_var(--c-line)]">
          <select
            aria-label="Scenario"
            value={scenarioId}
            onChange={(event) => {
              if (isScenarioId(event.target.value)) setScenarioId(event.target.value);
              show(0);
            }}
            className="h-9 rounded-md border-2 border-line bg-subtle px-2 font-extrabold text-fg"
          >
            {SCENARIO_IDS.map((id) => (
              <option key={id} value={id}>
                {SCENARIOS[id].label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {steps.map((step, stepIndex) => (
              <Button
                key={`${step.kind}-${stepIndex}`}
                size="sm"
                variant={stepIndex === current ? "secondary" : "outline-ink"}
                onClick={() => show(stepIndex)}
              >
                {`${stepIndex + 1} ${step.kind}`}
              </Button>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
