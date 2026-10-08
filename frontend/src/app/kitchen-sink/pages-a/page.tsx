import Link from "next/link";

const PREVIEWS = [
  { href: "/kitchen-sink/pages-a/leaderboard", title: "Leaderboard", note: "Standings, zones, locked and not joined" },
  { href: "/kitchen-sink/pages-a/quests", title: "Quests", note: "Daily goal, quest progress, all done" },
  { href: "/kitchen-sink/pages-a/shop", title: "Shop", note: "Prices, full, equipped, a running boost, too few gems" },
  { href: "/kitchen-sink/pages-a/practice", title: "Practice", note: "Earn hearts, Timed practice and Legendary intros" },
] as const;

/** Index of the page previews for the leaderboard, quests, shop and practice hub. */
export default function PagesKitchenSinkIndex() {
  return (
    <main className="mx-auto max-w-[592px] px-4 py-10">
      <h1 className="text-title-lg text-fg-strong">Pages</h1>
      <ul className="mt-6 grid gap-3">
        {PREVIEWS.map(({ href, title, note }) => (
          <li key={href}>
            <Link href={href} className="block rounded-lg border-2 border-line px-5 py-4 hover:bg-subtle">
              <span className="block text-card-title text-fg">{title}</span>
              <span className="mt-1 block text-body text-fg-2">{note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
