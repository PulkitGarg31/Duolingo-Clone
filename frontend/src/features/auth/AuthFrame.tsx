import Link from "next/link";
import type { ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui";

interface AuthFrameProps {
  title: string;
  /** The button in the top-right corner that swaps to the other form (SIGN UP on log in, LOG IN on sign up). */
  switchTo: { label: string; href: string };
  children: ReactNode;
}

/**
 * The log-in and sign-up page frame: a close button top-left back to the welcome page, the swap button
 * top-right, and a narrow centred column with the title. No app frame and no wake gate: the page shows at once,
 * whatever state the server is in.
 */
export function AuthFrame({ title, switchTo, children }: AuthFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-page text-fg">
      <header className="flex items-center justify-between px-4 pt-4 md:px-6 md:pt-6">
        <Link
          href="/welcome"
          aria-label="Close"
          className="grid size-11 place-items-center rounded-full text-fg-3 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
        >
          <CloseIcon size={20} />
        </Link>
        <ButtonLink href={switchTo.href} variant="outline" size="md" className="min-w-[120px]">
          {switchTo.label}
        </ButtonLink>
      </header>
      <main className="mx-auto w-full max-w-[408px] flex-1 px-4 pt-6 pb-12 md:pt-[10vh]">
        <h1 className="mb-6 text-center text-[26px]/8 font-extrabold text-fg-strong">{title}</h1>
        {children}
      </main>
    </div>
  );
}

/** The "or" rule between the form and the other way in. */
export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4" aria-hidden="true">
      <span className="h-0.5 flex-1 bg-line" />
      <span className="text-label text-fg-3 uppercase">or</span>
      <span className="h-0.5 flex-1 bg-line" />
    </div>
  );
}

/** The small print under each form: accounts live on a demo server whose database resets when it restarts. */
export function DemoServerNote() {
  return (
    <p className="mt-8 text-center text-[13px] leading-[18px] font-semibold text-fg-3">
      Accounts live on a free demo server and are erased whenever it restarts. Emails are never verified or
      used to contact you.
    </p>
  );
}
