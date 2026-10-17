/**
 * The plugin's half of FP-12 protected files: upload, link, edit, delete.
 *
 * Mirrors `memberframe-backend/src/routes/content.ts`, creator section. A
 * file's storage key never comes back; the creator sees the asset id to paste
 * into `<ProtectedDownload>`, the plan it needs, and how often it was taken.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient, failureMessage } from "./apiClient";

export interface SiteAsset {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** upload: stored by MemberFrame. url: a private link MemberFrame fetches. */
  source: "upload" | "url";
  remoteUrl: string | null;
  /** "signed_in" or a tier key. */
  requiredTier: string;
  downloadCount: number;
  lastDownloadAt: string | null;
  createdAt: string;
}

export interface AssetList {
  assets: SiteAsset[];
  maxBytes: number;
  storage: "local" | "s3";
}

export function fetchAssets(siteId: string, client: ApiClient = apiClient): Promise<ApiResult<AssetList>> {
  return client.get("/api/site/assets", { siteId });
}

export function uploadAsset(
  siteId: string,
  file: File,
  meta: { name: string; requiredTier: string },
  client: ApiClient = apiClient
): Promise<ApiResult<{ asset: SiteAsset }>> {
  return client.upload(
    "/api/site/assets/upload",
    { siteId, name: meta.name, fileName: file.name, requiredTier: meta.requiredTier },
    file
  );
}

export function linkAsset(
  siteId: string,
  input: { name: string; url: string; fileName?: string; requiredTier: string },
  client: ApiClient = apiClient
): Promise<ApiResult<{ asset: SiteAsset }>> {
  return client.post("/api/site/assets", { siteId, ...input });
}

export function updateAsset(
  siteId: string,
  assetId: string,
  patch: { name?: string; fileName?: string; requiredTier?: string; url?: string },
  client: ApiClient = apiClient
): Promise<ApiResult<{ asset: SiteAsset }>> {
  return client.patch(`/api/site/assets/${encodeURIComponent(assetId)}`, { siteId, ...patch });
}

export function deleteAsset(siteId: string, assetId: string, client: ApiClient = apiClient): Promise<ApiResult<void>> {
  return client.delete(`/api/site/assets/${encodeURIComponent(assetId)}`, { siteId });
}

/** Plain-language copy for a failure, with the server's own words where it sent some. */
export function assetsFailure(result: Exclude<ApiResult<unknown>, { kind: "ok" }>): string {
  if (result.kind === "unavailable") {
    if (result.message) return result.message;
    switch (result.reason) {
      case "file_too_large":
        return "That file is too large.";
      case "unknown_tier":
        return "That plan no longer exists. Pick another.";
      case "invalid_link":
        return "Paste a full https address to the file.";
      case "too_many_assets":
        return "This site has reached 500 files. Delete some to add more.";
      case "upload_failed":
        return "The upload did not finish. Try again.";
      default:
        break;
    }
  }
  return failureMessage(result).message;
}

/** 42 MB, 980 KB, 1.2 GB. Empty for an unknown size. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** What an asset row reads under its name: "ZIP, 42 MB, linked". */
export function assetSummary(asset: SiteAsset): string {
  const extension = /\.([A-Za-z0-9]{1,8})$/.exec(asset.fileName);
  return [extension ? extension[1].toUpperCase() : "", formatBytes(asset.sizeBytes), asset.source === "url" ? "linked" : ""]
    .filter(Boolean)
    .join(", ");
}
