import { describe, expect, it, vi } from "vitest";
import { TOKEN_STORAGE_KEY, createTokenStore } from "./tokenStore";

function memoryStorage(saved?: string) {
  const items = new Map<string, string>(saved ? [[TOKEN_STORAGE_KEY, saved]] : []);
  return {
    items,
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
    removeItem: vi.fn((key: string) => void items.delete(key)),
  };
}

function blockedStorage(): never {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

describe("token store", () => {
  it("starts as the demo learner when nothing is saved", () => {
    expect(createTokenStore(() => memoryStorage()).get()).toBeNull();
  });

  it("picks up the token saved by an earlier visit, reading storage once", () => {
    const storage = memoryStorage("tok-saved");
    const store = createTokenStore(() => storage);

    expect(store.get()).toBe("tok-saved");
    expect(store.get()).toBe("tok-saved");
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("saves the token under owlingo.token and removes it on clear", () => {
    const storage = memoryStorage();
    const store = createTokenStore(() => storage);

    store.set("tok-1");
    expect(store.get()).toBe("tok-1");
    expect(storage.items.get("owlingo.token")).toBe("tok-1");

    store.clear();
    expect(store.get()).toBeNull();
    expect(storage.items.has("owlingo.token")).toBe(false);
  });

  it("treats an empty saved value as no token", () => {
    const storage = memoryStorage();
    storage.items.set(TOKEN_STORAGE_KEY, "");

    expect(createTokenStore(() => storage).get()).toBeNull();
  });

  it("keeps working for this tab when storage throws", () => {
    const store = createTokenStore(blockedStorage);

    expect(store.get()).toBeNull();
    store.set("tok-1");
    expect(store.get()).toBe("tok-1");
    store.clear();
    expect(store.get()).toBeNull();
  });

  it("keeps working when there is no storage at all (server rendering)", () => {
    const store = createTokenStore(() => null);

    store.set("tok-1");
    expect(store.get()).toBe("tok-1");
  });

  it("keeps this tab's token when another tab changes storage", () => {
    const storage = memoryStorage("tok-mine");
    const store = createTokenStore(() => storage);
    store.get();

    storage.items.set(TOKEN_STORAGE_KEY, "tok-other-tab");

    expect(store.get()).toBe("tok-mine");
  });
});

describe("token expiry", () => {
  it("drops the current token and tells the subscribers once", () => {
    const storage = memoryStorage("tok-1");
    const store = createTokenStore(() => storage);
    const listener = vi.fn();
    store.onExpire(listener);

    expect(store.expire("tok-1")).toBe(true);
    expect(store.expire("tok-1")).toBe(false);

    expect(store.get()).toBeNull();
    expect(storage.items.has(TOKEN_STORAGE_KEY)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("leaves a newer token alone when an old request comes back refused", () => {
    const store = createTokenStore(() => memoryStorage());
    const listener = vi.fn();
    store.onExpire(listener);
    store.set("tok-new");

    expect(store.expire("tok-old")).toBe(false);

    expect(store.get()).toBe("tok-new");
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify after unsubscribing, or when the visitor signed out on purpose", () => {
    const store = createTokenStore(() => memoryStorage("tok-1"));
    const listener = vi.fn();
    const unsubscribe = store.onExpire(listener);

    store.clear();
    expect(listener).not.toHaveBeenCalled();

    store.set("tok-2");
    unsubscribe();
    store.expire("tok-2");
    expect(listener).not.toHaveBeenCalled();
  });
});
