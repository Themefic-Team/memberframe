/**
 * The Home promo campaign card's state (37-promo-campaign-card.md), ported
 * from Hydra Booking's. It waits for three things before it starts anything:
 * the backend's campaign, the account (the connected creator's email, or
 * `guest` when signed out: the card shows before sign in too), and this Framer
 * project's id. Until then Home shows a skeleton; if any is missing, off, or
 * not valid, the card is hidden. Nothing is stored before all three are known.
 * Signed out there is no license, so the campaign's `free` audience decides.
 *
 * The offer window lives in localStorage (services/announcementStore.ts), one
 * per account, project, and campaign: the deadline is an absolute time, so a
 * reload or reopening keeps it, and site A never touches site B.
 */

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "./useConnection";
import { useLicense } from "./useLicense";
import { fetchAnnouncement } from "../services/licenseService";
import { readProjectContext } from "../services/framerProjectService";
import { readOffer, scopeHash, writeOffer } from "../services/announcementStore";
import {
  campaignShown,
  closeOffer,
  offerStorageKey,
  parseCampaign,
  settleOffer,
  type AnnouncementCampaign,
  type OfferPhase,
  type OfferRecord,
} from "../utils/announcementRules";

/** The longest the skeleton shows, whatever is still pending: then the card is hidden. */
const LOADING_LIMIT_MS = 10_000;
/** A successful answer is reused for a minute, so going back to Home does not flash a skeleton. */
const CACHE_MS = 60_000;
/** The account scope for a signed out panel: one offer window per project in this browser. */
const GUEST_ACCOUNT = "guest";
/** setTimeout's ceiling (about 24.8 days). */
const MAX_TIMER_MS = 2_147_483_647;

let cachedCampaign: { at: number; campaign: AnnouncementCampaign | null } | null = null;

/** Test only. */
export function resetAnnouncementCache(): void {
  cachedCampaign = null;
}

type Load<T> = { status: "loading" } | { status: "ready"; value: T };
const LOADING = { status: "loading" } as const;
const fresh = () => (cachedCampaign && Date.now() - cachedCampaign.at < CACHE_MS ? cachedCampaign : null);

function useCampaign(active: boolean): Load<AnnouncementCampaign | null> {
  const [state, setState] = useState<Load<AnnouncementCampaign | null>>(() => {
    const hit = fresh();
    return hit ? { status: "ready", value: hit.campaign } : LOADING;
  });
  useEffect(() => {
    if (!active) return;
    const hit = fresh();
    if (hit) {
      setState({ status: "ready", value: hit.campaign });
      return;
    }
    let alive = true;
    void fetchAnnouncement().then((result) => {
      if (!alive) return;
      const campaign = result.kind === "ok" ? parseCampaign(result.data) : null;
      // Only an answer is cached: a failure is asked again next time Home opens.
      if (result.kind === "ok") cachedCampaign = { at: Date.now(), campaign };
      setState({ status: "ready", value: campaign });
    });
    return () => {
      alive = false;
    };
  }, [active]);
  return state;
}

interface Scope {
  accountHash: string;
  projectHash: string;
}

/** The account and Framer project, hashed. Null when the project id cannot be read (outside Framer). */
function useScope(account: string | null): Load<Scope | null> {
  const [state, setState] = useState<{ account: string; scope: Scope | null } | null>(null);
  useEffect(() => {
    if (!account) return;
    let alive = true;
    void (async () => {
      const project = await readProjectContext();
      const projectId = project.unavailable ? "" : project.projectId.trim();
      const [accountHash, projectHash] = projectId ? await Promise.all([scopeHash("account", account), scopeHash("project", projectId)]) : [null, null];
      if (alive) setState({ account, scope: accountHash && projectHash ? { accountHash, projectHash } : null });
    })();
    return () => {
      alive = false;
    };
  }, [account]);
  if (!account || state?.account !== account) return LOADING;
  return { status: "ready", value: state.scope };
}

export type AnnouncementView =
  | { status: "loading" }
  | { status: "hidden" }
  | {
      status: "open";
      campaign: AnnouncementCampaign;
      /** The code was copied in this window: the button opens the plans. */
      copied: boolean;
      /** Until the countdown ends; null without one. */
      remainingMs: number | null;
      close: () => void;
      markCopied: () => void;
    };

