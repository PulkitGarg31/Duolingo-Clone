import type { QueryKey } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { ACTIVITY_OCTOBER, ACTIVITY_OCTOBER_EXTENDED, ACTIVITY_SEPTEMBER, COURSES } from "./fixtures";

type SeedEntries = ReadonlyArray<readonly [QueryKey, unknown]>;

/** The calendar's two months and the course list, as the stats popovers request them. */
export const SEEDED_LEAF_DATA: SeedEntries = [
  [qk.activity(ACTIVITY_OCTOBER.from, ACTIVITY_OCTOBER.to), ACTIVITY_OCTOBER],
  [qk.activity(ACTIVITY_SEPTEMBER.from, ACTIVITY_SEPTEMBER.to), ACTIVITY_SEPTEMBER],
  [qk.courses, COURSES],
];

/** The same, once today's lesson has extended the streak. */
export const EXTENDED_LEAF_DATA: SeedEntries = [
  [qk.activity(ACTIVITY_OCTOBER_EXTENDED.from, ACTIVITY_OCTOBER_EXTENDED.to), ACTIVITY_OCTOBER_EXTENDED],
  [qk.activity(ACTIVITY_SEPTEMBER.from, ACTIVITY_SEPTEMBER.to), ACTIVITY_SEPTEMBER],
  [qk.courses, COURSES],
];
