/*
 * The session token of this tab's learner, and what kind of learner it belongs to: an account (signup or
 * login) or a guest, the visitor's private copy of the demo (POST /auth/demo). The app routes never run
 * without one: a visitor who has no token gets a guest first (GuestSessionGate). The API itself still serves
 * the shared demo learner to requests without a token, which only the API docs and curl rely on.
 *
 * Both values live in localStorage so a reload keeps the same learner; every storage call is guarded, because
 * private modes and hardened browsers can block storage or throw on access. The tab keeps its own copy after
 * the first read: another tab signing in or out does not swap the learner under this tab's cached data.
 */

export const TOKEN_STORAGE_KEY = "owlingo.token";
export const TOKEN_KIND_STORAGE_KEY = "owlingo.tokenKind";

/** Who a token signs in: an account of one's own, or a guest's private demo. */
export type TokenKind = "guest" | "account";

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface Saved {
  token: string | null;
  kind: TokenKind | null;
}

const SIGNED_OUT: Saved = { token: null, kind: null };

/** A saved kind, or "account" for a token saved without a valid one (tokens from before guests existed). */
function kindOf(saved: string | null): TokenKind {
  return saved === "guest" ? "guest" : "account";
}

export function createTokenStore(getStorage: () => TokenStorage | null) {
  // undefined until the first read, when the token saved by an earlier visit is loaded.
  let current: Saved | undefined;
  const expiryListeners = new Set<(kind: TokenKind) => void>();
  const changeListeners = new Set<() => void>();

  function readSaved(): Saved {
    try {
      const storage = getStorage();
      const token = storage?.getItem(TOKEN_STORAGE_KEY) || null;
      return token ? { token, kind: kindOf(storage?.getItem(TOKEN_KIND_STORAGE_KEY) ?? null) } : SIGNED_OUT;
    } catch {
      return SIGNED_OUT;
    }
  }

  function read(): Saved {
    if (current === undefined) current = readSaved();
    return current;
  }

  function save(next: Saved): void {
    current = next;
    try {
      const storage = getStorage();
      if (next.token === null) {
        storage?.removeItem(TOKEN_STORAGE_KEY);
        storage?.removeItem(TOKEN_KIND_STORAGE_KEY);
      } else {
        storage?.setItem(TOKEN_STORAGE_KEY, next.token);
        storage?.setItem(TOKEN_KIND_STORAGE_KEY, next.kind ?? "account");
      }
    } catch {
      // Storage blocked: the token still works in this tab until it closes.
    }
    changeListeners.forEach((listener) => listener());
  }

  return {
    /** The current token, or null before the tab has a learner. */
    get(): string | null {
      return read().token;
    },

    /** Whose token it is: an account's or a guest's; null without a token. */
    kind(): TokenKind | null {
      return read().kind;
    },

    /** After a login or a signup ("account"), or once a private demo has started ("guest"). */
    set(value: string, kind: TokenKind = "account"): void {
      save({ token: value, kind });
    },

    /** After a logout, or when an account holder picks the demo. */
    clear(): void {
      save(SIGNED_OUT);
    },

    /**
     * The server refused `rejected` (expired, revoked, or wiped by a server restart). Drops it if it is still
     * the current token and tells the subscribers, once, whose token it was. A token replaced in the meantime
     * (a new login while an old request was in flight) is left alone. Returns whether the token was dropped.
     */
    expire(rejected: string): boolean {
      const { token, kind } = read();
      if (token !== rejected) return false;
      save(SIGNED_OUT);
      expiryListeners.forEach((listener) => listener(kind ?? "account"));
      return true;
    },

    /** Called with the dropped token's kind when `expire` drops the current token. Returns the unsubscribe function. */
    onExpire(listener: (kind: TokenKind) => void): () => void {
      expiryListeners.add(listener);
      return () => {
        expiryListeners.delete(listener);
      };
    },

    /** Called after every change of token (for `useSyncExternalStore`). Returns the unsubscribe function. */
    subscribe(listener: () => void): () => void {
      changeListeners.add(listener);
      return () => {
        changeListeners.delete(listener);
      };
    },
  };
}

export type TokenStore = ReturnType<typeof createTokenStore>;

export const tokenStore = createTokenStore(() => (typeof window === "undefined" ? null : window.localStorage));
