import { clsx, type ClassValue } from "clsx";

/** Joins class names, skipping falsy values: `cn("tile", selected && "tile-selected")`. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
