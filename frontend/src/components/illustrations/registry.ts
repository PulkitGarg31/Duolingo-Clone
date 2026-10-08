import type { ComponentType } from "react";
import { Apple } from "./Apple";
import { Bill } from "./Bill";
import { Boy } from "./Boy";
import { Bread } from "./Bread";
import { Brother } from "./Brother";
import { Bye } from "./Bye";
import { Cheese } from "./Cheese";
import { Coffee } from "./Coffee";
import { Father } from "./Father";
import { Girl } from "./Girl";
import { Juice } from "./Juice";
import { Man } from "./Man";
import { Milk } from "./Milk";
import { Moon } from "./Moon";
import { Mother } from "./Mother";
import { Orange } from "./Orange";
import type { IllustrationProps } from "./parts";
import { Short } from "./Short";
import { Sister } from "./Sister";
import { Sugar } from "./Sugar";
import { Sun } from "./Sun";
import { Tall } from "./Tall";
import { Tea } from "./Tea";
import { Thanks } from "./Thanks";
import { Water } from "./Water";
import { Wave } from "./Wave";
import { Woman } from "./Woman";

/**
 * Every picture-card drawing by its content key. The keys match `illustration-keys.json`, the list the
 * backend validates course content against; a unit test keeps the two identical.
 */
export const ILLUSTRATIONS = {
  wave: Wave,
  bye: Bye,
  thanks: Thanks,
  sun: Sun,
  moon: Moon,
  boy: Boy,
  girl: Girl,
  man: Man,
  woman: Woman,
  bread: Bread,
  apple: Apple,
  cheese: Cheese,
  orange: Orange,
  water: Water,
  coffee: Coffee,
  milk: Milk,
  tea: Tea,
  juice: Juice,
  sugar: Sugar,
  bill: Bill,
  mother: Mother,
  father: Father,
  brother: Brother,
  sister: Sister,
  tall: Tall,
  short: Short,
} satisfies Record<string, ComponentType<IllustrationProps>>;

export type IllustrationKey = keyof typeof ILLUSTRATIONS;

/** Narrows an image key from the API (a plain string) to one that has a drawing. */
export function isIllustrationKey(key: string): key is IllustrationKey {
  return Object.hasOwn(ILLUSTRATIONS, key);
}
