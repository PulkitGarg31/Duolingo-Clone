import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Development-only preview pages for primitives and artwork. They render fixture data, never the API, and do
 * not exist in production builds.
 */
export default function KitchenSinkLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <div className="min-h-dvh bg-page text-fg">{children}</div>;
}
