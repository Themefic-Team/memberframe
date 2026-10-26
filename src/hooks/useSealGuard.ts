/**
 * Locks pasted copies of MemberFrame components while the panel is open
 * (27-instance-seal.md). Reads every component instance, decides with the
 * pure rule in `services/instanceSealService.ts`, and writes back only what
 * changed: a seal cleared on a copy, a seal recorded for the node that keeps it.
 *
 * Runs when the canvas changes (Framer's canvas and selection events, a second
 * after the last one; a paste selects what it pasted), when Framer regains
 * focus, and once a minute as a fallback. A pass that finds the canvas as the
 * last finished pass left it stops at once. Each unknown seal is asked about
 * once per session, and after a failure the guard waits (30 seconds, rising
 * to 10 minutes) before it asks the server anything again. An idle canvas
 * sends nothing. Never throws: a canvas it cannot read is left as it is.
 */

import { useEffect, useRef } from "react";
import { framer } from "framer-plugin";
import { useConnection } from "./useConnection";
import { deployBaseUrl } from "../config/backend";
import { missingPublishedOrigins } from "../services/framerProjectService";
import { addAllowedOrigins } from "../services/siteSettingsService";
import { syncSiteConfig, type PatchableFile } from "../utils/configPatcher";
import {
  LEGACY_SECTION_LOCKS_FILE_NAME,
  SECTION_LOCKS_FILE_NAME,
  sectionLocksCode,
  staleSectionLocksFile,
} from "../services/sectionLocks";
import { writeCodeFile } from "../services/framerCanvasService";
import { ARTICLE_TAG_FILE_NAME, articleTagCode } from "../services/articleTag";
import { PROTECTED_DOWNLOAD_FILE_NAME } from "../services/canvasComponentCodeGenerator";
import { assetsFailure } from "../services/assetsService";
import {
  DOWNLOAD_RULES_KEY,
  fileUrlOf,
  parseDownloadRules,
  planDownload,
  readDownloadControls,
  ruleOf,
  SAVED_PASSWORD,
  securePlan,
  shortHash,
  type DownloadState,
} from "../services/downloadVault";
import {
  LICENSE_MARKER,
  SEAL_CONTROL,
  SEAL_REGISTRY_KEY,
  SEALS_MIGRATED_KEY,
  applyToRegistry,
  instanceOfFile,
  nextRetryDelay,
  parseRegistry,
  planSeals,
  pruneRegistry,
  requestSeal,
  resolveUnknown,
  sealFingerprint,
  siteKeyOfFile,
  verifySeals,
  type SealAction,
  type SealedInstance,
} from "../services/instanceSealService";

/** The fallback pass, for a change Framer's events did not report. */
const GUARD_INTERVAL_MS = 60_000;
/** Canvas events come in bursts (a drag, a paste); one pass after the burst. */
const GUARD_DEBOUNCE_MS = 1_000;

/** The server's answer for each seal asked about this session, keyed `siteId|seal`: valid for that site or not. */
const answeredSeals = new Map<string, boolean>();

/** Backoff for one kind of request: failed tries in a row, and when the next may go. */
interface Backoff {
  failures: number;
  retryAt: number;
}

interface GuardState {
  /** The fingerprint of the last pass that finished with nothing left to do. */
  settled: string | null;
  seals: Backoff;
  origins: Backoff;
  downloads: Backoff;
  /** Messages already shown this session, so a waiting download does not repeat its toast. */
  told: Set<string>;
}

function waiting(backoff: Backoff): boolean {
  return Date.now() < backoff.retryAt;
}

function failed(backoff: Backoff): void {
  backoff.failures += 1;
  backoff.retryAt = Date.now() + nextRetryDelay(backoff.failures);
}

function succeeded(backoff: Backoff): void {
  backoff.failures = 0;
  backoff.retryAt = 0;
}

interface InstanceNode {
  id: string;
  isReplica?: boolean;
  originalId?: string | null;
  insertURL: string | null;
  componentIdentifier: string;
  controls: Record<string, unknown>;
  setAttributes(update: { controls: Record<string, unknown> }): Promise<unknown>;
}