export function useAnnouncement(): AnnouncementView {
  const { state, connection } = useConnection();
  const { view: license } = useLicense();
  /** The connection has answered: connected, signed out, or waiting for a code. */
  const resolved = state.status !== "loading";
  const email = connection?.creatorEmail.trim().toLowerCase() ?? "";
  const account = !resolved ? null : email || GUEST_ACCOUNT;
  const config = useCampaign(resolved);
  const scope = useScope(account);

  const campaign = config.status === "ready" ? config.value : null;
  // Connected: wait for the site's license, so a paid plan never flashes a free offer.
  // Signed out: there is none, and the `free` audience decides.
  const licenseKnown = connection ? license !== null : true;
  const eligible = Boolean(campaign && licenseKnown && campaignShown(campaign, connection ? license?.state ?? null : null, connection ? license?.plan ?? null : null));
  const key = eligible && campaign && scope.status === "ready" && scope.value ? offerStorageKey({ ...scope.value, campaignId: campaign.id }) : null;
  const parsedTrialEnd = connection && license?.state === "trial" && license.trialEndsAt ? Date.parse(license.trialEndsAt) : Number.NaN;
  const trialEndsAt = Number.isFinite(parsedTrialEnd) ? parsedTrialEnd : null;

  const [offer, setOffer] = useState<{ key: string; record: OfferRecord; phase: OfferPhase } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);

  /** Read the window back and bring it up to date: start, expire, or return after the snooze. */
  const settle = useCallback(() => {
    if (!key || !campaign) return;
    const at = Date.now();
    const result = settleOffer(readOffer(key), campaign, at, trialEndsAt);
    if (result.changed) writeOffer(key, result.record);
    setNow(at);
    setOffer({ key, record: result.record, phase: result.phase });
  }, [key, campaign, trialEndsAt]);

  useEffect(() => {
    settle();
  }, [settle]);

  // Another panel of this browser closed it or copied the code; or the panel comes back from the background.
  useEffect(() => {
    if (!key) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) settle();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") settle();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, settle]);

  const current = offer && offer.key === key ? offer : null;
  const deadline = current?.phase.kind === "open" ? current.phase.deadline : null;
  const hiddenUntil = current?.phase.kind === "hidden" ? current.phase.until : null;

  // The countdown: remaining time is always the deadline minus the clock, never a counter.
  useEffect(() => {
    if (deadline === null) return;
    const id = window.setInterval(() => {
      const at = Date.now();
      if (at >= deadline) settle();
      else setNow(at);
    }, 250);
    return () => window.clearInterval(id);
  }, [deadline, settle]);

  // A snooze that ends while the panel is open (a trial ending) brings the card back.
  useEffect(() => {
    if (hiddenUntil === null) return;
    const id = window.setTimeout(settle, Math.min(Math.max(hiddenUntil - Date.now(), 0) + 50, MAX_TIMER_MS));
    return () => window.clearTimeout(id);
  }, [hiddenUntil, settle]);

  const pending = !resolved || config.status === "loading" || scope.status === "loading" || (Boolean(campaign) && !licenseKnown) || (key !== null && !current);
  useEffect(() => {
    if (!pending) {
      setTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setTimedOut(true), LOADING_LIMIT_MS);
    return () => window.clearTimeout(id);
  }, [pending]);

  const close = useCallback(() => {
    if (!key || !current) return;
    writeOffer(key, closeOffer(readOffer(key) ?? current.record, Date.now()));
    settle();
  }, [key, current, settle]);

  const markCopied = useCallback(() => {
    if (!key || !current) return;
    const record = { ...(readOffer(key) ?? current.record), copied: true };
    writeOffer(key, record);
    setOffer({ ...current, record });
  }, [key, current]);

  if (pending) return timedOut ? { status: "hidden" } : { status: "loading" };
  if (!key || !campaign || !current || current.phase.kind === "hidden") return { status: "hidden" };
  return {
    status: "open",
    campaign,
    copied: current.record.copied,
    remainingMs: current.phase.deadline === null ? null : Math.max(0, current.phase.deadline - now),
    close,
    markCopied,
  };
}
