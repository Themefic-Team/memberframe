/**
 * What the Framer SDK can tell us about the open project.
 *
 * Three calls, none of which needs a declared permission: `getProjectInfo`,
 * `getCurrentUser`, and `getPublishInfo` are all unprotected in the installed
 * SDK (3.10.3), which is worth stating because `framer.json` lists permissions
 * and a reader will wonder why these are not among them.
 *
 * ## The one thing the SDK will not tell us
 *
 * The creator's email address. `getCurrentUser()` returns a name, a hashed id,
 * an avatar, and initials. That is blocker B7, and it is the entire reason the
 * connect flow has an email field and a verification code rather than being a
 * single button: the plugin cannot learn who the creator is, so the creator
 * says, and a code turns the claim into a fact.
 *
 * ## Every call is wrapped
 *
 * The panel also runs in a plain browser during development, where `framer` is
 * a singleton whose messages go to a parent window that does not exist and
 * every call rejects. A failure here means a degraded Connect tab with the
 * fields typed by hand, not a blank panel.
 */

import { framer } from "framer-plugin";
import type { FramerProjectContext } from "../types/connection";

/**
 * Read everything at once.
 *
 * `Promise.allSettled` rather than `all`: `getPublishInfo` fails on a project
 * that has never been published, and that must not take the project id down
 * with it. An unpublished project is the ordinary case for a creator setting
 * membership up before launch.
 */
export async function readProjectContext(): Promise<FramerProjectContext> {
  const [project, user, publish] = await Promise.allSettled([
    framer.getProjectInfo(),
    framer.getCurrentUser(),
    framer.getPublishInfo(),
  ]);

  if (project.status !== "fulfilled") {
    return {
      projectId: "",
      projectName: "",
      creatorName: null,
      publishedOrigins: [],
      unavailable: true,
    };
  }

  return {
    projectId: project.value.id,
    projectName: project.value.name,
    creatorName: user.status === "fulfilled" ? user.value.name : null,
    publishedOrigins:
      publish.status === "fulfilled" ? originsFromPublishInfo(publish.value) : [],
    unavailable: false,
  };
}

/**
 * Turn published URLs into origins.
 *
 * These go straight into the site's allowlist, which is what stands between a
 * public site key and a request from anywhere. The server normalizes again and
 * refuses anything it does not like, so this is the convenience half: a creator
 * should not have to type their own domain.
 *
 * Both production and staging, because a creator testing membership on the
 * staging URL before publishing is the normal order of work, and a staging
 * request refused with a CORS error gives them nothing to go on.
 */
export function originsFromPublishInfo(info: {
  production: { url: string } | null;
  staging: { url: string } | null;
}): string[] {
  const origins: string[] = [];

  for (const publish of [info.production, info.staging]) {
    if (!publish?.url) continue;

    try {
      const origin = new URL(publish.url).origin;
      if (origin !== "null" && !origins.includes(origin)) origins.push(origin);
    } catch {
      // A URL the SDK reported that does not parse. Nothing useful to do with
      // it, and the creator can add the origin by hand from the Connect tab.
    }
  }

  return origins;
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
