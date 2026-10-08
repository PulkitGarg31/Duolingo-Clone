import type { Metadata } from "next";
import { GuidebookNotFound } from "@/features/guidebook/GuidebookNotFound";
import { GuidebookPage } from "@/features/guidebook/GuidebookPage";

export const metadata: Metadata = { title: "Guidebook" };

/**
 * Unit banners link here with the unit's id. Anything but a positive whole number cannot be a unit, so it
 * gets the not-found view straight away; an id the API does not know reaches the same view from the page.
 */
export default async function GuidebookRoute({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  if (!/^[1-9]\d{0,8}$/.test(unitId)) return <GuidebookNotFound />;
  return <GuidebookPage unitId={Number(unitId)} />;
}
