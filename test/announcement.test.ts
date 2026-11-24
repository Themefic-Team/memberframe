/**
 * The Home promo campaign card (37-promo-campaign-card.md), ported from Hydra Booking: the backend's answer as rendered, the
 * offer window kept in localStorage per account, project, and campaign, the
 * countdown, and the coupon button.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SNOOZE_MS,
  campaignShown,
  closeOffer,
  countdownShown,
  countdownText,
  offerStorageKey,
  parseCampaign,
  parseOfferRecord,
  settleOffer,
  type AnnouncementCampaign,
  type OfferRecord,
} from "../src/utils/announcementRules";
import { readOffer, resetOfferMemory, scopeHash, writeOffer } from "../src/services/announcementStore";
import { runOfferAction } from "../src/components/home/AnnouncementCard";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const T0 = Date.parse("2026-11-27T10:00:00Z");

/** The backend's answer for the documented example env. */
const payload = (patch: Record<string, unknown> = {}, countdown: Record<string, unknown> = {}) => ({
  enabled: true,
  title: "Black Friday Offer 2026",
  campaign: {
    id: "bfcm26",
    title: "Black Friday Offer 2026",
    subtitle: "Get Flat 50% Off on Lifetime Plan.",
    buttonText: "Grab the Deal Now",
    couponCode: "50LTDBFCM26",
    showTo: "free",
    countdown: { enabled: true, durationMinutes: 3, visibleMinutes: 3, ...countdown },
    ...patch,
  },
});
const campaign = (patch: Record<string, unknown> = {}, countdown: Record<string, unknown> = {}): AnnouncementCampaign => parseCampaign(payload(patch, countdown))!;

describe("the backend's campaign, as rendered", () => {
  it("takes the documented example as is", () => {
    expect(campaign()).toEqual({
      id: "bfcm26",
      title: "Black Friday Offer 2026",
      subtitle: "Get Flat 50% Off on Lifetime Plan.",
      buttonText: "Grab the Deal Now",
      couponCode: "50LTDBFCM26",
      showTo: "free",
      audience: ["free"],
      countdown: { enabled: true, durationMinutes: 3, visibleMinutes: 3 },
    });
  });

  it("shows nothing for a disabled campaign, an older backend, a failure body, or junk: no text is invented", () => {
    expect(parseCampaign({ enabled: false, campaign: null })).toBeNull();
    // A backend from before 2026-11-12 answers only the old card's fields.
    expect(parseCampaign({ enabled: true, title: "Free Tier · 7-Day Free Trial", buttonText: "Start Free Trial" })).toBeNull();
    for (const bad of [null, undefined, "x", 3, [], {}]) expect(parseCampaign(bad)).toBeNull();
  });

  it("refuses a malformed campaign rather than filling it in", () => {
    for (const patch of [{ id: "" }, { id: "BF CM" }, { title: "" }, { title: 5 }, { buttonText: "" }, { couponCode: "FOB 20" }, { couponCode: 20 }, { countdown: null }, { countdown: { enabled: "yes" } }]) {
      expect(parseCampaign(payload(patch)), JSON.stringify(patch)).toBeNull();
    }
    for (const countdown of [{ durationMinutes: 0 }, { durationMinutes: -3 }, { durationMinutes: Number.POSITIVE_INFINITY }, { durationMinutes: "3" }, { visibleMinutes: 0 }, { durationMinutes: 99999 }]) {
      expect(parseCampaign(payload({}, countdown)), JSON.stringify(countdown)).toBeNull();
    }
  });

  it("caps the visible countdown at the duration, and accepts a campaign with no coupon or countdown", () => {
    expect(campaign({}, { durationMinutes: 3, visibleMinutes: 10 }).countdown.visibleMinutes).toBe(3);
    const plain = campaign({ couponCode: null, countdown: { enabled: false, durationMinutes: null, visibleMinutes: null } });
    expect(plain.couponCode).toBeNull();
    expect(plain.countdown.enabled).toBe(false);
  });

  it("keeps configuration text as text: markup is not interpreted", () => {
    expect(campaign({ title: "<img src=x onerror=alert(1)>" }).title).toBe("<img src=x onerror=alert(1)>");
  });

  it("shows to the configured audience: free and monthly, but not yearly or lifetime subscribers", () => {
    const deal = campaign({ audience: ["free", "monthly"] });
    expect(campaignShown(deal, null)).toBe(true);
    expect(campaignShown(deal, "none")).toBe(true);
    expect(campaignShown(deal, "trial", "trial")).toBe(true);
    expect(campaignShown(deal, "expired", "monthly")).toBe(true);
    expect(campaignShown(deal, "active", "monthly")).toBe(true);
    expect(campaignShown(deal, "active", "yearly")).toBe(false);
    expect(campaignShown(deal, "active", "lifetime")).toBe(false);
    expect(campaignShown(deal, "active", null)).toBe(false);
    expect(campaignShown(campaign({ audience: ["monthly"] }), "trial")).toBe(false);
    expect(parseCampaign(payload({ audience: ["free", "weekly"] }))).toBeNull();
    expect(parseCampaign(payload({ audience: [] }))).toBeNull();
    expect(campaign({ showTo: "all", audience: undefined }).audience).toEqual(["free", "monthly", "yearly", "lifetime"]);
  });

  it("shows to free, trial, and expired sites; to paid ones only when set to all", () => {
    expect(campaignShown(campaign(), null)).toBe(true);
    expect(campaignShown(campaign(), "trial")).toBe(true);
    expect(campaignShown(campaign(), "expired")).toBe(true);
    expect(campaignShown(campaign(), "active")).toBe(false);
    expect(campaignShown(campaign({ showTo: "all" }), "active")).toBe(true);
  });
});

