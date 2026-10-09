import { describe, expect, it, vi } from "vitest";
import { TOKEN_KIND_STORAGE_KEY, TOKEN_STORAGE_KEY, createTokenStore } from "./tokenStore";

function memoryStorage(saved?: string, savedKind?: string) {
  const items = new Map<string, string>(saved ? [[TOKEN_STORAGE_KEY, saved]] : []);
  if (savedKind !== undefined) items.set(TOKEN_KIND_STORAGE_KEY, savedKind);
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

  it("picks up the token saved by an earlier visit, reading storage on the first call only", () => {
    const storage = memoryStorage("tok-saved", "guest");
    const store = createTokenStore(() => storage);

    expect(store.get()).toBe("tok-saved");
    const reads = storage.getItem.mock.calls.length;
    expect(store.get()).toBe("tok-saved");
    expect(store.kind()).toBe("guest");
    expect(storage.getItem).toHaveBeenCalledTimes(reads);
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

describe("token kind", () => {
  it("has no kind without a token", () => {
    expect(createTokenStore(() => memoryStorage()).kind()).toBeNull();
  });

  it("saves the kind under owlingo.tokenKind next to the token, an account's unless told otherwise", () => {
    const storage = memoryStorage();
    const store = createTokenStore(() => storage);

    store.set("tok-guest", "guest");
    expect([store.get(), store.kind()]).toEqual(["tok-guest", "guest"]);
    expect(storage.items.get("owlingo.tokenKind")).toBe("guest");

    store.set("tok-ana");
    expect([store.get(), store.kind()]).toEqual(["tok-ana", "account"]);
    expect(storage.items.get("owlingo.tokenKind")).toBe("account");
  });

  it("forgets the kind with the token", () => {
    const storage = memoryStorage("tok-guest", "guest");
    const store = createTokenStore(() => storage);

    store.clear();

    expect(store.kind()).toBeNull();
    expect(storage.items.has(TOKEN_KIND_STORAGE_KEY)).toBe(false);
  });

  it("picks up a guest token saved by an earlier visit", () => {
    const store = createTokenStore(() => memoryStorage("tok-guest", "guest"));

    expect([store.get(), store.kind()]).toEqual(["tok-guest", "guest"]);
  });

  it("reads a token saved without a valid kind as an account's, as every token was before guests", () => {
    expect(createTokenStore(() => memoryStorage("tok-old")).kind()).toBe("account");
    expect(createTokenStore(() => memoryStorage("tok-odd", "visitor")).kind()).toBe("account");
  });

  it("ignores a kind saved without a token", () => {
    expect(createTokenStore(() => memoryStorage(undefined, "guest")).kind()).toBeNull();
  });

  it("keeps the kind for this tab when storage throws", () => {
    const store = createTokenStore(blockedStorage);

    store.set("tok-guest", "guest");

    expect([store.get(), store.kind()]).toEqual(["tok-guest", "guest"]);
  });

  it("tells subscribers about every change of token", () => {
    const store = createTokenStore(() => memoryStorage());
    const changed = vi.fn();
    const unsubscribe = store.subscribe(changed);

    store.set("tok-guest", "guest");
    store.expire("tok-guest");
    store.set("tok-ana");
    store.clear();
    unsubscribe();
    store.set("tok-later");

    expect(changed).toHaveBeenCalledTimes(4);
  });
});

describe("token expiry", () => {
  it("drops the current token and tells the subscribers once, naming an account's token", () => {
    const storage = memoryStorage("tok-1");
    const store = createTokenStore(() => storage);
    const listener = vi.fn();
    store.onExpire(listener);

    expect(store.expire("tok-1")).toBe(true);
    expect(store.expire("tok-1")).toBe(false);

    expect(store.get()).toBeNull();
    expect(storage.items.has(TOKEN_STORAGE_KEY)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("account");
  });

  it("tells the subscribers when the dropped token was a guest's", () => {
    const storage = memoryStorage("tok-guest", "guest");
    const store = createTokenStore(() => storage);
    const listener = vi.fn();
    store.onExpire(listener);

    expect(store.expire("tok-guest")).toBe(true);

    expect(listener).toHaveBeenCalledExactlyOnceWith("guest");
    expect([store.get(), store.kind()]).toEqual([null, null]);
    expect(storage.items.has(TOKEN_KIND_STORAGE_KEY)).toBe(false);
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
