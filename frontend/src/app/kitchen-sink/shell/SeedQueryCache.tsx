"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Puts fixture data in the query cache for the few components that read their own data (the streak calendar,
 * the course menu). Their hooks stay disabled outside the wake gate, so nothing is ever fetched here.
 */
export function SeedQueryCache({ entries }: { entries: ReadonlyArray<readonly [QueryKey, unknown]> }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    for (const [key, data] of entries) queryClient.setQueryData(key, data);
  }, [queryClient, entries]);
  return null;
}
