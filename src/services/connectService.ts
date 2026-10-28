/**
 * The connect handshake, from the panel's side.
 *
 * The creator signs in on the hosted account page (a browser tab), the panel
 * receives a token through the hand-off poll, and `attachProject` gives this
 * project its site. Each call returns `ApiResult` so a caller handles all five
 * PRD section 10.6 cases or fails the typecheck.
 *
 * ## The server learns nothing about the Framer project
 *
 * Since 2026-10-28 (Marketplace review) the only thing sent is the site id
 * this project already keeps in its plugin data. Not the Framer user, not the
 * project id or name, not its published domains. A project is matched to its
 * site by that id, inside the panel (`siteById`).
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient } from "./apiClient";
import type { SiteConnection, SiteSettingsDocument } from "../types/connection";
import type { LicenseView } from "./licenseService";
import { API_BASE_URL } from "../config/backend";

/** A site as the server describes it. `siteName` is null for a site created since 2026-10-28. */
export interface ConnectedSite {
  siteId: string;
  siteKey: string;
  siteName: string | null;
  allowedOrigins: string[];
}

export interface ConnectSessionSite extends ConnectedSite {
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
 * By the site id this project keeps in its plugin data, never by position. A
 * creator with several sites would otherwise get whichever sorts first, which
 * would show them another site's members inside this project's panel.
 */
export function siteById(sites: ReadonlyArray<ConnectSessionSite>, siteId: string | undefined): ConnectSessionSite | null {
  if (!siteId) return null;
  return sites.find((site) => site.siteId === siteId) ?? null;
}

// ============================================================================
// F19: THE ACCOUNT PAGE IN A NEW TAB, 19-pro-lock-and-trial.md 2.1
// ============================================================================

/** The hosted account page, opened in a browser tab with the panel's session id. */
export function accountPageUrl(mode: "login" | "register", sessionId: string, theme: "light" | "dark", base: string = API_BASE_URL): string {
  const query = new URLSearchParams({ mode, sessionId, theme });
  return `${base.replace(/\/+$/, "")}/auth?${query.toString()}`;
}

/** A session id for one sign-in: random, and only ever sent to our own backend. */
export function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("-");
}

export type HandoffResponse =
  | { status: "pending" }
  | { status: "ready"; token: string; expiresAt: string; creator: { email: string; name: string; avatarUrl: string | null } };

/** The poll: pending until the creator signs in on the page, then the token, once. */
export function pollHandoff(sessionId: string, client: ApiClient = apiClient): Promise<ApiResult<HandoffResponse>> {
  return client.get("/api/connect/handoff", { sessionId });
}

/** The site id from this project's plugin data, or nothing for a new project or a copy. */
export interface AttachProjectInput {
  siteId?: string;
}

export interface AttachProjectResponse {
  creator: { email: string; name: string };
  site: ConnectedSite;
  settings: SiteSettingsDocument;
  settingsVersion: number;
  license: LicenseView;
}

/** This project's site for the signed-in creator (made if new), and its trial if they have none. */
export function attachProject(input: AttachProjectInput, client: ApiClient = apiClient): Promise<ApiResult<AttachProjectResponse>> {
  return client.post("/api/connect/attach-project", input);
}

/**
 * The session response, reduced to what the panel stores.
 *
 * `framerProjectId` is the open project's own id, from the SDK, never from the
 * server: it goes into this project's plugin data so a duplicate can be told
 * apart later.
 */
export function toConnection(
  site: ConnectedSite,
  creator: { email: string; name: string },
  framerProjectId: string
): SiteConnection {
  return {
    siteId: site.siteId,
    siteKey: site.siteKey,
    siteName: site.siteName ?? "",
    framerProjectId,
    creatorEmail: creator.email,
    creatorName: creator.name,
    allowedOrigins: site.allowedOrigins,
  };
}
