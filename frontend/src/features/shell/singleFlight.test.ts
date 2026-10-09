import { describe, expect, it } from "vitest";
import { createSingleFlight } from "./singleFlight";

describe("createSingleFlight", () => {
  it("ignores a second start while the first is still running", () => {
    const run = createSingleFlight();
    const started: string[] = [];
    expect(run(() => started.push("first"))).toBe(true);
    expect(run(() => started.push("second"))).toBe(false);
    expect(started).toEqual(["first"]);
  });

  it("accepts a new start once the running one is done", () => {
    const run = createSingleFlight();
    let finish = () => {};
    run((done) => {
      finish = done;
    });
    finish();
    const started: string[] = [];
    expect(run(() => started.push("next"))).toBe(true);
    expect(started).toEqual(["next"]);
  });

  it("lets a stale done from an earlier run leave the current one alone", () => {
    const run = createSingleFlight();
    let finishFirst = () => {};
    run((done) => {
      finishFirst = done;
    });
    finishFirst();
    run(() => {});
    finishFirst();
    expect(run(() => {})).toBe(false);
  });

  it("frees itself when starting throws", () => {
    const run = createSingleFlight();
    expect(() =>
      run(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(run(() => {})).toBe(true);
  });
});
