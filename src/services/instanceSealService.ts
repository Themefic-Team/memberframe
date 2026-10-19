/**
 * The seal on every component the Builder inserts, and the rule that tells a
 * pasted copy from the original (27-instance-seal.md).
 *
 * Framer's clipboard cannot be turned off. A copy carries the original's
 * seal, so the plugin keeps a record of which node each seal was issued to,
 * and one Builder insert stays one working component: a second node holding
 * the same seal is a copy, and its seal is cleared, which locks it.
 *
 * The rule is pure, so it is tested without Framer; `hooks/useSealGuard.ts`
 * reads the canvas and applies what it decides.
 */

import { apiClient, type ApiClient, type ApiResult } from "./apiClient";

/** Project plugin data: `{ [seal]: nodeId }`. */
export const SEAL_REGISTRY_KEY = "memberframe.seals";
/** Set once every instance from before seals existed has been given one. */
export const SEALS_MIGRATED_KEY = "memberframe.sealsMigrated";
/** The hidden property control that carries the seal. */
export const SEAL_CONTROL = "mfSeal";
/** What every licensed component file contains, whatever it is called. */
export const LICENSE_MARKER = "// @memberframe-license-start";

export type SealRegistry = Record<string, string>;

export function requestSeal(siteId: string, client: ApiClient = apiClient): Promise<ApiResult<{ seal: string }>> {
  return client.post("/api/plugin/instance-seal", { siteId });
}

export function verifySeals(siteId: string, seals: ReadonlyArray<string>, client: ApiClient = apiClient): Promise<ApiResult<{ valid: string[] }>> {
  return client.post("/api/plugin/instance-seal/verify", { siteId, seals });
}

export function parseRegistry(raw: string | null): SealRegistry {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: SealRegistry = {};
    for (const [seal, node] of Object.entries(value)) if (typeof node === "string") out[seal] = node;
    return out;
  } catch {
    return {};
  }
}

/** One MemberFrame component instance on the canvas. Breakpoint replicas are left out by the caller. */
export interface SealedInstance {
  nodeId: string;
  /** undefined: the control was never set (dragged in from Assets, or from before seals). "": cleared. */
  seal: string | undefined;
  /** False when its code file belongs to another project's site (pasted across projects). */
  ownSite: boolean;
}

export type SealAction =
  | { kind: "seal"; nodeId: string }
  | { kind: "clear"; nodeId: string }
  | { kind: "adopt"; nodeId: string; seal: string };

export interface SealPlan {
  actions: SealAction[];
  /** Seals the plugin has no record of: ask the server whether this site issued them. */
  unknown: string[];
}

/**
 * What to do with each instance.
 *
 * - Not migrated yet: every instance without a seal gets one (`seal`), so
 *   work from before this feature keeps working.
 * - A seal recorded for this node: nothing.
 * - A seal recorded for another node that still holds it: a copy, `clear`.
 * - A seal whose recorded node is gone (cut and pasted, or the original
 *   deleted): the first holder `adopt`s it, any others are copies.
 * - A seal with no record: asked about (`unknown`), then `resolveUnknown`.
 * - No seal after migration: not from the Builder, `clear` (sets "" so the
 *   component asks the server and locks).
 * - Its code file is another site's: `clear`, whatever the seal.
 */
export function planSeals(instances: ReadonlyArray<SealedInstance>, registry: SealRegistry, migrated: boolean): SealPlan {
  const actions: SealAction[] = [];
  const unknown = new Set<string>();
  const holders = new Map<string, string[]>();

  for (const instance of instances) {
    if (!instance.ownSite) {
      if (instance.seal !== "") actions.push({ kind: "clear", nodeId: instance.nodeId });
      continue;
    }
    if (instance.seal === undefined) {
      actions.push(migrated ? { kind: "clear", nodeId: instance.nodeId } : { kind: "seal", nodeId: instance.nodeId });
      continue;
    }
    if (instance.seal === "") continue;
    const list = holders.get(instance.seal) ?? [];
    list.push(instance.nodeId);
    holders.set(instance.seal, list);
  }

  for (const [seal, nodes] of holders) {
    const recorded = registry[seal];
    if (recorded === undefined) {
      unknown.add(seal);
      continue;
    }
    const keeper = nodes.includes(recorded) ? recorded : nodes[0]!;
    if (keeper !== recorded) actions.push({ kind: "adopt", nodeId: keeper, seal });
    for (const node of nodes) if (node !== keeper) actions.push({ kind: "clear", nodeId: node });
  }

  return { actions, unknown: [...unknown] };
}

/** After the server answers: a valid unknown seal is adopted by its first holder, an invalid one cleared everywhere. */
export function resolveUnknown(instances: ReadonlyArray<SealedInstance>, unknown: ReadonlyArray<string>, valid: ReadonlyArray<string>): SealAction[] {
  const actions: SealAction[] = [];
  for (const seal of unknown) {
    const nodes = instances.filter((instance) => instance.ownSite && instance.seal === seal).map((instance) => instance.nodeId);
    if (nodes.length === 0) continue;
    if (valid.includes(seal)) {
      actions.push({ kind: "adopt", nodeId: nodes[0]!, seal });
      for (const node of nodes.slice(1)) actions.push({ kind: "clear", nodeId: node });
    } else {
      for (const node of nodes) actions.push({ kind: "clear", nodeId: node });
    }
  }
  return actions;
}

/** The registry after a set of actions. `sealed` maps each newly sealed node to its new seal. */
export function applyToRegistry(registry: SealRegistry, actions: ReadonlyArray<SealAction>, sealed: Record<string, string>): SealRegistry {
  const next = { ...registry };
  for (const action of actions) {
    if (action.kind === "adopt") next[action.seal] = action.nodeId;
    if (action.kind === "seal" && sealed[action.nodeId]) next[sealed[action.nodeId]!] = action.nodeId;
  }
  return next;
}

/** The site key baked into a component file's CONFIG, or null. */
export function siteKeyOfFile(content: string): string | null {
  const match = /\bsiteKey:\s*"([^"]*)"/.exec(content);
  return match ? match[1]! : null;
}

/** A module URL without its query, fragment, or `@version` suffix, so two versions of one file compare equal. */
function stableModuleUrl(url: string): string {
  return url.replace(/[?#].*$/, "").replace(/@[^/]*$/, "");
}

/**
 * Whether a canvas instance was made from this code file. Framer does not
 * document the URL format, so this accepts an exact insert URL, the same URL
 * at another file version, or an identifier that names the file.
 */
export function instanceOfFile(
  instance: { insertURL: string | null; componentIdentifier: string },
  file: { id: string; path?: string; exports: ReadonlyArray<object> }
): boolean {
  for (const raw of file.exports) {
    const entry = raw as { insertURL?: string };
    if (!entry.insertURL || !instance.insertURL) continue;
    if (entry.insertURL === instance.insertURL) return true;
    if (stableModuleUrl(entry.insertURL) === stableModuleUrl(instance.insertURL)) return true;
  }
  const id = instance.componentIdentifier;
  return Boolean(id) && (id.includes(file.id) || (Boolean(file.path) && id.includes(file.path!)));
}
