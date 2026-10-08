import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { remainingMs, serverClock, serverNow, tickDelayMs } from "./serverClock";

const DEVICE_NOW = Date.parse("2026-10-08T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(DEVICE_NOW);
  serverClock.observe(new Date(DEVICE_NOW).toISOString());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("server clock skew", () => {
  it("measures the skew from X-Server-Time at the moment the response arrives", () => {
    serverClock.observe("2026-10-09T12:00:05Z");
    expect(serverClock.skewMs()).toBe(86_405_000);
    expect(serverNow()).toBe(DEVICE_NOW + 86_405_000);
  });

  it("handles a device clock that runs ahead of the server", () => {
    serverClock.observe("2026-10-08T11:58:00Z");
    expect(serverNow()).toBe(DEVICE_NOW - 120_000);
  });

  it("keeps advancing with the device clock between responses", () => {
    serverClock.observe("2026-10-08T12:00:10Z");
    vi.advanceTimersByTime(5_000);
    expect(serverNow()).toBe(DEVICE_NOW + 15_000);
  });

  it("ignores a missing or unreadable header", () => {
    serverClock.observe("2026-10-08T12:00:30Z");
    serverClock.observe(null);
    serverClock.observe("not a date");
    expect(serverClock.skewMs()).toBe(30_000);
  });
});

describe("countdowns", () => {
  it("returns the time left until the target", () => {
    expect(remainingMs("2026-10-08T16:00:00Z", DEVICE_NOW)).toBe(4 * 3_600_000);
  });

  it("clamps at 0 once the target has passed", () => {
    expect(remainingMs("2026-10-08T11:59:59Z", DEVICE_NOW)).toBe(0);
    expect(remainingMs("2026-10-08T12:00:00Z", DEVICE_NOW)).toBe(0);
  });

  it("is 0 without a usable target", () => {
    expect(remainingMs(null, DEVICE_NOW)).toBe(0);
    expect(remainingMs(undefined, DEVICE_NOW)).toBe(0);
    expect(remainingMs("soon", DEVICE_NOW)).toBe(0);
  });

  it("ticks every second, every 250 ms in the last minute, and never past the target", () => {
    expect(tickDelayMs(3_600_000)).toBe(1_000);
    expect(tickDelayMs(60_000)).toBe(1_000);
    expect(tickDelayMs(59_999)).toBe(250);
    expect(tickDelayMs(100)).toBe(100);
  });
});
