/**
 * Service to discover web pages directly from the Framer project canvas.
 *
 * Framer Plugin SDK exposes `framer.getNodesWithType("WebPageNode")` without
 * requiring extra permissions in `framer.json`. Each `WebPageNode` contains the
 * user-defined canvas page title (`name`) and its relative web path (`path`).
 *
 * When executed outside the Framer environment (such as in local browser dev
 * preview or automated vitest runs), graceful fallback pages matching standard
 * Framer site templates are returned.
 */

import { framer } from "framer-plugin";
import { normalizePagePath } from "./pageScaffoldService";

export interface FramerProjectPage {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}

export const DEFAULT_FALLBACK_PAGES: ReadonlyArray<FramerProjectPage> = [
  { id: "page-home", name: "Home", path: "/" },
  { id: "page-case-studies", name: "Case Studies", path: "/case-studies" },
  { id: "page-experiments", name: "Experiments", path: "/experiments" },
  { id: "page-about", name: "About", path: "/about" },
  { id: "page-resume", name: "Resume", path: "/resume" },
  { id: "page-login", name: "Login", path: "/login" },
  { id: "page-reset-password", name: "Reset Password", path: "/reset-password" },
  { id: "page-dashboard", name: "Dashboard", path: "/dashboard" },
  { id: "page-404", name: "404", path: "/404" },
];

/**
 * Normalizes a canvas node path to ensure standard web format (e.g. `/about`, `/`).
 */
export function formatWebPagePath(rawPath?: string | null, name?: string): string {
  if (typeof rawPath === "string" && rawPath.trim() !== "") {
    const trimmed = rawPath.trim();
    if (trimmed === "/") return "/";
    const normalized = normalizePagePath(trimmed);
    return normalized === "" ? "/" : normalized;
  }

  // Path is omitted or empty string
  if (name && name.toLowerCase() !== "home") {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug ? `/${slug}` : "/";
  }

  return "/";
}

/**
 * Queries the active Framer canvas AST for all WebPageNode entries.
 */
export async function getFramerProjectPages(
  framerInstance: { getNodesWithType?: (type: "WebPageNode") => Promise<readonly any[]> } = framer
): Promise<FramerProjectPage[]> {
  try {
    if (typeof framerInstance?.getNodesWithType === "function") {
      const nodes = await framerInstance.getNodesWithType("WebPageNode");
      if (Array.isArray(nodes) && nodes.length > 0) {
        const seenPaths = new Set<string>();
        const pages: FramerProjectPage[] = [];

        for (const node of nodes) {
          const rawPath = typeof node?.path === "string" ? node.path : null;
          const nodeName = typeof node?.name === "string" ? node.name : undefined;
          const path = formatWebPagePath(rawPath, nodeName);

          if (seenPaths.has(path)) continue;
          seenPaths.add(path);

          const displayName = nodeName && nodeName.trim() !== "" ? nodeName.trim() : path;

          pages.push({
            id: String(node?.id || path),
            name: displayName,
            path,
          });
        }

        if (pages.length > 0) {
          return pages;
        }
      }
    }
  } catch {
    // Graceful degradation when running outside Framer canvas or in tests
  }

  return [...DEFAULT_FALLBACK_PAGES];
}
