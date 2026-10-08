"use client";

import { notFound } from "next/navigation";
import { isApiError } from "@/lib/api/errors";
import { useGuidebook } from "@/lib/queries/hooks";
import { GuidebookSkeleton } from "./GuidebookSkeleton";
import { GuidebookView } from "./GuidebookView";

/**
 * `/guidebook/[unitId]`, opened from a unit banner's GUIDEBOOK button. An unknown unit is a 404; any other
 * failure goes to the route's error boundary, whose TRY AGAIN refetches.
 */
export function GuidebookPage({ unitId }: { unitId: number }) {
  const guidebook = useGuidebook(unitId);
  if (guidebook.data) return <GuidebookView guidebook={guidebook.data} />;
  if (isApiError(guidebook.error, "NOT_FOUND")) notFound();
  if (guidebook.error) throw guidebook.error;
  return <GuidebookSkeleton />;
}
