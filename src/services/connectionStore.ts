/**
 * Where the connection and the creator token live between panel opens.
 *
 * ## Current rule (Framer Marketplace audit C1, 2026-10-28)
 *
 * The connection (site id, site key, project id: no secrets) stays in plugin
 * data. The creator token is in this browser's `localStorage`, keyed by the
 * Framer project the panel is open in, and never in plugin data. Plugin data
 * syncs to every collaborator and travels with a duplicated or remixed
 * project, so a token there handed admin access to the site's members and
 * payments to anyone holding a copy. The Marketplace guide forbids tokens in
 * `setPluginData`. This reverses PRD S2 for this one value; recorded as the
 * resolution of conflict C27 in PRD section 17.
 *
 * Keyed by the open project's id, not the id inside the stored connection: a
 * duplicated project carries the original's connection, and must not find the
 * original's token even in the same browser.
 *
 * A token an older version left in plugin data is deleted on first load and
 * never copied: copying it would give it to whichever collaborator opened the
 * plugin first. The creator signs in once more.
 *
 * The history below explains why plugin data was chosen first.
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
/** Plugin data key an older version stored the token under. Only ever cleared now. */
const LEGACY_TOKEN_KEY = "memberframe.creatorToken";
/** `localStorage` key prefix; the Framer project id follows. */
export const LOCAL_TOKEN_PREFIX = "memberframe:creatorToken:";

/** The token for a project from this browser's storage, or null. Never throws. */
export function readLocalToken(projectId: string): string | null {
  if (!projectId) return null;
  try {
    const value = window.localStorage.getItem(LOCAL_TOKEN_PREFIX + projectId);
    return value && value.trim() !== "" ? value : null;
  } catch {
    return null;
  }
}

/** Store or remove a project's token in this browser. False when storage is blocked. */
export function writeLocalToken(projectId: string, token: string | null): boolean {
  if (!projectId) return false;
  try {
    if (token) window.localStorage.setItem(LOCAL_TOKEN_PREFIX + projectId, token);
    else window.localStorage.removeItem(LOCAL_TOKEN_PREFIX + projectId);
    return true;
  } catch {
    return false;
  }
}

/** The project the stored token belongs to, so a disconnect removes the right entry. */
let tokenProjectId: string | null = null;

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

/**
 * Asked before every write: Framer shows the creator a warning for a protected
 * call made without checking first, and on a project's first open the
 * permission is not granted yet. Not allowed counts as a failed write.
 */
function mayWritePluginData(): boolean {
  try {
    return framer.isAllowedTo("setPluginData");
  } catch {
    return false;
  }
}

/** Writes asked for before the permission was granted: the latest value per key. */
const pendingWrites = new Map<string, string | null>();
let waitingForPermission: (() => void) | null = null;

/** Hold a write until Framer grants setPluginData, then make it, once. */
function deferWrite(key: string, value: string | null): void {
  pendingWrites.set(key, value);
  if (waitingForPermission) return;
  try {
    // Framer may answer at once, inside the subscribe call, before it returns.
    let granted = false;
    const unsubscribe = framer.subscribeToIsAllowedTo("setPluginData", (allowed) => {
      if (!allowed || granted) return;
      granted = true;
      waitingForPermission?.();
      waitingForPermission = null;
      const writes = [...pendingWrites];
      pendingWrites.clear();
      for (const [pendingKey, pendingValue] of writes) void writeKey(pendingKey, pendingValue);
    });
    if (granted) unsubscribe();
    else waitingForPermission = unsubscribe;
  } catch {
    // Outside Framer: nothing will ever grant it.
    storageWorked = false;
  }
}

async function writeKey(key: string, value: string | null): Promise<boolean> {
  if (!mayWritePluginData()) {
    deferWrite(key, value);
    return false;
  }
  pendingWrites.delete(key);
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
export async function loadStoredConnection(projectId: string): Promise<StoredConnection | null> {
  const [rawConnection, legacyToken] = await Promise.all([
    readKey(CONNECTION_KEY),
    readKey(LEGACY_TOKEN_KEY),
  ]);

  // An older version's token in shared plugin data: delete, never adopt.
  if (legacyToken) void writeKey(LEGACY_TOKEN_KEY, null);

  const rawToken = readLocalToken(projectId);
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
  tokenProjectId = projectId;
  setCreatorToken(rawToken);
  return { connection, token: rawToken };
}

/**
 * The site id this project keeps in its plugin data, for `attachProject`.
 *
 * Only when the stored connection was written for this very project. Plugin
 * data travels with a duplicated or remixed project, so a copy carries the
 * original's site id under a different project id: a copy gets undefined, and
 * with it a site of its own. The comparison happens here, inside Framer; the
 * project id is never sent (Marketplace review, 2026-10-28).
 */
export async function storedSiteIdFor(projectId: string): Promise<string | undefined> {
  const raw = await readKey(CONNECTION_KEY);
  if (!raw || !projectId) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const connection = asConnection(parsed);
  return connection && connection.framerProjectId === projectId ? connection.siteId : undefined;
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
    siteName: text("siteName") ?? "",
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
  tokenProjectId = connection.framerProjectId;
  setCreatorToken(token);

  // The token in this browser only; the connection, which holds no secret, in
  // the project. Blocked storage keeps the token for this session and asks for
  // a code next time, which the Connect tab explains.
  if (!writeLocalToken(connection.framerProjectId, token)) storageWorked = false;
  await writeKey(CONNECTION_KEY, JSON.stringify(connection));
}

/** Update the connection without touching the token. For a settings or origin change. */
export async function saveConnectionOnly(connection: SiteConnection): Promise<void> {
  await writeKey(CONNECTION_KEY, JSON.stringify(connection));
}

export async function clearConnection(): Promise<void> {
  cachedToken = null;
  setCreatorToken(null);
  if (tokenProjectId) writeLocalToken(tokenProjectId, null);
  tokenProjectId = null;
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
 * Drop a token the server refused, keeping the connection.
 *
 * For a 401 only: the token is no longer accepted, so the panel stops sending
 * it and this browser forgets it, but the project's connection stays, so a
 * sign in picks the same site up again. A server that is merely unreachable
 * never calls this. `clearConnection` is for a deliberate disconnect.
 */
export function forgetTokenInMemory(): void {
  cachedToken = null;
  setCreatorToken(null);
  // The server refused it: it will never work again, so do not keep it.
  if (tokenProjectId) writeLocalToken(tokenProjectId, null);
  tokenProjectId = null;
}
