import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBootWatch, createWakeGate, startKeepAlive } from "./serverStatus";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A /health stand-in whose answer the test flips between asleep and awake. */
function fakeServer(awake = false) {
  const server = {
    awake,
    probe: vi.fn(async () => {
      if (!server.awake) throw new Error("asleep");
    }),
  };
  return server;
}

describe("wake gate", () => {
  it("opens without a wake screen when the server answers within 1.5 s", async () => {
    const gate = createWakeGate();
    const server = fakeServer(true);

    gate.start(server.probe);
    expect(gate.getSnapshot().phase).toBe("checking");

    await vi.advanceTimersByTimeAsync(0);
    expect(gate.getSnapshot()).toEqual({ phase: "ready", slow: false });

    await vi.advanceTimersByTimeAsync(120_000);
    expect(gate.getSnapshot().phase).toBe("ready");
    expect(server.probe).toHaveBeenCalledTimes(1);
  });

  it("shows the wake screen after 1.5 s, polls every 2 s and adds 'almost there' after 20 s", async () => {
    const gate = createWakeGate();
    const server = fakeServer();

    gate.start(server.probe);
    await vi.advanceTimersByTimeAsync(1_499);
    expect(gate.getSnapshot().phase).toBe("checking");

    await vi.advanceTimersByTimeAsync(1);
    expect(gate.getSnapshot()).toEqual({ phase: "waking", slow: false });

    await vi.advanceTimersByTimeAsync(500);
    expect(server.probe).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(18_000);
    expect(gate.getSnapshot()).toEqual({ phase: "waking", slow: true });

    server.awake = true;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(gate.getSnapshot()).toEqual({ phase: "ready", slow: false });
  });

  it("gives up after 90 s, and TRY AGAIN starts over on the wake screen", async () => {
    const gate = createWakeGate();
    const server = fakeServer();

    gate.start(server.probe);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(gate.getSnapshot().phase).toBe("failed");

    const callsWhenFailed = server.probe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(server.probe).toHaveBeenCalledTimes(callsWhenFailed);

    server.awake = true;
    gate.retry();
    expect(gate.getSnapshot()).toEqual({ phase: "waking", slow: false });

    await vi.advanceTimersByTimeAsync(0);
    expect(gate.getSnapshot().phase).toBe("ready");
  });

  it("fails at once when the browser reports it is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const gate = createWakeGate();

    gate.start(fakeServer().probe);
    await vi.advanceTimersByTimeAsync(0);

    expect(gate.getSnapshot().phase).toBe("failed");
  });

  it("re-arms only once ready, with the same 1.5 s grace before the wake screen", async () => {
    const gate = createWakeGate();
    const server = fakeServer(true);

    gate.rearm();
    expect(gate.getSnapshot().phase).toBe("idle");

    gate.start(server.probe);
    await vi.advanceTimersByTimeAsync(0);
    expect(gate.getSnapshot().phase).toBe("ready");

    server.awake = false;
    gate.rearm();
    expect(gate.getSnapshot().phase).toBe("checking");
    await vi.advanceTimersByTimeAsync(1_500);
    expect(gate.getSnapshot().phase).toBe("waking");

    const calls = server.probe.mock.calls.length;
    gate.rearm();
    expect(server.probe).toHaveBeenCalledTimes(calls);

    server.awake = true;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(gate.getSnapshot().phase).toBe("ready");
  });

  it("starts once, however often the gate mounts", () => {
    const gate = createWakeGate();
    const server = fakeServer(true);

    gate.start(server.probe);
    gate.start(server.probe);

    expect(server.probe).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on every change until they unsubscribe", async () => {
    const gate = createWakeGate();
    const listener = vi.fn();
    const unsubscribe = gate.subscribe(listener);

    gate.start(fakeServer(true).probe);
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    gate.rearm();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("boot watch", () => {
  function memoryStorage(bootId?: string) {
    const items = new Map<string, string>(bootId ? [["bootId", bootId]] : []);
    return {
      items,
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    };
  }

  it("remembers the first boot id without reporting a restart", () => {
    const storage = memoryStorage();
    const watch = createBootWatch(() => storage);
    const listener = vi.fn();
    watch.subscribe(listener);

    watch.observe("boot-a");
    watch.observe("boot-a");

    expect(listener).not.toHaveBeenCalled();
    expect(storage.items.get("bootId")).toBe("boot-a");
  });

  it("reports a restart once when the boot id changes", () => {
    const storage = memoryStorage();
    const watch = createBootWatch(() => storage);
    const listener = vi.fn();
    watch.subscribe(listener);

    watch.observe("boot-a");
    watch.observe("boot-b");
    watch.observe("boot-b");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ previous: "boot-a", current: "boot-b" });
    expect(storage.items.get("bootId")).toBe("boot-b");
  });

  it("reports a restart that happened while the app was closed", () => {
    const watch = createBootWatch(() => memoryStorage("boot-from-yesterday"));
    const listener = vi.fn();
    watch.subscribe(listener);

    watch.observe("boot-today");

    expect(listener).toHaveBeenCalledWith({ previous: "boot-from-yesterday", current: "boot-today" });
  });

  it("keeps working in memory when storage is blocked", () => {
    const watch = createBootWatch(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    const listener = vi.fn();
    watch.subscribe(listener);

    watch.observe("boot-a");
    watch.observe("boot-b");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores responses without a boot id and stops after unsubscribe", () => {
    const watch = createBootWatch(() => memoryStorage("boot-a"));
    const listener = vi.fn();
    const unsubscribe = watch.subscribe(listener);

    watch.observe(null);
    watch.observe("");
    unsubscribe();
    watch.observe("boot-b");

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("keep-alive", () => {
  it("pings every 4 minutes once started, however often it is started", async () => {
    const ping = vi.fn(async () => undefined);

    startKeepAlive(ping);
    startKeepAlive(ping);
    await vi.advanceTimersByTimeAsync(240_000);
    expect(ping).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(240_000);
    expect(ping).toHaveBeenCalledTimes(2);
  });
});
