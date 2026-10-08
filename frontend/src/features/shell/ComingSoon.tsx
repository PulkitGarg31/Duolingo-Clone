"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ComingSoonModal } from "@/components/ui";

/** Opens the Coming soon modal for a feature, completing "We're still building {feature}". */
type ShowComingSoon = (feature: string) => void;

const ComingSoonContext = createContext<ShowComingSoon | null>(null);

/**
 * One Coming soon modal for everything inside the app frame: placeholder links in the menus, the rail cards
 * and the stats popovers all open it instead of leading nowhere.
 */
export function ComingSoonProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing, so the copy does not change while the modal fades out.
  const [feature, setFeature] = useState("");

  const show = useCallback((name: string) => {
    setFeature(name);
    setOpen(true);
  }, []);

  return (
    <ComingSoonContext value={show}>
      {children}
      <ComingSoonModal open={open} onOpenChange={setOpen} feature={feature} />
    </ComingSoonContext>
  );
}

export function useComingSoon(): ShowComingSoon {
  const show = useContext(ComingSoonContext);
  if (!show) throw new Error("useComingSoon must be used inside <ComingSoonProvider>");
  return show;
}