async function guardOnce(siteId: string, siteKey: string, state: GuardState): Promise<number> {
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
  const fingerprint = sealFingerprint(instances, registry, migrated);
  // Nothing changed since the last finished pass: nothing to ask or write.
  if (fingerprint === state.settled) return 0;
  // A recent failure: wait before asking the server or writing again.
  if (waiting(state.seals)) return 0;

  const plan = planSeals(instances, registry, migrated);
  const actions: SealAction[] = [...plan.actions];

  if (plan.unknown.length > 0) {
    const toAsk = plan.unknown.filter((seal) => !answeredSeals.has(`${siteId}|${seal}`));
    if (toAsk.length > 0) {
      const answer = await verifySeals(siteId, toAsk);
      // No answer, no change: an unreachable server never locks anything.
      if (answer.kind !== "ok") {
        failed(state.seals);
        return 0;
      }
      for (const seal of toAsk) answeredSeals.set(`${siteId}|${seal}`, answer.data.valid.includes(seal));
    }
    const valid = plan.unknown.filter((seal) => answeredSeals.get(`${siteId}|${seal}`) === true);
    actions.push(...resolveUnknown(instances, plan.unknown, valid));
  }

  // Every new seal comes from the server, first. If any request fails (the
  // server is down, or the browser blocks it), this pass changes nothing and
  // is not counted: an unreachable server must never lock a component. An
  // earlier version marked the pass done anyway, and the next pass locked
  // every component it had failed to seal.
  const sealed: Record<string, string> = {};
  for (const action of actions) {
    if (action.kind !== "seal" || !byId.has(action.nodeId)) continue;
    const issued = await requestSeal(siteId);
    if (issued.kind !== "ok") {
      failed(state.seals);
      return 0;
    }
    sealed[action.nodeId] = issued.data.seal;
  }

  let cleared = 0;
  try {
    for (const action of actions) {
      const node = byId.get(action.nodeId);
      if (!node) continue;
      if (action.kind === "clear") {
        await node.setAttributes({ controls: { [SEAL_CONTROL]: "" } });
        cleared += 1;
      } else if (action.kind === "seal" && sealed[node.id]) {
        await node.setAttributes({ controls: { [SEAL_CONTROL]: sealed[node.id] } });
      }
    }

    // Only the seals still on the canvas, and the ones just issued, are kept.
    const held = new Set<string>(Object.values(sealed));
    for (const instance of instances) if (instance.seal) held.add(instance.seal);
    const next = pruneRegistry(applyToRegistry(registry, actions, sealed), held);
    if (JSON.stringify(next) !== JSON.stringify(registry)) await framer.setPluginData(SEAL_REGISTRY_KEY, JSON.stringify(next));
    if (!migrated) await framer.setPluginData(SEALS_MIGRATED_KEY, "1");
  } catch {
    // A write Framer refused: try again after the backoff. The answers above
    // are remembered, so the retry asks the server nothing it already asked.
    failed(state.seals);
    return cleared;
  }

  succeeded(state.seals);
  // Settled only when the pass found nothing to do; after changes, the next
  // pass reads the canvas they left and settles there.
  if (actions.length === 0 && migrated) state.settled = fingerprint;
  return cleared;
}

/**
 * Empty a Protected Download's File control. Framer documents no "no file"
 * value, and ignored `null` on 2026-10-22, so each likely one is tried and the
 * layer read back after it. True once the control reads empty.
 */
async function clearFileControl(node: InstanceNode): Promise<boolean> {
  for (const empty of [undefined, null, ""]) {
    try {
      await node.setAttributes({ controls: { file: empty } });
      const fresh = (await framer.getNode(node.id)) as unknown as InstanceNode | null;
      if (fresh && fileUrlOf(fresh.controls?.["file"]) === "") return true;
    } catch {
      // Refused: try the next.
    }
  }
  return false;
}

/** A password file whose password is saved on the server, while its field reads empty. */
function showsNoPassword(node: InstanceNode, controls: DownloadState, synced: Readonly<Record<string, string>>): boolean {
  return (
    controls.assetId !== "" &&
    ruleOf(controls) === "password" &&
    (synced[controls.assetId] ?? "").startsWith("password|") &&
    node.controls?.["password"] !== SAVED_PASSWORD
  );
}

