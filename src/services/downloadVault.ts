/**
 * Protected Download files uploaded on the canvas (32-canvas-downloads.md).
 *
 * The creator drops a file into the component's File control, and Framer
 * stores it at a public `framerusercontent.com` address. A component's props
 * are compiled into the published page, so that address, and a password typed
 * into the Password control, would be readable in the page source. While the
 * plugin is open, the canvas guard moves both to MemberFrame's server (a
 * linked asset, its password hashed there), writes the asset's opaque id into
 * the component, and clears File and Password. The published page then holds
 * only the id; the server checks access and streams the file.
 *
 * This file is the pure half: what an instance's controls say, the rule they
 * make, and what to send. `hooks/useSealGuard.ts` reads the canvas and writes
 * back.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { linkAsset, updateAsset, type SiteAsset } from "./assetsService";

/** Plugin data: each secured asset's last synced rule, name, and file, as a fingerprint. */
export const DOWNLOAD_RULES_KEY = "mfDownloadRules";

/**
 * What the Password field holds once its password is saved on the server:
 * eight dots, shown as dots like any password. Not the password, which the
 * server keeps only as a hash and never sends back; a value in the field is
 * in the published page, so only this fixed mark may stay there. Read as "no
 * new password".
 */
export const SAVED_PASSWORD = "••••••••";

/** A download password: any letters, numbers, or symbols, up to this many characters, as the server accepts it. */
export const MAX_PASSWORD = 200;

/** What one Protected Download instance's controls say. */
export interface DownloadState {
  /** The Framer address of a file dropped in the sidebar, not yet moved. Empty when none. */
  fileUrl: string;
  fileName: string;
  access: "members" | "password";
  whoCanDownload: string;
  chosenTiers: string[];
  /** Typed into the sidebar, not yet moved. Empty when none. */
  password: string;
  assetId: string;
}

/** A Framer File control's value: its address, as a string or an object carrying one. */
export function fileUrlOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string") return url.trim();
  }
  return "";
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function readDownloadControls(controls: Record<string, unknown> | null | undefined): DownloadState {
  const values = controls ?? {};
  return {
    fileUrl: fileUrlOf(values["file"]),
    fileName: text(values["fileName"]),
    access: values["access"] === "password" ? "password" : "members",
    whoCanDownload: text(values["whoCanDownload"]) || "signed_in",
    chosenTiers: Array.isArray(values["chosenTiers"])
      ? values["chosenTiers"].filter((key): key is string => typeof key === "string" && key.trim() !== "").map((key) => key.trim())
      : [],
    // Not trimmed: a password's spaces are part of it.
    password: typeof values["password"] === "string" && values["password"] !== SAVED_PASSWORD ? values["password"] : "",
    assetId: text(values["assetId"]),
  };
}

/**
 * The rule the server stores, the same strings as page and section locks:
 * `signed_in`, `any_paid`, a tier key (or higher), `only:a,b`, or `password`.
 * Null for Only chosen tiers with none picked: nobody could download it.
 */
export function ruleOf(state: Pick<DownloadState, "access" | "whoCanDownload" | "chosenTiers">): string | null {
  if (state.access === "password") return "password";
  if (state.whoCanDownload === "chosen") return state.chosenTiers.length > 0 ? `only:${state.chosenTiers.join(",")}` : null;
  return state.whoCanDownload || "signed_in";
}

/**
 * FNV-1a: a short fingerprint of a file's address, so the address itself is
 * not kept in plugin data. ProtectedDownload.tsx has the same function
 * (`mfFileHash`), held to it by test, to tell a saved file from a new one.
 */
export function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** What was last synced for an asset: its rule, its file name, and which file. */
export function downloadFingerprint(rule: string, fileName: string, fileUrl: string, previous = ""): string {
  const file = fileUrl ? shortHash(fileUrl) : previous.split("|")[2] ?? "";
  return `${rule}|${fileName}|${file}`;
}

/** A readable name for a file with no File Name: the last part of its address. */
export function nameFromUrl(fileUrl: string): string {
  try {
    const last = decodeURIComponent(new URL(fileUrl).pathname.split("/").pop() ?? "");
    return last || "download";
  } catch {
    return "download";
  }
}

export type DownloadPlan =
  | { kind: "none" }
  /** The creator must fix something first; the message says what. */
  | { kind: "blocked"; message: string }
  | { kind: "create"; input: { name: string; url: string; fileName?: string; requiredTier: string; password?: string }; fingerprint: string }
  | { kind: "update"; assetId: string; patch: { url?: string; fileName?: string; requiredTier?: string; password?: string }; fingerprint: string }
  /** An asset this plugin never synced (an older pasted Asset ID): remember it, change nothing. */
  | { kind: "adopt"; assetId: string; fingerprint: string };

