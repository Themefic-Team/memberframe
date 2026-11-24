/**
 * The Home promo campaign card's rules (37-promo-campaign-card.md, ported from Hydra Booking): what the backend's answer must
 * hold to be shown, who sees it, and the offer window kept in this browser.
 * Pure functions, no storage and no clock of their own: the hook
 * (`hooks/useAnnouncement.ts`) passes `now` in.
 *
 * The window is local only (no database rows): per account, Framer project,
 * and campaign id. Closing the card, or its countdown running out, hides it
 * for seven days, or until a running trial ends if that comes first. The
 * countdown hides the card; it does not end the discount (the Stripe promotion code does).
 */

import type { LicenseState, PlanId } from "../services/licenseService";

export interface CampaignCountdown {
  enabled: boolean;
  durationMinutes: number | null;
  visibleMinutes: number | null;
}

/** Who sees the card: free is every site without a paid plan (none, trial, expired). */
export type CampaignAudience = "free" | "monthly" | "yearly" | "lifetime";
const AUDIENCES: ReadonlyArray<CampaignAudience> = ["free", "monthly", "yearly", "lifetime"];

/** The backend's `campaign`, as validated here. */
export interface AnnouncementCampaign {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  couponCode: string | null;
  showTo: "free" | "all";
  /** Exactly who sees it (ANNOUNCEMENT_SHOW_TO). */
  audience: CampaignAudience[];
  countdown: CampaignCountdown;
}

export const ANNOUNCEMENT_PLUGIN_ID = "memberframe";
export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DURATION_MINUTES = 7 * 24 * 60;
/** A start more than this far in the future means the clock moved back: start over. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const CAMPAIGN_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const COUPON = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

const text = (value: unknown, max: number): string | null => (typeof value === "string" ? Array.from(value.trim()).slice(0, max).join("") : null);
const minutes = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_DURATION_MINUTES ? value : null);

/**
 * The campaign from GET /api/plugin/announcement, or null: switched off, an
 * older backend without `campaign`, or anything malformed. Nothing is filled
 * in: a missing title or button text hides the card.
 */
export function parseCampaign(payload: unknown): AnnouncementCampaign | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { campaign?: unknown }).campaign;
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const id = typeof source["id"] === "string" ? source["id"] : "";
  const title = text(source["title"], 80);
  const subtitle = source["subtitle"] === undefined ? "" : text(source["subtitle"], 160);
  const buttonText = text(source["buttonText"], 40);
  const coupon = source["couponCode"];
  if (!CAMPAIGN_ID.test(id) || !title || subtitle === null || !buttonText) return null;
  if (coupon !== null && coupon !== undefined && (typeof coupon !== "string" || !COUPON.test(coupon))) return null;

  const rawCountdown = source["countdown"];
  if (!rawCountdown || typeof rawCountdown !== "object") return null;
  const countdownSource = rawCountdown as Record<string, unknown>;
  let countdown: CampaignCountdown = { enabled: false, durationMinutes: null, visibleMinutes: null };
  if (countdownSource["enabled"] === true) {
    const duration = minutes(countdownSource["durationMinutes"]);
    const visible = countdownSource["visibleMinutes"] === null || countdownSource["visibleMinutes"] === undefined ? duration : minutes(countdownSource["visibleMinutes"]);
    if (duration === null || visible === null) return null;
    countdown = { enabled: true, durationMinutes: duration, visibleMinutes: Math.min(visible, duration) };
  } else if (countdownSource["enabled"] !== false) {
    return null;
  }

  const showTo = source["showTo"] === "all" ? "all" : "free";
  // A backend from before the audience list: free, or every one with all.
  const rawAudience = source["audience"];
  let audience: CampaignAudience[];
  if (rawAudience === undefined) audience = showTo === "all" ? [...AUDIENCES] : ["free"];
  else if (Array.isArray(rawAudience) && rawAudience.length > 0 && rawAudience.every((entry) => (AUDIENCES as ReadonlyArray<unknown>).includes(entry))) audience = rawAudience as CampaignAudience[];
  else return null;

  return {
    id,
    title,
    subtitle,
    buttonText,
    couponCode: typeof coupon === "string" ? coupon : null,
    showTo,
    audience,
    countdown,
  };
}

/**
 * Whether this site is in the audience: free without a paid plan (none,
 * trial, expired), else its paid plan's name. A paid plan of unknown kind is
 * shown only when every plan is in.
 */
export function campaignShown(campaign: AnnouncementCampaign, license: LicenseState | null, plan: PlanId | "trial" | null = null): boolean {
  if (license !== "active") return campaign.audience.includes("free");
  if (plan === "monthly" || plan === "yearly" || plan === "lifetime") return campaign.audience.includes(plan);
  return AUDIENCES.every((audience) => campaign.audience.includes(audience));
}

/** The localStorage key: plugin, account, Framer project, campaign. Account and project are hashes. */
export function offerStorageKey(scope: { accountHash: string; projectHash: string; campaignId: string }): string {
  return `framefic:announcement:v1:${ANNOUNCEMENT_PLUGIN_ID}:${scope.accountHash}:${scope.projectHash}:${scope.campaignId}`;
}

