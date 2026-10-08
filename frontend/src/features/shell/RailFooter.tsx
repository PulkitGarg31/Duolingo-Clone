"use client";

import Link from "next/link";
import { DISCLAIMER } from "@/lib/constants";
import { useComingSoon } from "./ComingSoon";

const LINK_CLASSES =
  "cursor-pointer rounded-sm text-[13px] leading-4 font-extrabold tracking-[0.04em] text-fg-3 uppercase hover:text-fg-2 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Placeholder pages behind the footer links, completing "We're still building {feature}". */
const PLACEHOLDER_LINKS = [
  { label: "Help", feature: "the help center" },
  { label: "Terms", feature: "the terms page" },
  { label: "Privacy", feature: "the privacy page" },
] as const;

/** The rail's footer links and the clone disclaimer every page carries. */
export function RailFooter() {
  const showComingSoon = useComingSoon();
  return (
    <footer className="px-2 pb-2">
      <nav aria-label="Footer">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <li>
            <Link href="/welcome" className={LINK_CLASSES}>
              About
            </Link>
          </li>
          {PLACEHOLDER_LINKS.map(({ label, feature }) => (
            <li key={label}>
              <button type="button" className={LINK_CLASSES} onClick={() => showComingSoon(feature)}>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-4 text-center text-[13px] leading-[18px] font-semibold text-fg-3">{DISCLAIMER}</p>
    </footer>
  );
}
