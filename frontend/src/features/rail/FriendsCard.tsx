"use client";

import { useState } from "react";
import { Owl } from "@/components/mascot";
import { Button, ComingSoonPill, Tabs } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";

type FriendsTab = "following" | "followers";

const TABS = [
  { value: "following", label: "Following" },
  { value: "followers", label: "Followers" },
] as const;

/** The profile rail's friends card. Friends are a placeholder in this app, so both lists are empty. */
export function FriendsCard() {
  const [tab, setTab] = useState<FriendsTab>("following");
  const showComingSoon = useComingSoon();
  return (
    <section aria-label="Friends" className="rounded-lg border-2 border-line bg-page pt-3">
      <Tabs items={TABS} value={tab} onValueChange={setTab} label="Friends" stretch>
        {() => (
          <div className="flex flex-col items-center gap-3 px-4 pt-5 pb-4 text-center">
            <Owl pose="wave" size={96} />
            <p className="text-body text-fg-2">Learning is more fun with friends!</p>
            <ComingSoonPill />
            <Button variant="outline" fullWidth className="mt-1" onClick={() => showComingSoon("friends")}>
              Find friends
            </Button>
          </div>
        )}
      </Tabs>
    </section>
  );
}
