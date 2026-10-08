import { ButtonLink } from "@/components/ui";
import type { GuidebookOut } from "@/lib/api/types";
import { parseMarkdownLite } from "@/lib/markdownLite";
import { BackLink } from "./BackLink";
import { GuidebookHeader } from "./GuidebookHeader";
import { KeyPhrases } from "./KeyPhrases";
import { TipsContent } from "./TipsContent";

/** A unit's guidebook: the unit banner, its key phrases with audio, then its grammar tips. */
export function GuidebookView({ guidebook }: { guidebook: GuidebookOut }) {
  const tips = parseMarkdownLite(guidebook.tipsMd);
  return (
    <article className="mx-auto w-full max-w-[600px] px-4 pt-4 pb-16 lg:px-0 lg:pt-6">
      <BackLink />
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
