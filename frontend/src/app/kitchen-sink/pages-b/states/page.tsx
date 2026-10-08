"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { GuidebookSkeleton } from "@/features/guidebook/GuidebookSkeleton";
import { ProfileSkeleton } from "@/features/profile/ProfileSkeleton";
import { SettingsSkeleton } from "@/features/settings/SettingsSkeleton";

/** The loading skeletons side by side, and ways to reach the 404 and error pages. */
export default function StatesPreview() {
  const [broken, setBroken] = useState(false);
  return (
    <div className="mx-auto max-w-[1340px] space-y-8 px-4">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/kitchen-sink/pages-b/no-such-page" className="font-extrabold text-link">
          Open the 404 page
        </Link>
        <Button variant="outline" size="sm" onClick={() => setBroken(true)}>
          Show the error page
        </Button>
        {broken && <Explode />}
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        <Frame title="Profile">
          <ProfileSkeleton />
        </Frame>
        <Frame title="Settings">
          <SettingsSkeleton />
        </Frame>
        <Frame title="Guidebook">
          <GuidebookSkeleton />
        </Frame>
      </div>
    </div>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border-2 border-dashed border-line p-4">
      <h2 className="mb-4 text-caption text-fg-3 uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** Throws while rendering, so the app's error page takes over. */
function Explode(): never {
  throw new Error("Preview of the error page");
}
