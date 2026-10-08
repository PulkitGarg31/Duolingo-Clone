/** True when `pathname` is `route` itself or a page below it: "/profile/24" matches "/profile", "/profiles" does not. */
export function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}