/**
 * What to do for one instance, given the fingerprints already synced. Sends
 * only real changes, and never loosens an older asset it did not set up.
 */
export function planDownload(state: DownloadState, synced: Readonly<Record<string, string>>): DownloadPlan {
  const rule = ruleOf(state);
  // The server's own limits (routes/content.ts), said here in plain words
  // rather than as a refused request.
  if (rule === "password" && state.password.length > MAX_PASSWORD) {
    return { kind: "blocked", message: `The download's password can be up to ${MAX_PASSWORD} characters.` };
  }
  if (state.assetId === "") {
    if (state.fileUrl === "") return { kind: "none" };
    if (rule === null) return { kind: "blocked", message: "Pick at least one tier in Chosen Tiers, so MemberFrame can secure the file." };
    if (rule === "password" && state.password === "") return { kind: "blocked", message: "Type a password for the download, so MemberFrame can secure the file." };
    return {
      kind: "create",
      input: {
        name: state.fileName || nameFromUrl(state.fileUrl),
        url: state.fileUrl,
        ...(state.fileName ? { fileName: state.fileName } : {}),
        requiredTier: rule,
        ...(rule === "password" ? { password: state.password } : {}),
      },
      fingerprint: downloadFingerprint(rule, state.fileName, state.fileUrl),
    };
  }

  const previous = synced[state.assetId];
  // A file already saved for this asset, still in the sidebar because Framer
  // did not clear it: nothing new to send.
  const fileIsNew = state.fileUrl !== "" && (previous ?? "").split("|")[2] !== shortHash(state.fileUrl);
  const pending = fileIsNew || state.password !== "";
  if (previous === undefined && !pending) {
    // Set up before canvas uploads: keep its server rule until the creator changes something here.
    return rule === null ? { kind: "none" } : { kind: "adopt", assetId: state.assetId, fingerprint: downloadFingerprint(rule, state.fileName, "", "||") };
  }
  if (rule === null) return pending ? { kind: "blocked", message: "Pick at least one tier in Chosen Tiers, so MemberFrame can secure the file." } : { kind: "none" };

  const fingerprint = downloadFingerprint(rule, state.fileName, state.fileUrl, previous ?? "");
  const wasPassword = (previous ?? "").startsWith("password|");
  if (rule === "password" && !wasPassword && state.password === "") {
    return { kind: "blocked", message: "Type a password for the download, so MemberFrame can switch it to Password." };
  }
  if (fingerprint === previous && !pending) return { kind: "none" };

  const patch: { url?: string; fileName?: string; requiredTier?: string; password?: string } = {};
  if (fileIsNew) patch.url = state.fileUrl;
  if (state.fileName !== "") patch.fileName = state.fileName;
  patch.requiredTier = rule;
  if (rule === "password" && state.password !== "") patch.password = state.password;
  return { kind: "update", assetId: state.assetId, patch, fingerprint };
}

/** The plugin data registry: asset id to its last synced fingerprint. */
export function parseDownloadRules(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) if (typeof entry === "string") out[key] = entry;
    return out;
  } catch {
    return {};
  }
}

export type SecureOutcome =
  | { kind: "secured"; assetId: string; fingerprint: string }
  | { kind: "adopted"; assetId: string; fingerprint: string }
  | { kind: "blocked"; message: string }
  | { kind: "failed"; result: Exclude<ApiResult<unknown>, { kind: "ok" }> }
  | { kind: "none" };

/**
 * Carry out a plan against the server. An update for an asset the server no
 * longer has creates it again from the file, when the component still has it.
 */
export async function securePlan(
  siteId: string,
  plan: DownloadPlan,
  state: DownloadState,
  client?: ApiClient
): Promise<SecureOutcome> {
  if (plan.kind === "none") return { kind: "none" };
  if (plan.kind === "blocked") return { kind: "blocked", message: plan.message };
  if (plan.kind === "adopt") return { kind: "adopted", assetId: plan.assetId, fingerprint: plan.fingerprint };

  const done = (result: ApiResult<{ asset: SiteAsset }>, fingerprint: string): SecureOutcome =>
    result.kind === "ok" ? { kind: "secured", assetId: result.data.asset.id, fingerprint } : { kind: "failed", result };

  if (plan.kind === "create") return done(await linkAsset(siteId, plan.input, client), plan.fingerprint);

  const updated = await updateAsset(siteId, plan.assetId, plan.patch, client);
  if (updated.kind === "unavailable" && updated.status === 404 && state.fileUrl !== "") {
    const recreated = planDownload({ ...state, assetId: "" }, {});
    if (recreated.kind === "create") return done(await linkAsset(siteId, recreated.input, client), recreated.fingerprint);
  }
  return done(updated, plan.fingerprint);
}
