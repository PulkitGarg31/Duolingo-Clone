import type { CSSProperties } from "react";
import type { UnitColor } from "@/lib/api/types";

/** Inline styles that may also set CSS custom properties. */
export type CssVariables = CSSProperties & { [name: `--${string}`]: string };

/**
 * The four unit variables everything inside a unit reads (banner, nodes, ring, START bubble): its colour, the
 * darker lip, the shine highlight and the dark shade for coloured text. Unit colours never change with the theme.
 */
export function unitColorVariables(color: UnitColor): CssVariables {
  return {
    "--unit": `var(--unit-${color})`,
    "--unit-lip": `var(--unit-${color}-lip)`,
    "--unit-shine": `var(--unit-${color}-shine)`,
    "--unit-dark": `var(--unit-${color}-dark)`,
  };
}
