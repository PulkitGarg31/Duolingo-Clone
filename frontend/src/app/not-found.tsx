import { Owl } from "@/components/mascot";
import { ButtonLink } from "@/components/ui";
import { Wordmark } from "@/features/shell/Wordmark";

/** Any unknown URL, and a profile or guidebook that does not exist: the lost owl and a way back. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="px-6 py-5 md:px-10">
        <Wordmark />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <Owl pose="lost" size={200} />
        <h1 className="mt-6 text-[24px] leading-[30px] font-extrabold text-fg-strong md:text-title-lg">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 max-w-[420px] text-body text-fg-2">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <div className="mt-8 grid w-full max-w-[330px] gap-2">
          <ButtonLink href="/learn" fullWidth>
            Back to learning
          </ButtonLink>
          <ButtonLink href="/welcome" variant="ghost" fullWidth>
            About this clone
          </ButtonLink>
        </div>
        <p className="mt-6 text-caption text-fg-3">Error 404</p>
      </main>
    </div>
  );
}
