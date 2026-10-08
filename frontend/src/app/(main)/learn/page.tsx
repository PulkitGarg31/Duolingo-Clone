import type { Metadata } from "next";
import { LearnScreen } from "@/features/path/LearnScreen";
import { parseFocusParam } from "@/features/path/focusParam";

export const metadata: Metadata = { title: "Learn" };

interface LearnPageProps {
  searchParams: Promise<{ focus?: string | string[] }>;
}

/** The learning path. `?focus=` names the node to scroll to after a lesson. */
export default async function LearnPage({ searchParams }: LearnPageProps) {
  const { focus } = await searchParams;
  return <LearnScreen focusNodeId={parseFocusParam(focus)} />;
}
