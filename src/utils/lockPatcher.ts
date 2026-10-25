/**
 * `enforceLockState`: the four F19 lines in every deployed component, kept in
 * step with the license. Development doc 19-pro-lock-and-trial.md, PRD F19.
 *
 * Each licensed canvas component carries
 *
 *   const IS_LOCKED = false;
 *   const IS_TRIAL = false;
 *   // @plugin-lock-state: unlocked
 *   // @plugin-trial-state: paid
 *
 * and draws the trial watermark or the lock from them until its runtime check
 * (`/api/license`) answers. When the license changes the panel rewrites those
 * lines in each file in place, so the canvas shows the right state at once,
 * as BEAF did. A file missing any of the four lines (edited by hand) is left
 * alone rather than guessed at (F19 acceptance: never corrupt an edited file).
 */

import type { CanvasLicense } from "../services/licenseService";

/** Every component that shows the watermark or the lock: all of them, the bookmarks included since 2026-10-25. */
export const LICENSED_FILE_NAMES: ReadonlyArray<string> = [
  "BookmarkButton.tsx",
  "BookmarksTray.tsx",
  "MemberAuth.tsx",
  "MemberLogin.tsx",
  "MemberRegister.tsx",
  "MemberPasswordReset.tsx",
  "MemberOtpVerify.tsx",
  "MemberDashboard.tsx",
  "MemberPricing.tsx",
  "MeteredPaywall.tsx",
  "ProtectedDownload.tsx",
];

const LINES = [
  { pattern: /^const IS_LOCKED = (?:true|false);$/gm, write: (state: CanvasLicense) => `const IS_LOCKED = ${state === "locked"};` },
  { pattern: /^const IS_TRIAL = (?:true|false);$/gm, write: (state: CanvasLicense) => `const IS_TRIAL = ${state === "trial"};` },
  {
    pattern: /^\/\/ @plugin-lock-state: (?:locked|unlocked)$/gm,
    write: (state: CanvasLicense) => `// @plugin-lock-state: ${state === "locked" ? "locked" : "unlocked"}`,
  },
  {
    pattern: /^\/\/ @plugin-trial-state: (?:paid|trial|expired)$/gm,
    write: (state: CanvasLicense) => `// @plugin-trial-state: ${state === "active" ? "paid" : state === "trial" ? "trial" : "expired"}`,
  },
];

/** The source with its four lines set for `state`, or null when they are not all there exactly once. */
export function patchLockState(source: string, state: CanvasLicense): string | null {
  let out = source.replace(/\r\n/g, "\n");
  for (const line of LINES) {
    const found = out.match(line.pattern);
    if (!found || found.length !== 1) return null;
    out = out.replace(line.pattern, line.write(state));
  }
  return out;
}

/** What a file's lines say now, for tests and diagnostics. */
export function readLockState(source: string): CanvasLicense | null {
  const locked = /^const IS_LOCKED = (true|false);$/m.exec(source)?.[1];
  const trial = /^const IS_TRIAL = (true|false);$/m.exec(source)?.[1];
  if (locked === undefined || trial === undefined) return null;
  return locked === "true" ? "locked" : trial === "true" ? "trial" : "active";
}

export interface PatchableCodeFile {
  readonly name: string;
  readonly content?: string;
  setFileContent(code: string): Promise<unknown>;
}

/** Rewrite every licensed file whose lines disagree with `state`. */
export async function enforceLockState(
  state: CanvasLicense,
  getCodeFiles: () => Promise<ReadonlyArray<PatchableCodeFile>>
): Promise<{ patched: string[]; skipped: string[] }> {
  const patched: string[] = [];
  const skipped: string[] = [];
  for (const file of await getCodeFiles()) {
    if (!LICENSED_FILE_NAMES.includes(file.name) || typeof file.content !== "string") continue;
    const next = patchLockState(file.content, state);
    if (next === null) {
      skipped.push(file.name);
      continue;
    }
    if (next === file.content.replace(/\r\n/g, "\n")) continue;
    await file.setFileContent(next);
    patched.push(file.name);
  }
  return { patched, skipped };
}
