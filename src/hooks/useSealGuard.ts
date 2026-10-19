/**
 * Locks pasted copies of MemberFrame components while the panel is open
 * (27-instance-seal.md). Reads every component instance, decides with the
 * pure rule in `services/instanceSealService.ts`, and writes back only what
 * changed: a seal cleared on a copy, a seal recorded for the node that keeps it.
 *
 * Runs on open, every 10 seconds, and when Framer regains focus. Never throws:
 * a canvas it cannot read is left as it is.
 */

import { useEffect } from "react";
import { framer } from "framer-plugin";
import { useConnection } from "./useConnection";
import { deployBaseUrl } from "../config/backend";
import { syncSiteConfig, type PatchableFile } from "../utils/configPatcher";
import {
  LICENSE_MARKER,
  SEAL_CONTROL,
  SEAL_REGISTRY_KEY,
  SEALS_MIGRATED_KEY,
  applyToRegistry,
  instanceOfFile,
  parseRegistry,
  planSeals,
  requestSeal,
  resolveUnknown,
  siteKeyOfFile,
  verifySeals,
  type SealAction,
  type SealedInstance,
} from "../services/instanceSealService";

const GUARD_INTERVAL_MS = 10_000;

interface InstanceNode {
  id: string;
  isReplica?: boolean;
  originalId?: string | null;
  insertURL: string | null;
  componentIdentifier: string;
  controls: Record<string, unknown>;
  setAttributes(update: { controls: Record<string, unknown> }): Promise<unknown>;
}

async function guardOnce(siteId: string, siteKey: string): Promise<number> {
  if (!framer.isAllowedTo("Node.setAttributes", "setPluginData")) return 0;

  const files = (await framer.getCodeFiles()).filter((file) => typeof file.content === "string" && file.content.includes(LICENSE_MARKER));
  if (files.length === 0) return 0;

  const nodes = (await framer.getNodesWithType("ComponentInstanceNode")) as unknown as InstanceNode[];
  const byId = new Map<string, InstanceNode>();
  const instances: SealedInstance[] = [];
  for (const node of nodes) {
    // A breakpoint replica is the same layer at another width, not a copy.
    if (node.isReplica || node.originalId) continue;
    const file = files.find((candidate) => instanceOfFile(node, candidate));
    if (!file) continue;
    const fileKey = siteKeyOfFile(file.content);
    const raw = node.controls?.[SEAL_CONTROL];
    instances.push({
      nodeId: node.id,
      seal: typeof raw === "string" ? raw : undefined,
      ownSite: fileKey === null || fileKey === "" || fileKey === siteKey,
    });
    byId.set(node.id, node);
  }
  if (instances.length === 0) return 0;

  const registry = parseRegistry(await framer.getPluginData(SEAL_REGISTRY_KEY));
  const migrated = (await framer.getPluginData(SEALS_MIGRATED_KEY)) === "1";
  const plan = planSeals(instances, registry, migrated);
  const actions: SealAction[] = [...plan.actions];

  if (plan.unknown.length > 0) {
    const answer = await verifySeals(siteId, plan.unknown);
    // No answer, no change: an unreachable server never locks anything.
    if (answer.kind === "ok") actions.push(...resolveUnknown(instances, plan.unknown, answer.data.valid));
  }

  const sealed: Record<string, string> = {};
  let cleared = 0;
  for (const action of actions) {
    const node = byId.get(action.nodeId);
    if (!node) continue;
    if (action.kind === "clear") {
      await node.setAttributes({ controls: { [SEAL_CONTROL]: "" } });
      cleared += 1;
    } else if (action.kind === "seal") {
      const issued = await requestSeal(siteId);
      if (issued.kind !== "ok") continue;
      await node.setAttributes({ controls: { [SEAL_CONTROL]: issued.data.seal } });
      sealed[node.id] = issued.data.seal;
    }
  }

  const next = applyToRegistry(registry, actions, sealed);
  if (JSON.stringify(next) !== JSON.stringify(registry)) await framer.setPluginData(SEAL_REGISTRY_KEY, JSON.stringify(next));
  if (!migrated) await framer.setPluginData(SEALS_MIGRATED_KEY, "1");
  return cleared;
}

/** Record the node the Builder just inserted, so it is the one that keeps its seal. */
export async function recordSeal(seal: string, nodeId: string): Promise<void> {
  try {
    const registry = parseRegistry(await framer.getPluginData(SEAL_REGISTRY_KEY));
    registry[seal] = nodeId;
    await framer.setPluginData(SEAL_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // The guard adopts an unrecorded seal after asking the server, so a lost write locks nothing.
  }
}

export function useSealGuard(): void {
  const { connection } = useConnection();
  const siteId = connection?.siteId ?? null;
  const siteKey = connection?.siteKey ?? null;

  useEffect(() => {
    if (!siteId || siteKey === null) return;
    let running = false;
    let stopped = false;
    const run = async () => {
      if (running || stopped) return;
      running = true;
      try {
        // First, point every deployed component at this site and server, so
        // a new sign in or another backend never leaves them calling a site
        // that does not exist.
        if (framer.isAllowedTo("CodeFile.setFileContent")) {
          const files = (await framer.getCodeFiles()) as unknown as ReadonlyArray<PatchableFile>;
          const updated = await syncSiteConfig(files, { siteKey, apiBaseUrl: deployBaseUrl() });
          if (updated > 0 && !stopped) {
            framer.notify(`Updated ${updated} MemberFrame component file${updated === 1 ? "" : "s"} for this site. Publish to update your live site.`, { variant: "info" });
          }
        }
        const cleared = await guardOnce(siteId, siteKey);
        if (cleared > 0 && !stopped) {
          framer.notify(
            cleared === 1
              ? "A pasted MemberFrame component was locked. Add components from the Builder."
              : `${cleared} pasted MemberFrame components were locked. Add components from the Builder.`,
            { variant: "warning" }
          );
        }
      } catch {
        // Outside Framer, or the canvas is read only.
      } finally {
        running = false;
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), GUARD_INTERVAL_MS);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [siteId, siteKey]);
}
