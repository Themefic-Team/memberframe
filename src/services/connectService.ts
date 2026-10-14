/**
 * The connect handshake, from the panel's side.
 *
 * Four calls against `/api/connect/*`, each returning `ApiResult` so a caller
 * handles all five PRD section 10.6 cases or fails the typecheck.
 *
 * ## Two steps, and the reason is that the SDK has no email
 *
 * `framer.getCurrentUser()` exposes a name and a hashed id and no address
 * (blocker B7). So the creator types one, which is a claim rather than a fact,
 * and `startConnect` sends a six-digit code that turns it into one. Without
 * that step, anyone who learned a Framer project id could type any address and
 * receive a token that reads every member of that site.
 *
 * ## The first two calls are unauthenticated, deliberately
 *
 * They have to be: there is no token yet. `start` is rate limited per address
 * and per IP on the server because it sends mail to an address the caller
 * chose, which makes it the one endpoint in the API that could be pointed at a
 * third party.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient } from "./apiClient";
import type { SiteConnection, SiteSettingsDocument } from "../types/connection";

export interface StartConnectInput {
  email: string;
  framerProjectId: string;
}

/**
 * Send the code.
 *
 * A 200 says nothing about whether the address exists or whether mail was
 * actually delivered, and the panel's copy must not imply otherwise. The
 * server is deliberately incapable of telling us, so "Check your email" is the
 * only honest thing to show.
 */
export function startConnect(
  input: StartConnectInput,
  client: ApiClient = apiClient
): Promise<ApiResult<Record<string, never>>> {
  return client.post("/api/connect/start", input);
}

export interface VerifyConnectInput {
  email: string;
  code: string;
  framerProjectId: string;
  projectName: string;
  creatorName: string | null;
  origins: string[];
}

export interface VerifyConnectResponse {
  token: string;
  expiresAt: string;
  creator: { email: string; name: string };
  site: {
    siteId: string;
    siteKey: string;
    siteName: string;
    framerProjectId: string;
    allowedOrigins: string[];
  };
  settings: SiteSettingsDocument;
  settingsVersion: number;
}

export function verifyConnect(
  input: VerifyConnectInput,
  client: ApiClient = apiClient
): Promise<ApiResult<VerifyConnectResponse>> {
  return client.post("/api/connect/verify", input);
}

export interface ConnectSessionSite {
  siteId: string;
  siteKey: string;
  siteName: string;
  framerProjectId: string | null;
  allowedOrigins: string[];
  memberCount: number;
  settings: SiteSettingsDocument;
  settingsVersion: number;
}

export interface ConnectSessionResponse {
  creator: { email: string; name: string };
  sites: ConnectSessionSite[];
}

/**
 * Does the stored token still work, and what does it reach?
 *
 * Called once on panel open. A 401 is the ordinary answer for a panel that has
 * never been connected and renders the connect form, not an error banner: the
 * creator has done nothing wrong and there is nothing to retry.
 *
 * It returns every site this creator owns rather than only the open one,
 * because a creator who connected this project from another machine, or who
 * owns several, should see the panel reconnect rather than ask for a code.
 */
export function fetchConnectSession(
  client: ApiClient = apiClient
): Promise<ApiResult<ConnectSessionResponse>> {
  return client.get("/api/connect/session");
}

/**
 * Revoke this panel's token.
 *
 * Server side it revokes one session row. It does NOT delete the site, the
 * members, the tiers, or the settings, and the Connect tab's copy says so:
 * "disconnect" reads like removal, and a creator who expected that and found
 * their member list intact would not know what had happened.
 */
export function disconnect(
  client: ApiClient = apiClient
): Promise<ApiResult<Record<string, never>>> {
  return client.post("/api/connect/disconnect");
}

/**
 * Pick the site for the project that is currently open.
 *
 * By Framer project id, never by position. A creator with several connected
 * projects would otherwise get whichever site happens to sort first, which
 * would show them another site's members inside this project's panel.
 */
export function siteForProject(
  sites: ReadonlyArray<ConnectSessionSite>,
  framerProjectId: string
): ConnectSessionSite | null {
  return sites.find((site) => site.framerProjectId === framerProjectId) ?? null;
}

/** The session response, reduced to what the panel stores. */
export function toConnection(
  site: ConnectSessionSite | VerifyConnectResponse["site"],
  creator: { email: string; name: string }
): SiteConnection {
  return {
    siteId: site.siteId,
    siteKey: site.siteKey,
    siteName: site.siteName,
    framerProjectId: site.framerProjectId ?? "",
    creatorEmail: creator.email,
    creatorName: creator.name,
    allowedOrigins: site.allowedOrigins,
  };
}
