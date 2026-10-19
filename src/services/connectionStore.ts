/**
 * Where the connection and the creator token live between panel opens.
 *
 * ## The token problem, stated plainly
 *
 * PRD section 14.1 S2 bars a token from `localStorage`, and it is right to: a
 * plugin panel is a web page, anything running in it can read `localStorage`,
 * and the value here reads and writes every member of every site the creator
 * owns.
 *
 * The alternatives were:
 *
 *   1. **Memory only.** The creator types an emailed code every time they open
 *      the panel. Correct and unusable, so it would be turned off.
 *   2. **`localStorage`.** Forbidden by S2, and forbidden for a good reason.
 *   3. **Framer plugin data.** Scoped to the Framer project rather than to an
 *      origin, read back only by this plugin in this project, and gone when the
 *      project is deleted.
 *
 * This file does 3. The trade is real and worth naming rather than burying:
 * plugin data is stored in the Framer document, so it syncs to Framer's servers
 * and to anyone with edit access to the project. The security model that
 * follows is "whoever can edit this Framer project can administer its
 * membership", which is defensible, because a person who can edit the project
 * can already change what the gates require and where the sign-in page points.
 *
 * It is NOT the same as "whoever has the creator's email account", which is
 * what the connect flow proves. Recorded as conflict C27, and the mitigations
 * are a thirty-day server-side expiry and the fact that the token is revocable
 * from `POST /api/connect/disconnect` rather than merely expirable.
 *
 * ## Why the token is stored apart from the connection
 *
 * Two keys, not one object. The connection is passed around the component tree,
 * put in React state, and would appear in any serialized error or devtools
 * snapshot. The token is read only by the API client, through a function, and
 * is never a field on anything a component holds.
 */

import { framer } from "framer-plugin";
import { setCreatorToken } from "./apiClient";
import type { SiteConnection } from "../types/connection";

/**
 * Both values are under the 2kB `setPluginData` ceiling by a wide margin: the
 * connection is a few hundred bytes and the token is 43 characters. The
 * differential compression PRD section 13 calls for is for the telemetry
 * payload, not for this.
 */
const CONNECTION_KEY = "memberframe.connection";
const TOKEN_KEY = "memberframe.creatorToken";

/**
 * The token, in memory, for the life of this panel.
 *
 * Read synchronously by `apiClient`, which cannot await: `getCreatorToken` is
 * called inside request assembly. So the token is loaded once at startup and
 * held here, and plugin data is the durable copy rather than the live one.
 */
let cachedToken: string | null = null;

/**
 * Whether plugin data actually worked.
 *
 * `setPluginData` needs a declared permission and `framer.json` now declares
 * it, but a creator can still be running a Framer build where the call fails,
 * and the plugin must not break for them. When it fails the panel still works
 * for this session and asks for a code again next time, which is degraded
 * rather than broken, and `storageAvailable` is what the Connect tab reads to
 * say so rather than leaving them to discover it.
 */
let storageWorked = true;

export function storageAvailable(): boolean {
  return storageWorked;
}

/**
 * Read plugin data, treating every failure as "nothing stored".
 *
 * `getPluginData` needs no permission, so this generally succeeds, but it fails
 * outright outside Framer, which is how the standalone browser dev preview
 * runs.
 */
async function readKey(key: string): Promise<string | null> {
  try {
    return await framer.getPluginData(key);
  } catch {
    return null;
  }
}

async function writeKey(key: string, value: string | null): Promise<boolean> {
  try {
    await framer.setPluginData(key, value);
    return true;
  } catch {
    storageWorked = false;
    return false;
  }
}

export interface StoredConnection {
  connection: SiteConnection;
  token: string;
}

/**
 * Load at startup. Returns null when there is nothing, or nothing usable.
 *
 * A connection with no token is as good as no connection: every call it could
 * make resolves `unauthorized`, so returning it would produce a panel that
 * looks connected and does nothing. Both or neither.
 */
export async function loadStoredConnection(): Promise<StoredConnection | null> {
  const [rawConnection, rawToken] = await Promise.all([
    readKey(CONNECTION_KEY),
    readKey(TOKEN_KEY),
  ]);

  if (!rawConnection || !rawToken) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConnection);
  } catch {
    // Written by a different version, or truncated. Treat it as absent rather
    // than throwing on panel open.
    return null;
  }

  const connection = asConnection(parsed);
  if (!connection) return null;

  cachedToken = rawToken;
  setCreatorToken(rawToken);
  return { connection, token: rawToken };
}

/**
 * Narrow parsed JSON to a connection.
 *
 * Hand written rather than trusted, because the source is a string that a
 * previous version of this plugin wrote and that nothing validates. A missing
 * `siteId` would otherwise reach a URL as `undefined`.
 */
function asConnection(value: unknown): SiteConnection | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const text = (key: string): string | null =>
    typeof record[key] === "string" && record[key] !== "" ? (record[key] as string) : null;

  const siteId = text("siteId");
  const siteKey = text("siteKey");
  const framerProjectId = text("framerProjectId");

  if (!siteId || !siteKey || !framerProjectId) return null;

  return {
    siteId,
    siteKey,
    framerProjectId,
    siteName: text("siteName") ?? "Untitled project",
    creatorEmail: text("creatorEmail") ?? "",
    creatorName: text("creatorName") ?? "",
    ...(text("creatorAvatarUrl") ? { creatorAvatarUrl: text("creatorAvatarUrl")! } : {}),
    allowedOrigins: Array.isArray(record["allowedOrigins"])
      ? record["allowedOrigins"].filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

export async function saveConnection(connection: SiteConnection, token: string): Promise<void> {
  cachedToken = token;
  setCreatorToken(token);

  // The token first. If only one of the two writes lands, a stored token with
  // no connection is recoverable (the panel re-reads the session from the
  // server), while a stored connection with no token is the broken half.
  await writeKey(TOKEN_KEY, token);
  await writeKey(CONNECTION_KEY, JSON.stringify(connection));
}

/** Update the connection without touching the token. For a settings or origin change. */
export async function saveConnectionOnly(connection: SiteConnection): Promise<void> {
  await writeKey(CONNECTION_KEY, JSON.stringify(connection));
}

export async function clearConnection(): Promise<void> {
  cachedToken = null;
  setCreatorToken(null);
  await writeKey(TOKEN_KEY, null);
  await writeKey(CONNECTION_KEY, null);
}

/**
 * The token, for `apiClient` and for nothing else.
 *
 * Synchronous by necessity and by design: a component that wanted to await it
 * would be a component holding a credential, and this way the only consumer is
 * the request assembly that must have it.
 */
export function currentCreatorToken(): string | null {
  return cachedToken;
}

/**
 * Drop the in-memory token without clearing storage.
 *
 * For a 401: the stored token is no longer accepted, so the panel must stop
 * sending it, but a transient server problem should not wipe a creator's
 * connection. `clearConnection` is for a deliberate disconnect.
 */
export function forgetTokenInMemory(): void {
  cachedToken = null;
  setCreatorToken(null);
}
