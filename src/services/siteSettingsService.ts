/**
 * The site settings document, from the panel's side.
 *
 * Two calls: read the whole document, write a patch. The patch shape is the
 * important half.
 *
 * ## Why a write is a patch and never the whole document
 *
 * Settings are stored as one JSON column keyed by site id, which was a
 * deliberate instruction: a column per switch would mean an `ALTER TABLE` every
 * time the product grows a toggle. The cost is that a client holding a stale
 * copy of the document can overwrite fields it has never heard of.
 *
 * Sending only what changed removes that. The server merges per key, so a panel
 * running an older version than the backend writes its three fields and leaves
 * the fourth alone, instead of silently reverting it to whatever its own
 * defaults say.
 *
 * ## The version is a concurrency check, not a schema version
 *
 * `SiteSettingsDocument.version` is the row's revision counter. The panel sends
 * the one it read, and a write carrying a stale value is refused with
 * `settings_out_of_date`. The case that catches is two plugin panels open on
 * the same Framer project, which is ordinary rather than exotic: a creator with
 * the project open on a laptop and a desktop.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient } from "./apiClient";
import type { SiteSettingsDocument, SiteSettingsPatch } from "../types/connection";

export interface SettingsResponse {
  settings: SiteSettingsDocument;
  version: number;
  site: {
    siteId: string;
    siteKey: string;
    siteName: string;
    allowedOrigins: string[];
  };
}

export function fetchSiteSettings(
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<SettingsResponse>> {
  return client.get("/api/site/settings", { siteId });
}

export interface SaveSettingsResponse {
  settings: SiteSettingsDocument;
  version: number;
}

export function saveSiteSettings(
  siteId: string,
  version: number,
  patch: SiteSettingsPatch,
  client: ApiClient = apiClient
): Promise<ApiResult<SaveSettingsResponse>> {
  return client.put("/api/site/settings", { siteId, version, settings: patch });
}

export interface OriginsResponse {
  allowedOrigins: string[];
  rejected: number;
}

/**
 * Add published origins to the allowlist.
 *
 * The allowlist is what verifies a request: the site key identifies and is
 * public, baked into every generated component, so without a matching origin a
 * lifted key is useless. Which means a missing origin is not a nicety, it is
 * the difference between a membership that works on the published domain and
 * one that fails there after working in preview.
 */
export function addAllowedOrigins(
  siteId: string,
  origins: ReadonlyArray<string>,
  client: ApiClient = apiClient
): Promise<ApiResult<OriginsResponse>> {
  return client.post("/api/site/origins", { siteId, origins: [...origins] });
}

export function replaceAllowedOrigins(
  siteId: string,
  origins: ReadonlyArray<string>,
  client: ApiClient = apiClient
): Promise<ApiResult<OriginsResponse>> {
  return client.post("/api/site/origins", { siteId, origins: [...origins], replace: true });
}

/**
 * Is this a path we are willing to store and later redirect to?
 *
 * The same rule as `isSafeSitePath` in `backend/src/lib/siteSettings.ts`, and
 * the same reasoning for duplicating it: the server is the rule and this copy
 * is a hint, so a creator is told before they submit rather than after.
 *
 * The case that makes this worth having rather than a length check: `//evil.com`
 * starts with a slash and is not a path. A browser reads it as protocol
 * relative and navigates off-site, so "starts with a slash" is an open redirect
 * wearing a path check's clothes.
 */
export function isSafeSitePath(value: string): boolean {
  if (value === "") return false;
  if (value.length > 512) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  if (value.includes("\\")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
}

/** The five settings that are site-relative paths, with their panel labels. */
export const AUTH_PATH_FIELDS = [
  { field: "loginPath", label: "Login page", hint: "Where a locked gate sends a signed-out visitor." },
  { field: "signupPath", label: "Sign up page", hint: "Leave as the login page to use one page for both." },
  { field: "resetPath", label: "Reset page", hint: "The page the emailed reset link opens." },
  { field: "afterLoginPath", label: "After sign in", hint: "Where a visitor lands once signed in." },
  { field: "afterLogoutPath", label: "After sign out", hint: "Where a visitor lands once signed out." },
] as const satisfies ReadonlyArray<{ field: string; label: string; hint: string }>;

export type AuthPathField = (typeof AUTH_PATH_FIELDS)[number]["field"];
