/**
 * The site's domains, as the creator types them in Settings.
 *
 * Since 2026-10-28 the panel no longer reads the published domains from Framer
 * (Marketplace review, docs/development-docs/35-marketplace-review-report.md).
 * The creator types each one instead. The list is the site's origin allowlist:
 * the site key is public, so this list is what ties it to the creator's own
 * site. A live site whose domain is missing here gets "origin not allowed" on
 * every member request.
 *
 * The server normalizes again and is the authority (`normalizeOrigins` in the
 * backend). This catches typing mistakes before the round trip, and accepts
 * what a creator naturally types: `acme.com`, `www.acme.com`, or a full
 * address copied from the browser.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `https://host[:port]` for what was typed, or null when it is not a domain. */
export function toOrigin(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  // Plain http only on the creator's own machine, as the server allows.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
  // A real host has a dot: "acme" alone is a typo, not a domain.
  if (!loopback && !url.hostname.includes(".")) return null;
  if (url.username !== "" || url.password !== "") return null;

  return url.origin;
}

/** The host alone, for display: `acme.com` rather than `https://acme.com`. */
export function domainLabel(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** A domain counts as working when a page there called within this long. */
export const WORKING_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;

/** Whether a sighting is recent enough to call the domain working. */
export function isWorking(lastSeenAt: string, now: number = Date.now()): boolean {
  const at = Date.parse(lastSeenAt);
  return !Number.isNaN(at) && now - at <= WORKING_WITHIN_MS;
}

/** "Seen on your live site today", "... 3 days ago", from a sighting's time. */
export function seenLabel(lastSeenAt: string, now: number = Date.now()): string {
  const at = Date.parse(lastSeenAt);
  if (Number.isNaN(at)) return "Seen on your live site.";
  const days = Math.floor((now - at) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Seen on your live site today.";
  if (days === 1) return "Seen on your live site yesterday.";
  return `Seen on your live site ${days} days ago.`;
}
