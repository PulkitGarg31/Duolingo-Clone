/** The browser's IANA zone ("Europe/Madrid"), or null when it cannot tell. */
export function deviceTimeZoneOrNull(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
