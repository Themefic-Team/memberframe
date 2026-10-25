/**
 * The plugin's half of protected downloads: the server's record of a file
 * uploaded on the canvas (32-canvas-downloads.md).
 *
 * Mirrors `memberframe-backend/src/routes/content.ts`, creator section. The
 * canvas guard creates a linked asset from the Framer address of a file
 * dropped into Protected Download, and updates its rule, name, file, or
 * password. A password goes up once and is hashed there; it never comes back.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient, failureMessage } from "./apiClient";

export interface SiteAsset {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** upload: stored by MemberFrame (older files). url: an address MemberFrame fetches, such as Framer's. */
  source: "upload" | "url";
  remoteUrl: string | null;
  /** signed_in, any_paid, a tier key, only:a,b, or password. */
  requiredTier: string;
  /** Whether a shared password is set. Never the password. */
  hasPassword?: boolean;
  downloadCount: number;
  lastDownloadAt: string | null;
  createdAt: string;
}

export function linkAsset(
  siteId: string,
  input: { name: string; url: string; fileName?: string; requiredTier: string; password?: string },
  client: ApiClient = apiClient
): Promise<ApiResult<{ asset: SiteAsset }>> {
  return client.post("/api/site/assets", { siteId, ...input });
}

export function updateAsset(
  siteId: string,
  assetId: string,
  patch: { name?: string; fileName?: string; requiredTier?: string; url?: string; password?: string },
  client: ApiClient = apiClient
): Promise<ApiResult<{ asset: SiteAsset }>> {
  return client.patch(`/api/site/assets/${encodeURIComponent(assetId)}`, { siteId, ...patch });
}

/** Plain-language copy for a failure, with the server's own words where it sent some. */
export function assetsFailure(result: Exclude<ApiResult<unknown>, { kind: "ok" }>): string {
  if (result.kind === "unavailable") {
    if (result.message) return result.message;
    switch (result.reason) {
      case "unknown_tier":
        return "That plan no longer exists. Pick another in Who Can Download.";
      case "invalid_link":
        return "Framer did not give the file a public address. Upload it again.";
      case "too_many_assets":
        return "This site has reached 500 protected files.";
      case "password_required":
        return "Type a password for the download.";
      case "invalid_password":
        return "Use a password of 4 to 200 characters.";
      default:
        break;
    }
  }
  return failureMessage(result).message;
}
