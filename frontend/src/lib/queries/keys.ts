/**
 * Query keys. User-scoped data lives under "me", so `["me", "activity"]` invalidates every activity range at
 * once. Invalidate `qk.me` itself with `exact: true`, or every "/me/…" query refetches too.
 */
export const qk = {
  health: ["health"] as const,
  me: ["me"] as const,
  settings: ["me", "settings"] as const,
  activity: (from: string, to: string) => ["me", "activity", from, to] as const,
  path: ["me", "path"] as const,
  league: ["me", "league"] as const,
  quests: ["me", "quests"] as const,
  purchase: (id: number) => ["me", "purchases", id] as const,
  profile: (userId: number | "me") => ["profile", userId] as const,
  courses: ["courses"] as const,
  guidebook: (unitId: number) => ["guidebook", unitId] as const,
  shop: ["shop"] as const,
  session: (id: number) => ["session", id] as const,
  devClock: ["dev", "clock"] as const,
};