/** One site's offer window, as kept in this browser. Absolute times, in milliseconds. */
export interface OfferRecord {
  v: 1;
  startedAt: number;
  /** When the countdown ends. Null without a countdown. */
  deadline: number | null;
  /** The code was copied: the button now opens the plans. */
  copied: boolean;
  /** When it was closed, or ran out. */
  closedAt: number | null;
  /** Hidden until then: seven days after `closedAt`. */
  hiddenUntil: number | null;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const finiteOrNull = (value: unknown): value is number | null => value === null || finite(value);

/** A stored record, or null for anything missing, unreadable, or from another version. */
export function parseOfferRecord(raw: string | null): OfferRecord | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record["v"] !== 1 || !finite(record["startedAt"]) || !finiteOrNull(record["deadline"]) || typeof record["copied"] !== "boolean" || !finiteOrNull(record["closedAt"]) || !finiteOrNull(record["hiddenUntil"])) return null;
  return {
    v: 1,
    startedAt: record["startedAt"] as number,
    deadline: record["deadline"] as number | null,
    copied: record["copied"] as boolean,
    closedAt: record["closedAt"] as number | null,
    hiddenUntil: record["hiddenUntil"] as number | null,
  };
}

export function durationMs(campaign: AnnouncementCampaign): number | null {
  return campaign.countdown.enabled && campaign.countdown.durationMinutes ? Math.round(campaign.countdown.durationMinutes * 60_000) : null;
}

function freshRecord(campaign: AnnouncementCampaign, now: number): OfferRecord {
  const length = durationMs(campaign);
  return { v: 1, startedAt: now, deadline: length === null ? null : now + length, copied: false, closedAt: null, hiddenUntil: null };
}

/** Closed (by hand, or the countdown ran out) at `at`: hidden for seven days from then. */
export function closeOffer(record: OfferRecord, at: number): OfferRecord {
  return { ...record, closedAt: at, hiddenUntil: at + SNOOZE_MS };
}

/** When a closed card may return: seven days on, or a trial end that was still ahead when it closed and comes sooner. */
export function returnsAt(record: OfferRecord, trialEndsAt: number | null): number | null {
  if (record.hiddenUntil === null) return null;
  if (trialEndsAt !== null && record.closedAt !== null && trialEndsAt > record.closedAt && trialEndsAt < record.hiddenUntil) return trialEndsAt;
  return record.hiddenUntil;
}

export type OfferPhase = { kind: "hidden"; until: number } | { kind: "open"; deadline: number | null };

/**
 * The window at `now`: a new site starts one, a reload keeps its deadline, a
 * countdown past its deadline closes it, and a snooze that has passed starts
 * a fresh one (new countdown, code not yet copied). `changed`: write it back.
 */
export function settleOffer(stored: OfferRecord | null, campaign: AnnouncementCampaign, now: number, trialEndsAt: number | null): { record: OfferRecord; phase: OfferPhase; changed: boolean } {
  let record = stored;
  let changed = false;
  if (!record || record.startedAt > now + CLOCK_SKEW_MS) {
    record = freshRecord(campaign, now);
    changed = true;
  }

  const hiddenUntil = returnsAt(record, trialEndsAt);
  if (hiddenUntil !== null) {
    if (now < hiddenUntil) return { record, phase: { kind: "hidden", until: hiddenUntil }, changed };
    record = freshRecord(campaign, now);
    changed = true;
  }

  const length = durationMs(campaign);
  if (length === null) {
    // No countdown (or it was switched off): no deadline, no expiry.
    if (record.deadline !== null) {
      record = { ...record, deadline: null };
      changed = true;
    }
    return { record, phase: { kind: "open", deadline: null }, changed };
  }

  if (record.deadline === null) {
    // The countdown was switched on after this window began: it starts now.
    record = { ...record, startedAt: now, deadline: now + length };
    changed = true;
  } else if (record.deadline > record.startedAt + length) {
    // The duration was shortened: never longer than it now allows.
    record = { ...record, deadline: record.startedAt + length };
    changed = true;
  }

  if (now >= record.deadline!) {
    record = closeOffer(record, record.deadline!);
    changed = true;
    const until = returnsAt(record, trialEndsAt)!;
    if (now < until) return { record, phase: { kind: "hidden", until }, changed };
    // Ran out more than seven days ago, with the panel closed: a fresh window.
    record = freshRecord(campaign, now);
  }
  return { record, phase: { kind: "open", deadline: record.deadline }, changed };
}

/** "3:00", "0:09", or "1:05:00" past an hour. Rounds up, so the last second reads 0:01. */
export function countdownText(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
}

/** The timer shows only in the window's last `visibleMinutes`. */
export function countdownShown(campaign: AnnouncementCampaign, remainingMs: number): boolean {
  if (!campaign.countdown.enabled || campaign.countdown.visibleMinutes === null) return false;
  return remainingMs > 0 && remainingMs <= Math.round(campaign.countdown.visibleMinutes * 60_000);
}
