/**
 * The real SDK behind `PageChromeDeps`.
 *
 * Kept apart from `pageScaffoldService`, which imports the SDK for types only
 * so that every rule in it runs in a test against a plain object. This file is
 * the one place that reads live canvas nodes, and all it does is narrow them.
 */

import { framer, isComponentInstanceNode, isFrameNode, type CanvasNode } from "framer-plugin";
import type { ChromeBreakpoint, ChromeNode, PageChromeDeps } from "./pageScaffoldService";

/** The breakpoint attributes a new page copies, so its children stack the same way. */
const LAYOUT_KEYS = [
  "layout",
  "stackDirection",
  "stackDistribution",
  "stackAlignment",
  "stackWrapEnabled",
  "gap",
  "padding",
  "height",
  "minHeight",
] as const;

function toChromeNode(node: CanvasNode): ChromeNode {
  if (isComponentInstanceNode(node)) {
    return { id: node.id, name: node.name ?? node.componentName, kind: "component", position: node.position ?? null };
  }
  if (isFrameNode(node)) {
    return { id: node.id, name: node.name, kind: "frame", position: node.position ?? null };
  }
  const named = node as { name?: string | null; position?: string | null };
  return { id: node.id, name: named.name ?? null, kind: "other", position: named.position ?? null };
}

function toBreakpoint(node: CanvasNode): ChromeBreakpoint | null {
  if (!isFrameNode(node)) return null;
  const layoutAttributes: Record<string, unknown> = {};
  for (const key of LAYOUT_KEYS) {
    const value = node[key];
    if (value !== null && value !== undefined) layoutAttributes[key] = value;
  }
  return {
    id: node.id,
    isBreakpoint: node.isBreakpoint,
    isPrimaryBreakpoint: node.isPrimaryBreakpoint,
    layout: node.layout ?? null,
    layoutAttributes,
  };
}

export const framerPageChromeDeps: PageChromeDeps = {
  getNodesWithType: (type) => framer.getNodesWithType(type),
  async getBreakpoints(pageId) {
    const children = await framer.getChildren(pageId);
    return children.map(toBreakpoint).filter((node): node is ChromeBreakpoint => node !== null);
  },
  async getChildren(nodeId) {
    return (await framer.getChildren(nodeId)).map(toChromeNode);
  },
  cloneNode: (nodeId) => framer.cloneNode(nodeId),
  setParent: (nodeId, parentId, index) => framer.setParent(nodeId, parentId, index),
  removeNodes: (nodeIds) => framer.removeNodes(nodeIds),
  setAttributes: (nodeId, attributes) => framer.setAttributes(nodeId, attributes as Parameters<typeof framer.setAttributes>[1]),
};

/** The methods copying a header and footer needs, for `isAllowedTo`. */
export const PAGE_CHROME_METHODS = ["cloneNode", "setParent", "setAttributes", "removeNodes"] as const;
