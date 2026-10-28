/**
 * What the Framer SDK tells us about the open project: its id, and nothing else.
 *
 * Since 2026-10-28 (Marketplace review, docs/development-docs/
 * 35-marketplace-review-report.md) the panel reads only `getProjectInfo().id`.
 * It does not call `getCurrentUser`, and it does not read the project's name or
 * its published domains, so none of them can reach our server. The id itself
 * stays in the panel: it keys this browser's token and lets the panel tell a
 * duplicated project from the original. The server knows a project only by the
 * site id kept in the project's plugin data.
 *
 * `getPublishInfo` is still read by `useSetupProgress`, inside the panel, to
 * tick the "Publish" setup step. Nothing from it is sent anywhere.
 *
 * ## Every call is wrapped
 *
 * The panel also runs in a plain browser during development, where `framer` is
 * a singleton whose messages go to a parent window that does not exist and
 * every call rejects. A failure here means a signed-out panel, not a blank one.
 */

import { framer } from "framer-plugin";
import type { FramerProjectContext } from "../types/connection";

export async function readProjectContext(): Promise<FramerProjectContext> {
  try {
    const project = await framer.getProjectInfo();
    return { projectId: project.id, unavailable: false };
  } catch {
    return { projectId: "", unavailable: true };
  }
}

/**
 * A short, readable form of a project id, for the Connect tab.
 *
 * The id is a hash and showing it in full fills the 360px panel with noise. It
 * is not a secret, so this is purely about the panel being readable.
 */
export function shortProjectId(projectId: string): string {
  if (projectId.length <= 12) return projectId;
  return `${projectId.slice(0, 6)}...${projectId.slice(-4)}`;
}
