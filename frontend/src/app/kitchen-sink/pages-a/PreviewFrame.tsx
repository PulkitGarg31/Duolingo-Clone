"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ComingSoonProvider } from "@/features/shell/ComingSoon";
import { cn } from "@/lib/cn";

/** The extra state every preview offers: the page's loading skeleton. */
export const LOADING_STATE = "loading";

interface PreviewFrameProps {
  title: string;
  /** The fixture states this preview can show, each reachable as `?state=<name>`. */
  states: readonly string[];
  current: string;
  /** What the page shows while its data loads, for the "loading" state. */
  skeleton: ReactNode;
  /** Extra controls next to the state links. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The app's main column around a page view, with plain stand-ins for the shell's phone top bar and tablet
 * stats header, so the views' sticky parts settle where they will in the app. Like the app frame, it hosts
 * the Coming soon modal.
 */
export function PreviewFrame({ title, states, current, skeleton, actions, children }: PreviewFrameProps) {
  return (
    <ComingSoonProvider>
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-(--z-topbar) h-(--topbar-h) border-b-2 border-line bg-page lg:hidden" />
      <div className="pt-(--topbar-h) lg:pt-0">
        <nav aria-label="Preview states" className="mx-auto flex max-w-[1064px] flex-wrap items-center gap-2 px-4 py-4 lg:px-6">
          <h1 className="mr-2 text-heading text-fg-strong">{title}</h1>
          {[...states, LOADING_STATE].map((state) => (
            <Link
              key={state}
              href={{ query: { state } }}
              replace
              scroll={false}
              className={cn(
                "rounded-md border-2 px-3 py-1.5 text-label uppercase",
                state === current ? "border-line-selected bg-selected text-link" : "border-line text-fg-2 hover:bg-subtle",
              )}
            >
              {state}
            </Link>
          ))}
          {actions}
        </nav>
        <main className="mx-auto max-w-[1064px] pb-24 lg:px-6">
          <div className="mx-auto max-w-[600px]">
            <div aria-hidden="true" className="sticky top-0 z-(--z-sticky) hidden h-16 border-b-2 border-line bg-page lg:block xl:hidden" />
            {current === LOADING_STATE ? skeleton : children}
          </div>
        </main>
      </div>
    </ComingSoonProvider>
  );
}

/**
 * The state named in the URL: "loading", one of the fixture states, or the first fixture state when the URL
 * names none or an unknown one.
 */
export function pickState<T extends Record<string, unknown>>(states: T, requested: string | undefined) {
  const names = Object.keys(states);
  const fixture = (requested && names.includes(requested) ? requested : names[0]) as keyof T & string;
  return { fixture, current: requested === LOADING_STATE ? LOADING_STATE : fixture };
}
