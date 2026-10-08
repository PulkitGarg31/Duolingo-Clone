"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Theme } from "@/lib/api/types";
import { useCachedMe } from "@/lib/queries/hooks";
import { ANIMATIONS_STORAGE_KEY, DARK_SCHEME_QUERY, REDUCED_MOTION_QUERY, THEME_STORAGE_KEY } from "./prePaintScript";

export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The theme painted right now (`html[data-theme]`). */
  resolvedTheme: ResolvedTheme;
  /** Animations are off in Settings or the OS asks for less motion (`html[data-motion]`). */
  reducedMotion: boolean;
  /**
   * Shows a theme before it is saved (the live preview in Settings). Pass null to return to the saved theme,
   * after saving or when leaving the page.
   */
  previewTheme: (theme: Theme | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Keeps `<html data-theme>` and `<html data-motion>` in line with the learner's settings. The settings come
 * from `me` (the server is the source of truth) and are mirrored to localStorage, where the pre-paint script
 * finds them on the next visit. Until `me` has loaded, the remembered values stay in force.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useCachedMe()?.settings;
  const savedTheme = settings?.theme;
  const savedAnimations = settings?.animations;
  const [preview, setPreview] = useState<Theme | null>(null);

  useEffect(() => {
    if (savedTheme) remember(THEME_STORAGE_KEY, savedTheme);
  }, [savedTheme]);

  useEffect(() => {
    if (savedAnimations !== undefined) remember(ANIMATIONS_STORAGE_KEY, String(savedAnimations));
  }, [savedAnimations]);

  useEffect(() => {
    const theme = preview ?? savedTheme ?? rememberedTheme();
    return followMediaQuery(DARK_SCHEME_QUERY, (prefersDark) =>
      setRootAttribute("data-theme", theme === "dark" || (theme === "system" && prefersDark) ? "dark" : "light"),
    );
  }, [preview, savedTheme]);

  useEffect(() => {
    const animations = savedAnimations ?? rememberedAnimations();
    return followMediaQuery(REDUCED_MOTION_QUERY, (prefersReduced) =>
      setRootAttribute("data-motion", !animations || prefersReduced ? "reduced" : "full"),
    );
  }, [savedAnimations]);

  const resolvedTheme = useSyncExternalStore<ResolvedTheme>(subscribeToRootAttributes, readResolvedTheme, () => "light");
  const reducedMotion = useSyncExternalStore(subscribeToRootAttributes, readReducedMotion, () => false);
  const value = useMemo(
    () => ({ resolvedTheme, reducedMotion, previewTheme: setPreview }),
    [resolvedTheme, reducedMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

/** Calls `apply` with the media query's answer now and on every change. Returns the unsubscribe function. */
function followMediaQuery(query: string, apply: (matches: boolean) => void): () => void {
  const media = window.matchMedia(query);
  const onChange = () => apply(media.matches);
  onChange();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function setRootAttribute(name: "data-theme" | "data-motion", value: string): void {
  const root = document.documentElement;
  if (root.getAttribute(name) !== value) root.setAttribute(name, value);
}

/** The attributes are the single source of truth for what is painted, whoever wrote them last. */
function subscribeToRootAttributes(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
  return () => observer.disconnect();
}

function readResolvedTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function readReducedMotion(): boolean {
  return document.documentElement.dataset.motion === "reduced";
}

function rememberedTheme(): Theme {
  const value = recall(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function rememberedAnimations(): boolean {
  return recall(ANIMATIONS_STORAGE_KEY) !== "false";
}

function recall(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the setting still applies for this visit.
  }
}
