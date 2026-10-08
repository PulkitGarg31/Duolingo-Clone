import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui";
import type { GuidebookOut } from "@/lib/api/types";
import { parseMarkdownLite } from "@/lib/markdownLite";
import { GuidebookHeader } from "./GuidebookHeader";
import { KeyPhrases } from "./KeyPhrases";
import { TipsContent } from "./TipsContent";

/** A unit's guidebook: the unit banner, its key phrases with audio, then its grammar tips. */
export function GuidebookView({ guidebook }: { guidebook: GuidebookOut }) {
  const tips = parseMarkdownLite(guidebook.tipsMd);
  return (
    <article className="mx-auto w-full max-w-[600px] px-4 pt-4 pb-16 lg:px-0 lg:pt-6">
      <div className="border-b-2 border-line pb-3">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 rounded-sm text-label text-fg-3 uppercase hover:text-fg-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        >
          <ChevronIcon direction="left" size={18} />
          Back
        </Link>
      </div>
      <GuidebookHeader unit={guidebook.unit} />
      <KeyPhrases phrases={guidebook.keyPhrases} locale={guidebook.ttsLocale} />
      {tips.length > 0 && <TipsContent blocks={tips} />}
      <div className="mt-12 flex justify-center">
        <ButtonLink href="/learn" variant="secondary" className="w-full sm:w-[330px]">
          Back to learning
        </ButtonLink>
      </div>
    </article>
  );
}
