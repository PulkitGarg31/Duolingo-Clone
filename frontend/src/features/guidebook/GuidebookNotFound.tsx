import { Owl } from "@/components/mascot";
import { ButtonLink } from "@/components/ui";

/** A guidebook link to a unit that does not exist, shown inside the app frame. */
export function GuidebookNotFound() {
  return (
    <section className="mx-auto flex max-w-[420px] flex-col items-center px-4 py-12 text-center">
      <Owl pose="lost" size={200} />
      <h1 className="mt-6 text-title text-fg-strong">We couldn&apos;t find that guidebook</h1>
      <p className="mt-2 text-body text-fg-2">This unit doesn&apos;t exist. Every unit&apos;s guidebook opens from its banner on the path.</p>
      <div className="mt-8 grid w-full max-w-[330px]">
        <ButtonLink href="/learn" fullWidth>
          Back to learning
        </ButtonLink>
      </div>
      <p className="mt-6 text-caption text-fg-3">Error 404</p>
    </section>
  );
}