/**
 * Move each Protected Download's canvas file, and any password, to the server,
 * then clear them from the component (32-canvas-downloads.md). Until then the
 * file's Framer address is in the component's props, which a published page
 * carries. Only changes are sent; a server failure leaves the canvas as it is
 * and waits before trying again. Returns how many files were secured.
 */
async function secureDownloadsOnce(siteId: string, state: GuardState): Promise<number> {
  if (waiting(state.downloads)) return 0;
  const file = (await framer.getCodeFiles()).find((candidate) => candidate.name === PROTECTED_DOWNLOAD_FILE_NAME);
  if (!file) return 0;

  const nodes = (await framer.getNodesWithType("ComponentInstanceNode")) as unknown as InstanceNode[];
  const instances = nodes.filter((node) => !node.isReplica && !node.originalId && instanceOfFile(node, file));
  if (instances.length === 0) return 0;

  const synced = parseDownloadRules(await framer.getPluginData(DOWNLOAD_RULES_KEY));
  const next = { ...synced };
  let secured = 0;

  for (const node of instances) {
    const controls = readDownloadControls(node.controls);
    const plan = planDownload(controls, synced);
    if (plan.kind === "none") {
      // Saved before the mark existed, or the field was emptied: show it as set again.
      if (showsNoPassword(node, controls, synced)) await node.setAttributes({ controls: { password: SAVED_PASSWORD } });
      continue;
    }
    const outcome = await securePlan(siteId, plan, controls);

    if (outcome.kind === "blocked") {
      if (!state.told.has(outcome.message)) {
        state.told.add(outcome.message);
        framer.notify(outcome.message, { variant: "warning" });
      }
      continue;
    }
    if (outcome.kind === "failed") {
      failed(state.downloads);
      framer.notify(`A download file could not be secured: ${assetsFailure(outcome.result)}`, { variant: "error" });
      break;
    }
    if (outcome.kind === "none") continue;

    next[outcome.assetId] = outcome.fingerprint;
    if (outcome.kind === "adopted") continue;

    // The asset id first, with which file it holds, so a failure clearing the
    // file never loses it and the component can tell a saved file from a new one.
    await node.setAttributes({
      controls: {
        assetId: outcome.assetId,
        // A password file keeps a fixed mark, so the field reads as set; never the password.
        password: ruleOf(controls) === "password" ? SAVED_PASSWORD : "",
        ...(controls.fileUrl ? { fileSecured: shortHash(controls.fileUrl) } : {}),
      },
    });
    if (controls.fileUrl && !(await clearFileControl(node)) && !state.told.has(`clear:${outcome.assetId}`)) {
      state.told.add(`clear:${outcome.assetId}`);
      framer.notify("The file is saved. Clear the File field in the sidebar before publishing, so its address stays private.", {
        variant: "warning",
      });
    }
    secured += 1;
  }

  if (JSON.stringify(next) !== JSON.stringify(synced)) await framer.setPluginData(DOWNLOAD_RULES_KEY, JSON.stringify(next));
  if (secured > 0) succeeded(state.downloads);
  return secured;
}

