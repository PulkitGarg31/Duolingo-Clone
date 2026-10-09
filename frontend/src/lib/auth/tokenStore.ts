/*
 * The session token of a signed-in learner. Without one, the API serves the shared demo learner, so "no token"
 * is the instant demo and never an error. The token lives in localStorage so a reload stays signed in; every
 * storage call is guarded, because private modes and hardened browsers can block storage or throw on access.
 * The tab keeps its own copy after the first read: another tab signing in or out does not swap the learner
 * under this tab's cached data.
 */

export const TOKEN_STORAGE_KEY = "owlingo.token";

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createTokenStore(getStorage: () => TokenStorage | null) {
  // undefined until the first read, when the token saved by an earlier visit is loaded.
  let token: string | null | undefined;
  const expiryListeners = new Set<() => void>();

  function readSaved(): string | null {
    try {
      return getStorage()?.getItem(TOKEN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }

  function current(): string | null {
    if (token === undefined) token = readSaved();
    return token;
  }

  function save(value: string | null): void {
    token = value;
    try {
      const storage = getStorage();
      if (value === null) storage?.removeItem(TOKEN_STORAGE_KEY);
      else storage?.setItem(TOKEN_STORAGE_KEY, value);
    } catch {
      // Storage blocked: the token still works in this tab until it closes.
    }
  }

  return {
    /** The current token, or null for the demo learner. */
    get(): string | null {
      return current();
    },

    /** After a login or a signup. */
    set(value: string): void {
      save(value);
    },

    /** After a logout, or when the visitor picks the demo. */
    clear(): void {
      save(null);
    },

    /**
     * The server refused `rejected` (expired, revoked, or wiped by a server restart). Drops it if it is still
     * the current token and tells the subscribers, once. A token replaced in the meantime (a new login while
     * an old request was in flight) is left alone. Returns whether the token was dropped.
     */
    expire(rejected: string): boolean {
      if (current() !== rejected) return false;
      save(null);
      expiryListeners.forEach((listener) => listener());
      return true;
    },

    /** Called when `expire` drops the current token. Returns the unsubscribe function. */
    onExpire(listener: () => void): () => void {
      expiryListeners.add(listener);
      return () => {
        expiryListeners.delete(listener);
      };
    },
  };
}

export type TokenStore = ReturnType<typeof createTokenStore>;

export const tokenStore = createTokenStore(() => (typeof window === "undefined" ? null : window.localStorage));