describe("the countdown text", () => {
  it("reads m:ss, rounding up, and h:mm:ss past an hour", () => {
    expect(countdownText(3 * MIN)).toBe("3:00");
    expect(countdownText(3 * MIN - 1)).toBe("3:00");
    expect(countdownText(9_000)).toBe("0:09");
    expect(countdownText(1)).toBe("0:01");
    expect(countdownText(0)).toBe("0:00");
    expect(countdownText(65 * MIN)).toBe("1:05:00");
  });

  it("shows only in the configured final interval", () => {
    const late = campaign({}, { durationMinutes: 60, visibleMinutes: 5 });
    expect(countdownShown(late, 30 * MIN)).toBe(false);
    expect(countdownShown(late, 5 * MIN)).toBe(true);
    expect(countdownShown(late, 1_000)).toBe(true);
    expect(countdownShown(campaign(), 3 * MIN)).toBe(true);
    expect(countdownShown(campaign({ countdown: { enabled: false } }), 3 * MIN)).toBe(false);
  });
});

describe("the offer window", () => {
  const bf = campaign();

  it("starts on a new site, and a reload or reopening keeps the same absolute deadline", () => {
    const first = settleOffer(null, bf, T0, null);
    expect(first.changed).toBe(true);
    expect(first.phase).toEqual({ kind: "open", deadline: T0 + 3 * MIN });
    const reopened = settleOffer(first.record, bf, T0 + 90_000, null);
    expect(reopened.changed).toBe(false);
    expect(reopened.phase).toEqual({ kind: "open", deadline: T0 + 3 * MIN });
  });

  it("closes itself when the countdown runs out, for seven days from the deadline", () => {
    const { record } = settleOffer(null, bf, T0, null);
    const expired = settleOffer(record, bf, T0 + 3 * MIN, null);
    expect(expired.changed).toBe(true);
    expect(expired.phase).toEqual({ kind: "hidden", until: T0 + 3 * MIN + SNOOZE_MS });
    expect(expired.record.closedAt).toBe(T0 + 3 * MIN);
    // Opening the panel the next day: still hidden, nothing rewritten.
    expect(settleOffer(expired.record, bf, T0 + DAY, null)).toMatchObject({ phase: { kind: "hidden" }, changed: false });
  });

  it("stays closed for seven days after a manual close, then returns with a fresh countdown and the copy reset", () => {
    const { record } = settleOffer(null, bf, T0, null);
    const closed = closeOffer({ ...record, copied: true }, T0 + MIN);
    expect(settleOffer(closed, bf, T0 + MIN + SNOOZE_MS - 1, null).phase.kind).toBe("hidden");
    const back = settleOffer(closed, bf, T0 + MIN + SNOOZE_MS, null);
    expect(back.phase).toEqual({ kind: "open", deadline: T0 + MIN + SNOOZE_MS + 3 * MIN });
    expect(back.record).toMatchObject({ copied: false, closedAt: null, hiddenUntil: null, startedAt: T0 + MIN + SNOOZE_MS });
    expect(back.changed).toBe(true);
  });

  it("returns at a trial end that comes before the seven days, and not for one after or already past", () => {
    const closed = closeOffer(settleOffer(null, bf, T0, null).record, T0);
    const trialEnd = T0 + 2 * DAY;
    expect(settleOffer(closed, bf, trialEnd - 1, trialEnd).phase).toEqual({ kind: "hidden", until: trialEnd });
    expect(settleOffer(closed, bf, trialEnd, trialEnd).phase.kind).toBe("open");
    // A trial ending after the seven days changes nothing.
    expect(settleOffer(closed, bf, T0 + 3 * DAY, T0 + 9 * DAY).phase).toEqual({ kind: "hidden", until: T0 + SNOOZE_MS });
    // A trial that had already ended when the card closed changes nothing.
    expect(settleOffer(closed, bf, T0 + 3 * DAY, T0 - DAY).phase).toEqual({ kind: "hidden", until: T0 + SNOOZE_MS });
  });

  it("returns at the trial end after the countdown ran out too", () => {
    const expired = settleOffer(settleOffer(null, bf, T0, null).record, bf, T0 + 3 * MIN, T0 + DAY);
    expect(expired.phase).toEqual({ kind: "hidden", until: T0 + DAY });
  });

  it("starts fresh when the countdown ran out more than seven days ago with the panel closed", () => {
    const { record } = settleOffer(null, bf, T0, null);
    const later = settleOffer(record, bf, T0 + 3 * MIN + SNOOZE_MS + 1, null);
    expect(later.phase).toEqual({ kind: "open", deadline: T0 + 3 * MIN + SNOOZE_MS + 1 + 3 * MIN });
  });

  it("without a countdown: no deadline, no expiry, closed by hand only", () => {
    const off = campaign({ countdown: { enabled: false } });
    const opened = settleOffer(null, off, T0, null);
    expect(opened.phase).toEqual({ kind: "open", deadline: null });
    expect(settleOffer(opened.record, off, T0 + 30 * DAY, null).phase).toEqual({ kind: "open", deadline: null });
    expect(settleOffer(closeOffer(opened.record, T0), off, T0 + DAY, null).phase.kind).toBe("hidden");
    // A countdown switched off mid window drops its deadline.
    const was = settleOffer(null, bf, T0, null).record;
    expect(settleOffer(was, off, T0 + 10 * MIN, null)).toMatchObject({ phase: { kind: "open", deadline: null }, changed: true });
  });

  it("starts the countdown when it is switched on later, and never runs longer than a shortened duration", () => {
    const off = campaign({ countdown: { enabled: false } });
    const record = settleOffer(null, off, T0, null).record;
    expect(settleOffer(record, bf, T0 + DAY, null).phase).toEqual({ kind: "open", deadline: T0 + DAY + 3 * MIN });
    const long = settleOffer(null, campaign({}, { durationMinutes: 60, visibleMinutes: 60 }), T0, null).record;
    expect(settleOffer(long, bf, T0 + MIN, null).phase).toEqual({ kind: "open", deadline: T0 + 3 * MIN });
  });

  it("starts over when the stored start is far in the future (the clock moved back)", () => {
    const record: OfferRecord = { v: 1, startedAt: T0 + DAY, deadline: T0 + DAY + 3 * MIN, copied: true, closedAt: null, hiddenUntil: null };
    expect(settleOffer(record, bf, T0, null).record).toMatchObject({ startedAt: T0, copied: false });
  });

  it("reads back only a well formed record", () => {
    const good: OfferRecord = { v: 1, startedAt: T0, deadline: null, copied: false, closedAt: null, hiddenUntil: null };
    expect(parseOfferRecord(JSON.stringify(good))).toEqual(good);
    for (const bad of [null, "", "{", "null", "[]", "42", JSON.stringify({ ...good, v: 2 }), JSON.stringify({ ...good, startedAt: "x" }), JSON.stringify({ ...good, copied: "yes" }), JSON.stringify({ ...good, deadline: "soon" }), JSON.stringify({ ...good, hiddenUntil: {} })]) {
      expect(parseOfferRecord(bad), String(bad)).toBeNull();
    }
  });
});

