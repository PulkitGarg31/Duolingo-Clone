import { onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { createWakeGate } from "@/lib/api/serverStatus";
import { createQueryClient, pauseWhileServerAsleep } from "./queryClient";

/** A /health stand-in whose answer the test flips between asleep and awake. */
function fakeServer(awake: boolean) {
  const server = {
    awake,
    probe: vi.fn(async () => {
      if (!server.awake) throw new Error("asleep");
    }),
  };
  return server;
}

function setBrowserOnline(online: boolean) {
  vi.stubGlobal("navigator", { onLine: online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  onlineManager.setEventListener(() => undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pauseWhileServerAsleep", () => {
  it("holds a click made while the server wakes up and sends it once /health answers", async () => {
    const gate = createWakeGate();
    const server = fakeServer(false);
    gate.start(server.probe);
    pauseWhileServerAsleep(gate);
    const client = createQueryClient();
    client.mount();
    const send = vi.fn(async () => "bought");

    const purchase = client.getMutationCache().build(client, { mutationFn: send }).execute(undefined);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onlineManager.isOnline()).toBe(false);
    expect(send).not.toHaveBeenCalled();

    server.awake = true;
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(purchase).resolves.toBe("bought");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("parks a retry while the gate re-checks a server that fell asleep, then lets it continue", async () => {
    const gate = createWakeGate();
    const server = fakeServer(true);
    gate.start(server.probe);
    await vi.advanceTimersByTimeAsync(0);
    pauseWhileServerAsleep(gate);
    const client = createQueryClient();
    client.mount();
    const send = vi.fn(async () => {
      if (send.mock.calls.length === 1) {
        // What apiFetch does when a request meets a sleeping server.
        server.awake = false;
        gate.rearm();
        throw ApiError.network(new TypeError("Failed to fetch"));
      }
      return "answered";
    });

    const answer = client.getMutationCache().build(client, { mutationFn: send }).execute(undefined);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(send).toHaveBeenCalledTimes(1);

    server.awake = true;
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(answer).resolves.toBe("answered");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("follows the browser's connection as well as the server", async () => {
    const gate = createWakeGate();
    gate.start(fakeServer(true).probe);
    await vi.advanceTimersByTimeAsync(0);
    pauseWhileServerAsleep(gate);
    expect(onlineManager.isOnline()).toBe(true);

    setBrowserOnline(false);
    expect(onlineManager.isOnline()).toBe(false);

    setBrowserOnline(true);
    expect(onlineManager.isOnline()).toBe(true);
  });
});
