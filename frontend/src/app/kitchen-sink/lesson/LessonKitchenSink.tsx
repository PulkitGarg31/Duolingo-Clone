"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LessonSkeleton } from "@/features/lesson/LessonSkeleton";
import { DemoPreview, StaticPreview } from "./previews";
import { SCENARIOS, type Scenario } from "./scenarios";

const GROUPS = ["Exercises", "Feedback", "Header", "Coach", "Modals", "System", "Interactive"] as const;

/** Renders only in the browser: the fixtures read the clock, and the modals portal into the page. */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

/**
 * The lesson player's preview page. With `?s=<id>` it shows one scenario full screen, exactly as the route
 * would; without it, an index of every scenario and a gallery of the non-modal ones, each in its own frame.
 */
export function LessonKitchenSink({ scenarioId }: { scenarioId: string | null }) {
  const mounted = useMounted();
  if (!mounted) return null;
  if (scenarioId === "skeleton") return <LessonSkeleton />;
  const scenario = SCENARIOS.find((entry) => entry.id === scenarioId);
  if (scenario) return <ScenarioView scenario={scenario} />;
  return <Gallery />;
}

function ScenarioView({ scenario }: { scenario: Scenario }) {
  if (scenario.demo) return <DemoPreview kind={scenario.demo} />;
  if (!scenario.state) return null;
  return <StaticPreview start={scenario.state()} gems={scenario.gems ?? 820} />;
}

function Gallery() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <h1 className="text-title-lg text-fg-strong">Lesson player</h1>
      <p className="mt-1 text-body text-fg-2">Every exercise, verdict, header, coach slide and modal, from fixture data.</p>
      <nav aria-label="Scenarios" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((group) => (
          <section key={group}>
            <h2 className="text-label text-fg-3 uppercase">{group}</h2>
            <ul className="mt-2 grid gap-1">
              {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => (
                <li key={scenario.id}>
                  <Link href={`?s=${scenario.id}`} className="text-body text-link hover:underline">
                    {scenario.title}
                  </Link>
                </li>
              ))}
              {group === "System" && (
                <li>
                  <Link href="?s=skeleton" className="text-body text-link hover:underline">
                    Loading skeleton
                  </Link>
                </li>
              )}
            </ul>
          </section>
        ))}
      </nav>
      <div className="mt-10 grid gap-10">
        {SCENARIOS.filter((scenario) => !scenario.modal && scenario.state).map((scenario) => (
          <section key={scenario.id} aria-label={scenario.title}>
            <h2 className="mb-2 text-card-title text-fg">
              {scenario.group} · {scenario.title}
            </h2>
            {/* The transform makes the frame the containing block of the player's fixed footer. Frames are inert:
                their autofocused buttons would otherwise pull the page down; open a scenario to interact. */}
            <div inert className="relative h-dvh overflow-hidden rounded-lg border-2 border-line [transform:translateZ(0)]">
              <ScenarioView scenario={scenario} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