/** Record the node the Builder just inserted, so it is the one that keeps its seal. */
export async function recordSeal(seal: string, nodeId: string): Promise<void> {
  try {
    if (!framer.isAllowedTo("setPluginData")) return;
    const registry = parseRegistry(await framer.getPluginData(SEAL_REGISTRY_KEY));
    registry[seal] = nodeId;
    await framer.setPluginData(SEAL_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // The guard adopts an unrecorded seal after asking the server, so a lost write locks nothing.
  }
}

/**
 * Allow every address this project is published at. Without it, a site first
 * published after connecting answers `foreign` on its own domain, and every
 * component there draws the "copied, not inserted" lock. Asks the server only
 * when an address is missing, and waits after a failure.
 */
async function syncPublishedOrigins(
  siteId: string,
  allowed: ReadonlyArray<string>,
  backoff: Backoff,
  onUpdated: (origins: string[]) => Promise<void>
): Promise<void> {
  const missing = missingPublishedOrigins(await framer.getPublishInfo(), allowed);
  if (missing.length === 0 || waiting(backoff)) return;
  const result = await addAllowedOrigins(siteId, missing);
  if (result.kind !== "ok") {
    failed(backoff);
    return;
  }
  succeeded(backoff);
  await onUpdated(result.data.allowedOrigins);
}

export function useSealGuard(): void {
  const { connection, applyConnection, settings } = useConnection();
  const siteId = connection?.siteId ?? null;
  const siteKey = connection?.siteKey ?? null;
  // Read inside the pass, so a change to the list does not restart the guard.
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!siteId || siteKey === null) return;
    let running = false;
    let again = false;
    let stopped = false;
    let debounce: number | null = null;
    const state: GuardState = {
      settled: null,
      seals: { failures: 0, retryAt: 0 },
      origins: { failures: 0, retryAt: 0 },
      downloads: { failures: 0, retryAt: 0 },
      told: new Set(),
    };

    const run = async () => {
      if (stopped) return;
      if (running) {
        // A change during a pass gets one more pass after it.
        again = true;
        return;
      }
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
          // The locks files as the saved rules and the current generator say,
          // so a fix to the overrides reaches projects without a lock being saved.
          // That is MemberFrameLocks.tsx, and MemberLocks.tsx where a project
          // still has it from before the rename (its layers point at it).
          const rules = settingsRef.current?.sectionLocks;
          for (const name of [SECTION_LOCKS_FILE_NAME, LEGACY_SECTION_LOCKS_FILE_NAME]) {
            const locksFile = files.find((file) => file.name === name);
            if (rules && locksFile && staleSectionLocksFile(locksFile.content, rules) && !stopped) {
              await locksFile.setFileContent(sectionLocksCode(rules));
              framer.notify("Updated MemberFrameLocks for this site. Publish to update your live site.", { variant: "info" });
            }
          }
          // A project from before the rename gets the new file once, so Code
          // overrides lists MemberFrameLocks for the next layer it locks.
          const hasLegacy = files.some((file) => file.name === LEGACY_SECTION_LOCKS_FILE_NAME);
          const hasCurrent = files.some((file) => file.name === SECTION_LOCKS_FILE_NAME);
          if (rules && rules.length > 0 && hasLegacy && !hasCurrent && !stopped) {
            await writeCodeFile(framer, SECTION_LOCKS_FILE_NAME, sectionLocksCode(rules));
          }
          // MemberArticle.tsx holds no creator input: any other content is an older plugin's.
          const articleFile = files.find((file) => file.name === ARTICLE_TAG_FILE_NAME);
          if (articleFile && articleFile.content !== articleTagCode() && !stopped) {
            await articleFile.setFileContent(articleTagCode());
            framer.notify("Updated MemberArticle for this site. Publish to update your live site.", { variant: "info" });
          }
        }
        await syncPublishedOrigins(siteId, connectionRef.current?.allowedOrigins ?? [], state.origins, async (origins) => {
          const current = connectionRef.current;
          if (current && !stopped) await applyConnection({ ...current, allowedOrigins: origins });
        }).catch(() => undefined);
        const securedFiles = await secureDownloadsOnce(siteId, state).catch(() => 0);
        if (securedFiles > 0 && !stopped) {
          framer.notify(
            securedFiles === 1
              ? "Secured 1 download file. Publish to update your live site."
              : `Secured ${securedFiles} download files. Publish to update your live site.`,
            { variant: "success" }
          );
        }
        const cleared = await guardOnce(siteId, siteKey, state);
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
        if (again && !stopped) {
          again = false;
          schedule();
        }
      }
    };

    const schedule = () => {
      if (stopped) return;
      if (debounce !== null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        void run();
      }, GUARD_DEBOUNCE_MS);
    };

    void run();
    const unsubscribes: Array<() => void> = [];
    try {
      unsubscribes.push(framer.subscribeToCanvasRoot(schedule));
      unsubscribes.push(framer.subscribeToSelection(schedule));
    } catch {
      // Outside Framer: the fallback timer and focus still run the guard.
    }
    const timer = window.setInterval(() => void run(), GUARD_INTERVAL_MS);
    window.addEventListener("focus", schedule);
    return () => {
      stopped = true;
      if (debounce !== null) window.clearTimeout(debounce);
      window.clearInterval(timer);
      window.removeEventListener("focus", schedule);
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [applyConnection, siteId, siteKey]);
}
