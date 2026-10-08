import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPlayer } from "@/features/lesson/LessonPlayer";

export const metadata: Metadata = { title: "Lesson" };

/** The only lesson route, for every kind of session; sessions are always started by a click elsewhere. */
export default async function LessonPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const id = Number(sessionId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  // Keyed, so moving to another session (TRY AGAIN after a failed Legendary run) starts a fresh player.
  return <LessonPlayer key={id} sessionId={id} />;
}