describe("the offer's storage, per account, Framer project, and campaign", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    resetOfferMemory();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const keyFor = async (account: string, project: string, campaignId = "bfcm26") =>
    offerStorageKey({ accountHash: (await scopeHash("account", account))!, projectHash: (await scopeHash("project", project))!, campaignId });

  it("keys hold no email or project id, and every part makes its own key", async () => {
    const a = await keyFor("owner@example.com", "projA");
    expect(a).not.toContain("owner");
    expect(a).not.toContain("projA");
    expect(a.startsWith("framefic:announcement:v1:memberframe:")).toBe(true);
    expect(new Set([a, await keyFor("owner@example.com", "projB"), await keyFor("other@example.com", "projA"), await keyFor("owner@example.com", "projA", "spring27")]).size).toBe(4);
    expect(await keyFor("owner@example.com", "projA")).toBe(a);
  });

  it("closing on site A leaves site B, another account, and another campaign untouched", async () => {
    const bf = campaign();
    const siteA = await keyFor("owner@example.com", "projA");
    const siteB = await keyFor("owner@example.com", "projB");
    const otherAccount = await keyFor("other@example.com", "projA");
    const nextCampaign = await keyFor("owner@example.com", "projA", "spring27");

    writeOffer(siteA, settleOffer(null, bf, T0, null).record);
    writeOffer(siteB, settleOffer(null, bf, T0 + MIN, null).record);
    writeOffer(siteA, closeOffer(readOffer(siteA)!, T0 + 2 * MIN));

    expect(settleOffer(readOffer(siteA), bf, T0 + 2 * MIN, null).phase.kind).toBe("hidden");
    expect(settleOffer(readOffer(siteB), bf, T0 + 2 * MIN, null).phase).toEqual({ kind: "open", deadline: T0 + MIN + 3 * MIN });
    expect(readOffer(otherAccount)).toBeNull();
    expect(settleOffer(readOffer(otherAccount), bf, T0 + 2 * MIN, null).phase.kind).toBe("open");
    // A new campaign id: a fresh offer on site A, though bfcm26 is closed there.
    expect(readOffer(nextCampaign)).toBeNull();
    expect(settleOffer(readOffer(nextCampaign), campaign({ id: "spring27" }), T0 + 2 * MIN, null).phase.kind).toBe("open");
  });

  it("keeps the copy state for the window, and stores no token or email", async () => {
    const key = await keyFor("owner@example.com", "projA");
    writeOffer(key, { ...settleOffer(null, campaign(), T0, null).record, copied: true });
    expect(readOffer(key)?.copied).toBe(true);
    expect(store.get(key)).not.toMatch(/@|token|Bearer/i);
  });

  it("treats a corrupt stored value as no window", async () => {
    const key = await keyFor("owner@example.com", "projA");
    store.set(key, "{not json");
    expect(readOffer(key)).toBeNull();
    expect(settleOffer(readOffer(key), campaign(), T0, null).phase.kind).toBe("open");
  });

  it("keeps working in memory when localStorage throws", async () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    const key = await keyFor("owner@example.com", "projA");
    expect(readOffer(key)).toBeNull();
    writeOffer(key, closeOffer(settleOffer(null, campaign(), T0, null).record, T0));
    expect(settleOffer(readOffer(key), campaign(), T0 + MIN, null).phase.kind).toBe("hidden");
  });

  it("keeps working in memory when a write is refused (quota)", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    const key = await keyFor("owner@example.com", "projA");
    writeOffer(key, { ...settleOffer(null, campaign(), T0, null).record, copied: true });
    expect(readOffer(key)?.copied).toBe(true);
  });
});

