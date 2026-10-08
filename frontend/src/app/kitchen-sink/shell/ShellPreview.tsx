"use client";

import { PathSkeleton } from "@/features/path/PathSkeleton";
import { AppShellView } from "@/features/shell/AppShellView";
import { LearnPreview } from "../path/LearnPreview";
import { PATH_VARIANTS, type PathVariant } from "../path/fixtures";
import { ME_VARIANTS, QUESTS, QUESTS_DONE, type MeVariant } from "./fixtures";
import { SeedQueryCache } from "./SeedQueryCache";
import { EXTENDED_LEAF_DATA, SEEDED_LEAF_DATA } from "./seedEntries";

export interface ShellPreviewProps {
  /** The page whose right rail to show, e.g. "learn" or "profile". */
  page: string;
  meVariant: MeVariant;
  pathVariant: PathVariant;
  questsDone: boolean;
  /** Nothing has loaded yet: the frame shows its placeholders. */
  loading: boolean;
  showResult: boolean;
  controls: boolean;
}

/** The app frame on fixture data, with the path (or a stand-in for another page) inside. */
export function ShellPreview({ page, meVariant, pathVariant, questsDone, loading, showResult, controls }: ShellPreviewProps) {
  const me = loading ? undefined : ME_VARIANTS[meVariant];
  const quests = loading ? undefined : questsDone ? QUESTS_DONE : QUESTS;
  return (
    <>
      <SeedQueryCache entries={meVariant === "extended" ? EXTENDED_LEAF_DATA : SEEDED_LEAF_DATA} />
      <AppShellView pathname={`/${page}`} me={me} quests={quests}>
        {page !== "learn" ? (
          <OtherPage name={page} />
        ) : me ? (
          <LearnPreview me={me} initialPath={PATH_VARIANTS[pathVariant]} showResult={showResult} controls={controls} />
        ) : (
          <PathSkeleton />
        )}
      </AppShellView>
    </>
  );
}

/** A stand-in for pages built elsewhere, so the frame and the page's rail stack can be checked. */
function OtherPage({ name }: { name: string }) {
  return (
    <div className="px-4 pt-6 lg:px-0">
      <div className="grid h-[480px] place-items-center rounded-lg border-2 border-dashed border-line">
        <p className="text-title text-fg-3 capitalize">{name} page</p>
      </div>
    </div>
  );
}
