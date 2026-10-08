"use client";

import type { ReactNode } from "react";
import { FlagIcon, PencilIcon, PersonPlusIcon, SettingsIcon, ShareIcon } from "@/components/icons";
import { Avatar, Button, ButtonLink, Divider } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import type { CourseBrief, ProfileUser } from "@/lib/api/types";
import { formatMonthYear } from "@/lib/format";

/** Completes "We're still building {feature}" for every friends entry point. */
const FRIENDS = "the friends list";

interface ProfileHeaderProps {
  user: ProfileUser;
  course: CourseBrief;
}

/**
 * The top of a profile: the avatar panel, the name with "@username · Joined {Month} {Year}", the course,
 * following and followers counts, and the friend actions. There is no social graph, so both counts are 0
 * and every friends control opens Coming soon.
 */
export function ProfileHeader({ user, course }: ProfileHeaderProps) {
  const showComingSoon = useComingSoon();
  return (
    <header>
      <AvatarPanel user={user} onEdit={() => showComingSoon("profile editing")} />
      <div className="px-4 lg:px-0">
        <h1 className="mt-6 text-[24px]/[30px] font-extrabold text-fg-strong md:text-title-lg">
          {user.displayName}
        </h1>
        <p className="mt-1 text-body text-fg-2">
          @{user.username} · Joined {formatMonthYear(user.joinedAt)}
        </p>
        <div className="mt-5 flex">
          <Stat label="Courses">
            <FlagIcon code={course.flagKey} size={32} title={course.title} />
          </Stat>
          <Divider orientation="vertical" className="mx-5" />
          <Stat label="Following" onSelect={() => showComingSoon(FRIENDS)}>
            0
          </Stat>
          <Divider orientation="vertical" className="mx-5" />
          <Stat label="Followers" onSelect={() => showComingSoon(FRIENDS)}>
            0
          </Stat>
        </div>
        {user.isMe ? (
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => showComingSoon(FRIENDS)}>
              <PersonPlusIcon size={22} />
              Add friends
            </Button>
            <Button variant="outline" size="icon" aria-label="Share profile" onClick={() => showComingSoon("profile sharing")}>
              <ShareIcon size={24} />
            </Button>
          </div>
        ) : (
          <Button variant="secondary" fullWidth className="mt-6" onClick={() => showComingSoon(FRIENDS)}>
            <PersonPlusIcon size={22} />
            Follow
          </Button>
        )}
      </div>
    </header>
  );
}

/** The light-blue panel with the avatar. The learner's own panel adds edit (desktop) or settings (phones). */
function AvatarPanel({ user, onEdit }: { user: ProfileUser; onEdit: () => void }) {
  return (
    <div className="relative flex h-[160px] items-center justify-center bg-selected lg:h-[200px] lg:rounded-lg">
      <Avatar name={user.displayName} color={user.avatarColor} size={128} />
      {user.isMe && (
        <div className="absolute top-4 right-4">
          {/* Phones have no MORE menu, so this gear is their way into Settings. */}
          <div className="lg:hidden">
            <ButtonLink href="/settings" variant="outline-ink" size="icon" aria-label="Settings">
              <SettingsIcon size={24} />
            </ButtonLink>
          </div>
          <div className="hidden lg:block">
            <Button variant="outline-ink" size="icon" aria-label="Edit profile" onClick={onEdit}>
              <PencilIcon size={22} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatProps {
  label: string;
  /** Makes the count a button (it opens Coming soon). */
  onSelect?: () => void;
  children: ReactNode;
}

/** One column of the courses / following / followers row: the value (or flag) above its label. */
function Stat({ label, onSelect, children }: StatProps) {
  const content = (
    <>
      <span className="flex h-6 items-center text-card-title text-fg-strong tabular-nums">{children}</span>
      <span className="text-small text-fg-2">{label}</span>
    </>
  );
  if (!onSelect) return <div className="flex flex-col gap-1">{content}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex cursor-pointer flex-col gap-1 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      {content}
    </button>
  );
}
