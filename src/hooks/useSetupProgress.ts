import { useCallback, useEffect, useState } from "react";
import { framer } from "framer-plugin";
import { useConnection } from "./useConnection";
import { fetchTiers } from "../services/siteService";
import { fetchPayments } from "../services/paymentsService";
import { membershipPages, normalizePagePath } from "../services/pageScaffoldService";
import type { SiteSettingsDocument } from "../types/connection";

/** The quick guide's six steps, in order. */
export const SETUP_STEP_IDS = ["pages", "tiers", "payments", "signIn", "locks", "publish"] as const;
export type SetupStepId = (typeof SETUP_STEP_IDS)[number];
export type SetupDone = Record<SetupStepId, boolean>;

export interface SetupProgress {
  done: SetupDone;
  /** How many of the six are done. */
  count: number;
  /** False until the first check has answered. */
  known: boolean;
}

const NONE_DONE: SetupDone = { pages: false, tiers: false, payments: false, signIn: false, locks: false, publish: false };

/** Re-checked this often while the Home tab or the guide is showing. */
const REFRESH_MS = 15_000;

/** Every member page the Builder offers exists in the project. */
export function memberPagesDone(settings: SiteSettingsDocument, existingPaths: ReadonlyArray<string>): boolean {
  const required = membershipPages(settings.auth, { includePricing: true, includeRegistration: true });
  if (required.length === 0) return false;
  const existing = new Set(existingPaths.map(normalizePagePath));
  return required.every((page) => existing.has(normalizePagePath(page.path)));
}

/** At least one active tier is for sale: what members can pay for. */
export function paidTierDone(
  tiers: ReadonlyArray<{ isActive?: boolean; monthlyPriceMinor: number | null; annualPriceMinor: number | null; lifetimePriceMinor: number | null }>
): boolean {
  return tiers.some(
    (tier) =>
      tier.isActive !== false &&
      [tier.monthlyPriceMinor, tier.annualPriceMinor, tier.lifetimePriceMinor].some((price) => typeof price === "number" && price > 0)
  );
}

/** A sign in provider (Google, GitHub, Apple, Discord) is turned on. */
export function signInDone(settings: SiteSettingsDocument): boolean {
  return Object.entries(settings.integrations ?? {}).some(([id, integration]) => id.endsWith("_oauth") && integration.enabled);
}

/** A page lock is on, or a section lock exists. */
export function locksDone(settings: SiteSettingsDocument): boolean {
  return (settings.gatedPages ?? []).some((rule) => rule.enabled) || (settings.sectionLocks ?? []).length > 0;
}

/**
 * How far the creator is through the quick guide, from the real state of the
 * project and the site: nothing is ticked by hand, and nothing is ticked just
 * because its step was opened. Checked while `active` (the Home tab or the
 * guide is showing), on focus, and every 15 seconds, since tiers, gateways,
 * pages, and publishing all change outside this hook.
 */
export function useSetupProgress(active: boolean): SetupProgress & { refresh: () => void } {
  const { state } = useConnection();
  const settings = state.status === "connected" ? state.settings : null;
  const siteId = state.status === "connected" ? state.connection.siteId : null;
  const [progress, setProgress] = useState<{ done: SetupDone; known: boolean }>({ done: NONE_DONE, known: false });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!active || !settings || !siteId) return;
    let live = true;

    void (async () => {
      const [pages, tiers, payments, publish] = await Promise.allSettled([
        framer.getNodesWithType("WebPageNode"),
        fetchTiers(siteId),
        fetchPayments(siteId),
        framer.getPublishInfo(),
      ]);
      if (!live) return;

      const paths =
        pages.status === "fulfilled"
          ? pages.value.flatMap((node) => (typeof node.path === "string" && node.path.trim() !== "" ? [node.path] : []))
          : [];
      setProgress({
        known: true,
        done: {
          pages: memberPagesDone(settings, paths),
          tiers: tiers.status === "fulfilled" && tiers.value.kind === "ok" && paidTierDone(tiers.value.data.tiers),
          payments: payments.status === "fulfilled" && payments.value.kind === "ok" && payments.value.data.gateways.some((gateway) => gateway.connected),
          signIn: signInDone(settings),
          locks: locksDone(settings),
          // getPublishInfo throws on a project that was never published.
          publish: publish.status === "fulfilled" && Boolean(publish.value.production || publish.value.staging),
        },
      });
    })();

    return () => {
      live = false;
    };
  }, [active, settings, siteId, tick]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [active, refresh]);

  const count = SETUP_STEP_IDS.filter((id) => progress.done[id]).length;
  return { ...progress, count, refresh };
}
