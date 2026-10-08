"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ComingSoonProvider } from "@/features/shell/ComingSoon";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme/ThemeProvider";

const PREVIEWS = [
  ["profile", "Profile"],
  ["bot-profile", "Bot profile"],
  ["settings", "Settings"],
  ["guidebook", "Guidebook"],
  ["states", "Loading and errors"],
] as const;

/**
 * Preview pages for the profile, settings and guidebook views, rendered from fixtures. Like the app frame,
 * it hosts the Coming soon modal the views open.
 */
export default function PagesBPreviewLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { previewTheme } = useTheme();
  return (
    <ComingSoonProvider>
      <nav className="flex flex-wrap items-center gap-2 border-b-2 border-line px-4 py-3 text-small">
        {PREVIEWS.map(([slug, label]) => (
          <Link
            key={slug}
            href={`/kitchen-sink/pages-b/${slug}`}
            className={cn(
              "rounded-sm px-2 py-1 font-extrabold",
              pathname.endsWith(`/${slug}`) ? "bg-selected text-fg-selected" : "text-fg-2 hover:bg-subtle",
            )}
          >
            {label}
          </Link>
        ))}
        <span className="ml-auto flex gap-2">
          <button type="button" className="font-extrabold text-link" onClick={() => previewTheme("light")}>
            Light
          </button>
          <button type="button" className="font-extrabold text-link" onClick={() => previewTheme("dark")}>
            Dark
          </button>
        </span>
      </nav>
      <main className="py-6">{children}</main>
    </ComingSoonProvider>
  );
}
