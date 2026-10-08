import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/constants";
import { prePaintScript } from "@/lib/theme/prePaintScript";
import "./globals.css";
import { Providers } from "./providers";

// 600 is the regular UI weight, 800 the bold one and 900 the display one (Nunito draws lighter than the
// rounded face it stands in for, so each role steps up a weight). 700 is deliberately absent: a stray
// `font-bold` then resolves to 800, the bold UI weight.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Learn Spanish with bite-size lessons, daily streaks and weekly leagues.",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets fixed bars pad themselves with env(safe-area-inset-*) on notched phones.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#131F24" },
  ],
};

/**
 * The static shell: fonts, metadata and the pre-paint script. Pages fetch their data on the client, so this
 * renders instantly even while the API sleeps. `data-theme` and `data-motion` on <html> are written by the
 * pre-paint script before the first paint (hence suppressHydrationWarning) and kept current by ThemeProvider.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={nunito.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prePaintScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
