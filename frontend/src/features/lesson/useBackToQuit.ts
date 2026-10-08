"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * The browser's back button asks before leaving a lesson. A copy of the current history entry is pushed on
 * top, so "back" lands on the same page; the copy is put back and `onBack` decides what happens (open the
 * quit modal, or leave once the lesson is over).
 */
export function useBackToQuit(onBack: () => void): void {
  const handleBack = useEffectEvent(onBack);
  useEffect(() => {
    window.history.pushState(window.history.state, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(window.history.state, "", window.location.href);
      handleBack();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
