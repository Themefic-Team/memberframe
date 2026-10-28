/**
 * Keeps the site key and server address baked into every deployed MemberFrame
 * component file in step with the plugin's current connection.
 *
 * A component file gets both values when the Builder writes it, and nothing
 * updated them after. Signing in again (a new site), or pointing the plugin at
 * another backend, left published components calling a site that no longer
 * exists, and every sign up on the live page was refused. The plugin now
 * rewrites the two lines inside the file's `@memberframe-config` block whenever
 * they differ, and leaves a file it cannot recognise alone.
 */

import { CONFIG_END_MARKER, CONFIG_START_MARKER } from "../services/canvasComponentCodeGenerator";
import { queueCodeFileWrite } from "./codeFileQueue";

/** Every component file the Builder writes, licensed or not. */
export const MEMBERFRAME_FILE_NAMES: ReadonlyArray<string> = [
  "MemberAuth.tsx",
  "MemberLogin.tsx",
  "MemberRegister.tsx",
  "MemberPasswordReset.tsx",
  "MemberOtpVerify.tsx",
  "MemberDashboard.tsx",
  "MemberPricing.tsx",
  "MeteredPaywall.tsx",
  "ProtectedDownload.tsx",
  "BookmarkButton.tsx",
  "BookmarksTray.tsx",
];

export interface SiteConfig {
  siteKey: string;
  apiBaseUrl: string;
}

/**
 * The file with its config block's `siteKey` and `apiBaseUrl` set to `target`,
 * or null when nothing changes or the block is missing (an edited file).
 */
export function patchSiteConfig(content: string, target: SiteConfig): string | null {
  const start = content.indexOf(CONFIG_START_MARKER);
  const end = content.indexOf(CONFIG_END_MARKER, start + 1);
  if (start === -1 || end === -1) return null;

  const block = content.slice(start, end);
  const next = block
    .replace(/^(\s*siteKey:\s*)"(?:[^"\\]|\\.)*"(,?)$/m, (_line, head: string, comma: string) => `${head}${JSON.stringify(target.siteKey)}${comma}`)
    .replace(/^(\s*apiBaseUrl:\s*)"(?:[^"\\]|\\.)*"(,?)$/m, (_line, head: string, comma: string) => `${head}${JSON.stringify(target.apiBaseUrl)}${comma}`);
  if (next === block) return null;
  return content.slice(0, start) + next + content.slice(end);
}

export interface PatchableFile {
  readonly name: string;
  readonly content: string;
  setFileContent(code: string): Promise<unknown>;
}

/** Rewrite every MemberFrame file whose site key or server address is stale. Returns how many changed. */
export async function syncSiteConfig(
  files: ReadonlyArray<PatchableFile>,
  target: SiteConfig
): Promise<number> {
  if (!target.siteKey || !target.apiBaseUrl) return 0;
  let changed = 0;
  for (const file of files) {
    if (!MEMBERFRAME_FILE_NAMES.includes(file.name) || typeof file.content !== "string") continue;
    const next = patchSiteConfig(file.content, target);
    if (next === null) continue;
    await queueCodeFileWrite(() => file.setFileContent(next));
    changed += 1;
  }
  return changed;
}
