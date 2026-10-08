"use client";

import { Nunito } from "next/font/google";
import { useSyncExternalStore } from "react";
import { DARK_SCHEME_QUERY, THEME_STORAGE_KEY } from "@/lib/theme/prePaintScript";
import RootError, { type ErrorPageProps } from "./error";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["600", "800", "900"], variable: "--font-nunito", display: "swap" });

/**
 * Shown when the root layout itself fails. It replaces that layout, so it brings its own document, styles,
 * font and theme, around the same error page as everywhere else.
 */
export default function GlobalError(props: ErrorPageProps) {
  const theme = useRememberedTheme();
  return (
    <html lang="en" className={nunito.variable} data-theme={theme} suppressHydrationWarning>
      <body>
        <RootError {...props} />
      </body>
    </html>
  );
}

function subscribeToColorScheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_SCHEME_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** The theme the learner last saw: their remembered choice, or the device's when it is "system". */
function rememberedTheme(): "light" | "dark" {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage blocked: follow the device.
  }
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? "dark" : "light";
}

function useRememberedTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeToColorScheme, rememberedTheme, () => "light");
}
