import { PATH_VARIANTS, type PathVariant } from "../path/fixtures";
import { ME_VARIANTS, type MeVariant } from "./fixtures";
import { ShellPreview } from "./ShellPreview";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string>(value: string | undefined, options: Record<T, unknown>, fallback: T): T {
  return value !== undefined && Object.hasOwn(options, value) ? (value as T) : fallback;
}

/**
 * The app frame with fixture data. Query parameters pick the state:
 * `page` (learn, leaderboard, quests, shop, profile, practice, guidebook/2, settings), `me` (seeded, extended,
 * outOfHearts, newcomer, notJoined), `path` (seeded, two, done), `quests=done`, `loading=1`, `result=1` (league
 * result modal) and `controls=1` (a button that plays the next lesson's result on the path).
 */
export default async function ShellKitchenSinkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return (
    <ShellPreview
      page={first(params.page) ?? "learn"}
      meVariant={pick<MeVariant>(first(params.me), ME_VARIANTS, "seeded")}
      pathVariant={pick<PathVariant>(first(params.path), PATH_VARIANTS, "seeded")}
      questsDone={first(params.quests) === "done"}
      loading={first(params.loading) === "1"}
      showResult={first(params.result) === "1"}
      controls={first(params.controls) === "1"}
    />
  );
}
