import { describe, expect, it } from "vitest";
import { timeZoneLabel, timeZoneOptions } from "./timeZones";

describe("timeZoneLabel", () => {
  it("reads like a place name", () => {
    expect(timeZoneLabel("America/New_York")).toBe("America/New York");
    expect(timeZoneLabel("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos Aires");
    expect(timeZoneLabel("UTC")).toBe("UTC");
  });
});

describe("timeZoneOptions", () => {
  it("lists the zones in alphabetical order", () => {
    expect(timeZoneOptions(["Europe/Madrid", "Asia/Kolkata"]).map((option) => option.value)).toEqual([
      "Asia/Kolkata",
      "Europe/Madrid",
    ]);
  });

  it("always offers the zones it is given as required, once", () => {
    const options = timeZoneOptions(["Europe/Madrid"], "Etc/UTC", "Europe/Madrid");
    expect(options).toEqual([
      { value: "Etc/UTC", label: "Etc/UTC" },
      { value: "Europe/Madrid", label: "Europe/Madrid" },
    ]);
  });
});
