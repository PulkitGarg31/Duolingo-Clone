import { SIGNED_IN_HOME, SIGNED_OUT_HOME } from "@/lib/queries/mutations";
import type { TokenKind } from "./tokenStore";

export const DEMO_RESTARTED_MESSAGE = "Your demo was restarted with fresh progress";
export const SIGNED_OUT_MESSAGE = "You were signed out";

/** What recovering from a refused token does, supplied by the app (and by fakes in tests). */
export interface ExpiryActions {
  /** Empties the query cache: every cached screen belonged to the learner whose token was refused. */
  clearCache: () => void;
  /** Starts a new private demo; a call while one is already starting joins it. */
  startGuest: () => Promise<void>;
  toast: (message: string) => void;
  /** Replaces the current page with `href`. */
  goTo: (href: string) => void;
}

/**
 * The server refused the tab's token, which apiFetch has already dropped. A guest's demo is simply gone (the
 * server restarted and rebuilt its database): a new guest takes its place, the visitor is told the demo starts
 * afresh and stays in the app. An account holder is signed out and lands on the welcome page, to sign in again
 * or try the demo.
 */
export function recoverFromRefusedToken(kind: TokenKind, actions: ExpiryActions): void {
  actions.clearCache();
  if (kind === "guest") {
    // A failure needs no handling here: the guest gate keeps trying while the tab has no token.
    actions.startGuest().catch(() => undefined);
    actions.toast(DEMO_RESTARTED_MESSAGE);
    actions.goTo(SIGNED_IN_HOME);
    return;
  }
  actions.toast(SIGNED_OUT_MESSAGE);
  actions.goTo(SIGNED_OUT_HOME);
}
