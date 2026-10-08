import { describe, expect, it } from "vitest";
import { parseFocusParam } from "./focusParam";

describe("parseFocusParam", () => {
  it("reads a node id", () => {
    expect(parseFocusParam("7")).toBe(7);
  });

  it("takes the first of repeated parameters", () => {
    expect(parseFocusParam(["8", "9"])).toBe(8);
  });

  it("ignores missing, empty and malformed values", () => {
    expect(parseFocusParam(undefined)).toBeNull();
    expect(parseFocusParam("")).toBeNull();
    expect(parseFocusParam("7abc")).toBeNull();
    expect(parseFocusParam("-3")).toBeNull();
    expect(parseFocusParam("0")).toBeNull();
  });
});
