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

/** "legal-pages" reads "Legal pages". */
function humanizeSegment(segment: string): string {
  const words = segment.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : segment;
}

/** A CMS collection's item page: a path with a `:slug` style segment. */
export function isCmsItemPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith(":"));
}

/**
 * A page as a creator reads it in a dropdown.
 *
 * Framer often names a page after its path, which read "/blog (/blog)". The
 * name is used only when it says something the path does not; otherwise the
 * last segment, humanized. A CMS item page says what it covers, because
 * locking "/blog/:slug" locks every post: "Blog, every item (/blog/:slug)".
 */
export function pageOptionLabel(page: FramerProjectPage): string {
  const path = page.path;
  if (path === "/") return "Home (/)";

  const segments = path.split("/").filter(Boolean);
  if (isCmsItemPath(path)) {
    const collection = segments.filter((segment) => !segment.startsWith(":")).pop();
    return `${collection ? humanizeSegment(collection) : "CMS"}, every item (${path})`;
  }

  const name = page.name.trim();
  const nameIsPath = name === "" || name === path || name === segments.join("/");
  return `${nameIsPath ? humanizeSegment(segments[segments.length - 1] ?? path) : name} (${path})`;
}

/** Home first, then by path, so a CMS item page sits under its list page. */
export function sortPagesByPath(pages: ReadonlyArray<FramerProjectPage>): FramerProjectPage[] {
  return [...pages].sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)));
}
