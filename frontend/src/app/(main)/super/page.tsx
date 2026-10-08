import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/ui";

export const metadata: Metadata = { title: "Super" };

export default function SuperRoute() {
  return <ComingSoonPage feature="Super" />;
}
