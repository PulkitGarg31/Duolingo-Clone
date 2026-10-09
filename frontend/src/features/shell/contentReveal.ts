/**
 * Follows whether a page shows its loading skeleton. Feed it the current answer after every change; it returns
 * true exactly when the page's content has just replaced the skeleton.
 */
export function createRevealWatch(initiallyLoading: boolean): (loading: boolean) => boolean {
  let wasLoading = initiallyLoading;
  return (loading: boolean): boolean => {
    const revealed = wasLoading && !loading;
    wasLoading = loading;
    return revealed;
  };
}
