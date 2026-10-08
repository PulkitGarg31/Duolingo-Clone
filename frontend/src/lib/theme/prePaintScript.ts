/** localStorage keys that remember the learner's appearance settings between visits. */
export const THEME_STORAGE_KEY = "theme";
export const ANIMATIONS_STORAGE_KEY = "animations";

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Runs inline in <head>, before the first paint, so a dark-mode learner never sees a white flash. It writes
 * `data-theme` ("light" | "dark", resolving "system" with the OS preference) and `data-motion`
 * ("reduced" when animations are off in Settings or the OS asks for less motion) on <html>.
 * Plain ES5 on purpose: it runs before any bundle has loaded. ThemeProvider takes over after hydration.
 */
export const prePaintScript = `(function () {
  var root = document.documentElement;
  function stored(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function prefers(query) { try { return window.matchMedia(query).matches; } catch (e) { return false; } }
  var theme = stored(${JSON.stringify(THEME_STORAGE_KEY)});
  var dark = theme === "dark" || (theme !== "light" && prefers(${JSON.stringify(DARK_SCHEME_QUERY)}));
  root.setAttribute("data-theme", dark ? "dark" : "light");
  var reduced = stored(${JSON.stringify(ANIMATIONS_STORAGE_KEY)}) === "false" || prefers(${JSON.stringify(REDUCED_MOTION_QUERY)});
  root.setAttribute("data-motion", reduced ? "reduced" : "full");
})();`;
