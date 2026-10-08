import type { Metadata } from "next";
import { PracticePage } from "@/features/practice/PracticePage";

export const metadata: Metadata = { title: "Practice" };

export default function PracticeRoute() {
  return <PracticePage />;
}
