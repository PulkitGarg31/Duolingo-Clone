import { describe, expect, it } from "vitest";
import keys from "./illustration-keys.json";
import { ILLUSTRATIONS, isIllustrationKey } from "./registry";

describe("illustration registry", () => {
  it("lists 26 unique keys", () => {
    expect(keys).toHaveLength(26);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a drawing for exactly the listed keys, in the same order", () => {
    expect(Object.keys(ILLUSTRATIONS)).toEqual(keys);
    for (const drawing of Object.values(ILLUSTRATIONS)) expect(typeof drawing).toBe("function");
  });

  it("recognises listed keys only, ignoring inherited object properties", () => {
    expect(isIllustrationKey("apple")).toBe(true);
    expect(isIllustrationKey("pear")).toBe(false);
    expect(isIllustrationKey("toString")).toBe(false);
  });
});