describe("the coupon button", () => {
  const handlers = () => ({ onCopied: vi.fn(), onOpenPricing: vi.fn() });

  it("first copies the exact code and does not navigate; the next press opens the plans", async () => {
    const copy = vi.fn(async () => true);
    const first = handlers();
    expect(await runOfferAction({ code: "50LTDBFCM26", copied: false, copy, ...first })).toBe("copied");
    expect(copy).toHaveBeenCalledWith("50LTDBFCM26");
    expect(first.onCopied).toHaveBeenCalledTimes(1);
    expect(first.onOpenPricing).not.toHaveBeenCalled();
    const second = handlers();
    expect(await runOfferAction({ code: "50LTDBFCM26", copied: true, copy, ...second })).toBe("opened");
    expect(second.onOpenPricing).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it("keeps the copy action when copying fails, without navigating or marking it copied", async () => {
    const failed = handlers();
    expect(await runOfferAction({ code: "50LTDBFCM26", copied: false, copy: async () => false, ...failed })).toBe("copy_failed");
    expect(failed.onCopied).not.toHaveBeenCalled();
    expect(failed.onOpenPricing).not.toHaveBeenCalled();
  });

  it("opens the plans at once without a coupon", async () => {
    const plain = handlers();
    const copy = vi.fn(async () => true);
    expect(await runOfferAction({ code: null, copied: false, copy, ...plain })).toBe("opened");
    expect(copy).not.toHaveBeenCalled();
    expect(plain.onOpenPricing).toHaveBeenCalledTimes(1);
  });
});

describe("the card's markup", () => {
  const render = async (props: Partial<import("../src/components/home/AnnouncementCard").AnnouncementCardProps> = {}) => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { AnnouncementCard, AnnouncementSkeleton } = await import("../src/components/home/AnnouncementCard");
    const noop = () => undefined;
    return {
      card: renderToStaticMarkup(React.createElement(AnnouncementCard, { campaign: campaign(), copied: false, remainingMs: 3 * MIN, onCopied: noop, onClose: noop, onOpenPricing: noop, ...props })),
      skeleton: renderToStaticMarkup(React.createElement(AnnouncementSkeleton)),
    };
  };

  it("shows the countdown above the title, the subtitle, the code with a copy icon, the gift, and a labelled close", async () => {
    const { card } = await render();
    expect(card).toContain("Offer closes in <span class=\"mf-offer-clock\">3:00</span>");
    expect(card.indexOf("Offer closes in")).toBeLessThan(card.indexOf("Black Friday Offer 2026"));
    expect(card).toContain("Get Flat 50% Off on Lifetime Plan.");
    expect(card).toContain('aria-label="Copy code 50LTDBFCM26"');
    expect(card).toContain("lucide-copy");
    expect(card).toContain('aria-label="Close offer"');
    expect(card).toContain("lucide-x");
    expect(card).toContain('src="/announcement-gift.webp"');
    expect(card).toContain('media="(prefers-reduced-motion: reduce)" srcSet="/announcement-gift-static.webp"');
    // The code appears once: in the button, nowhere near the gift.
    expect(card.split("50LTDBFCM26").length - 1).toBe(2); // the label and the visible code
    for (const absent of ["lucide-bell", "From MemberFrame", "Offer code", "lucide-arrow", "lucide-chevron"]) expect(card).not.toContain(absent);
  });

  it("after the copy, reads the button text; without a countdown, no timer", async () => {
    const { card } = await render({ copied: true, remainingMs: null });
    expect(card).toContain(">Grab the Deal Now<");
    expect(card).not.toContain("Copy code");
    expect(card).not.toContain("Offer closes in");
  });

  it("hides the timer outside the visible interval, and renders text as text", async () => {
    const late = campaign({ title: "<b>Deal</b>" }, { durationMinutes: 60, visibleMinutes: 5 });
    const { card } = await render({ campaign: late, remainingMs: 30 * MIN });
    expect(card).not.toContain("Offer closes in");
    expect(card).toContain("&lt;b&gt;Deal&lt;/b&gt;");
  });

  it("shows the button text at once without a coupon", async () => {
    const { card } = await render({ campaign: campaign({ couponCode: null }) });
    expect(card).toContain(">Grab the Deal Now<");
    expect(card).not.toContain("lucide-copy");
  });

  it("loads as a text free skeleton", async () => {
    const { skeleton } = await render();
    expect(skeleton).toBe('<div class="kit-skeleton mf-offer-skeleton" aria-hidden="true"></div>');
  });
});

describe("the gift animation files", () => {
  it("ships an animated WebP and a still one, small enough for the panel", async () => {
    const { readFileSync } = await import("node:fs");
    const animated = readFileSync("public/announcement-gift.webp");
    const still = readFileSync("public/announcement-gift-static.webp");
    for (const file of [animated, still]) {
      expect(file.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(file.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
    // VP8X with the animation flag; ANIM and ANMF chunks: really animated.
    expect(animated.includes(Buffer.from("ANIM"))).toBe(true);
    expect(animated.includes(Buffer.from("ANMF"))).toBe(true);
    expect(still.includes(Buffer.from("ANMF"))).toBe(false);
    expect(animated.length).toBeLessThan(800 * 1024);
  });
});
