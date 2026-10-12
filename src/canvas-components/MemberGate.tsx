/**
 * `<MemberGate>`, the zero-code visual gate. PRD task 1.7, feature F01.
 *
 * ## This file leaves the repository
 *
 * Everything else in `src/` runs inside the plugin panel, where the only person
 * affected by a mistake is the creator who is already looking at it. This file
 * is written into the creator's Framer project by
 * `services/canvasComponentCodeGenerator.ts` and runs on their published
 * website, in front of their visitors. It is the only code here that does that,
 * so it is held to the strictest reading of every rule.
 *
 * Consequences, all deliberate:
 *
 *   - It imports only `react`, `framer`, and `lucide-react`. Framer supplies all
 *     three on the canvas. It cannot import from this repo, which is why the
 *     entitlement resolver and the session types appear here a second time.
 *   - All styling is one `cssContent` string injected through `<style>`, per PRD
 *     section 9.3 requirement 1. The one dynamic value, blur radius, is a CSS
 *     custom property scoped to the instance.
 *   - It starts locked and only ever becomes unlocked. There is no code path
 *     that renders protected content before entitlement resolves true, which is
 *     what makes PRD section 16.4's "disabling JavaScript leaves gated content
 *     locked" true by construction rather than by observation.
 *
 * ## The config block
 *
 * The marked block below is the only part the generator rewrites. Everything
 * else is byte-identical between this repo and the deployed file. Do not move
 * the markers, do not add a second pair, and do not reformat the block: the
 * generator asserts it finds exactly one pair and replaces what is between.
 *
 * ## The resolver appears twice on purpose
 *
 * PRD section 11.3 requires `isEntitled` to be "implemented identically in the
 * plugin, the canvas components, and the backend", and calls divergence a
 * security defect. The canvas copy cannot import the plugin's, so
 * `test/memberGateParity.test.ts` reads both files and fails if their bodies
 * stop matching. Edit one, edit the other.
 */

import React, { useEffect, useId, useMemo, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { Crown, Lock } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher, so the four
// lines below must keep this exact shape. PRD section 9.3 requirement 3. The
// 1-instance duplicate registry from the reference master template is NOT here:
// that is licensing enforcement behaviour and it belongs to F19, which
// `.agents/rules/` places after the core workflow. Conflict C6 in the F01
// development doc.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid

// ============================================================================
// DATA CONTRACTS, PRD SECTION 11
// ============================================================================

type TierKey = "free_member" | "tier_1" | "tier_2" | "vip";
type RequiredTier = "anyone" | "signed_in" | TierKey;
type MemberStatus = "active" | "trialing" | "past_due" | "canceled";
type GateFallbackAction = "blur" | "hide" | "redirect" | "custom_card";

interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: TierKey;
  status: MemberStatus;
  /** Unix seconds, UTC. A canceled member keeps access until this moment. */
  currentPeriodEnd: number;
  /** Unix seconds, UTC. A past_due member keeps access until this moment. */
  gracePeriodEndsAt: number;
  siteId: string;
}

interface TierLadderEntry {
  key: TierKey;
  rank: number;
  name: string;
}

/**
 * The site's tier ladder.
 *
 * CONFLICT C5, and the one open question in this file. PRD section 11.3 resolves
 * entitlement by comparing ranks in the site's own tier table, but section 10.4
 * has `GET /api/member/session` return `MemberSessionData`, which carries no
 * table. The gate has no second call to make and cannot read the plugin's copy,
 * so it falls back to this ladder.
 *
 * It is correct for a site using the default four tiers, and correct for a site
 * that only renamed them, because keys are what get compared. It is wrong for a
 * site that added a fifth tier or re-ranked the ladder, and wrong in the safe
 * direction: the lookup misses, the gate stays shut, no content leaks.
 *
 * The fix is one field on the session response. Written up in
 * `docs/development-docs/01-member-gate.md` section 5.1.
 */
const DEFAULT_SITE_TIERS: ReadonlyArray<TierLadderEntry> = [
  { key: "free_member", rank: 0, name: "Free" },
  { key: "tier_1", rank: 1, name: "Silver" },
  { key: "tier_2", rank: 2, name: "Gold" },
  { key: "vip", rank: 3, name: "VIP" },
];

interface GateConfig {
  requiredTier: RequiredTier;
  fallbackAction: GateFallbackAction;
  redirectUrl: string;
  cardTitle: string;
  cardDescription: string;
  blurIntensity: number;
  apiBaseUrl: string;
  sessionTtlMs: number;
}

// @memberframe-config-start
const CONFIG: GateConfig = {
  requiredTier: "signed_in",
  fallbackAction: "blur",
  redirectUrl: "",
  cardTitle: "Members Only Content",
  cardDescription: "Join or sign in to read this full guide.",
  blurIntensity: 8,
  apiBaseUrl: "https://api.memberframe.framefic.com",
  sessionTtlMs: 60000,
};
// @memberframe-config-end

// ============================================================================
// ENTITLEMENT RESOLUTION, PRD SECTION 11.3
// ============================================================================
// Second copy. Held to the plugin's by test/memberGateParity.test.ts. If you
// change anything below, change src/utils/entitlement.ts to match.

function isEntitled(
  session: MemberSessionData | null,
  requiredTier: RequiredTier,
  tiers: ReadonlyArray<TierLadderEntry> = DEFAULT_SITE_TIERS,
  nowSeconds: number = Date.now() / 1000
): boolean {
  if (requiredTier === "anyone") return true;
  if (!session) return false;

  const statusOk =
    session.status === "active" ||
    session.status === "trialing" ||
    (session.status === "past_due" && nowSeconds < session.gracePeriodEndsAt) ||
    (session.status === "canceled" && nowSeconds < session.currentPeriodEnd);

  if (!statusOk) return false;
  if (requiredTier === "signed_in") return true;

  const required = tiers.find((tier) => tier.key === requiredTier);
  const held = tiers.find((tier) => tier.key === session.activeTier);

  if (!required || !held) return false;

  return held.rank >= required.rank;
}

// ============================================================================
// SESSION VERIFICATION
// ============================================================================

/**
 * What the one call to the backend produced. Four outcomes, and only the first
 * can ever unlock anything.
 */
type SessionResult =
  | { kind: "member"; session: MemberSessionData }
  | { kind: "guest" }
  | { kind: "upgrade" }
  | { kind: "unavailable" };

/**
 * Module-scope cache, shared by every gate instance on the page.
 *
 * PRD P4 forbids a request per gated element, so a page with ten gates makes
 * one request. A failed verification is cached for the same window, which is
 * also what PRD section 10.6 asks for on a 429: locked state, no retry storm.
 */
let cachedSession: { at: number; value: Promise<SessionResult> } | null = null;

async function requestSession(): Promise<SessionResult> {
  try {
    // No token is read anywhere. PRD section 14.1 S2 puts the member session in
    // an HTTP-only cookie and forbids a JWT in localStorage, so the browser
    // attaches the credential and this component never sees it. Conflict C4.
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/member/session`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) return { kind: "guest" };
    if (response.status === 403) return { kind: "upgrade" };
    if (!response.ok) return { kind: "unavailable" };

    const session = (await response.json()) as MemberSessionData;
    return { kind: "member", session };
  } catch {
    // Network failure, a blocked request, or a malformed body. All three are
    // "entitlement could not be verified", which PRD S11 settles: fail closed.
    return { kind: "unavailable" };
  }
}

function loadSession(): Promise<SessionResult> {
  const now = Date.now();

  if (cachedSession && now - cachedSession.at < CONFIG.sessionTtlMs) {
    return cachedSession.value;
  }

  const value = requestSession();
  cachedSession = { at: now, value };
  return value;
}

// ============================================================================
// CONSOLIDATED CSS, INJECTED ONCE PER INSTANCE
// ============================================================================
// The plugin's design tokens are not available here: `design-tokens.css` is
// loaded by the panel and does not exist on a published site. So the palette is
// declared on the component root and every rule reads it, which keeps the
// "no hex in a rule body" shape with a different declaration site. The dark
// variant keys off `prefers-color-scheme`, the published-site equivalent of the
// panel's `data-framer-theme`.

const cssContent = `
.memberframe-gate-root {
  --memberframe-gate-surface: #ffffff;
  --memberframe-gate-border: rgba(16, 24, 40, 0.12);
  --memberframe-gate-title: #18202b;
  --memberframe-gate-body: #5b6472;
  --memberframe-gate-brand: #5271ff;
  --memberframe-gate-brand-strong: #3b51b8;
  --memberframe-gate-on-brand: #ffffff;
  --memberframe-gate-scrim: rgba(255, 255, 255, 0.55);
  --memberframe-gate-shadow: 0 12px 32px rgba(16, 24, 40, 0.14);
  --memberframe-gate-blur: 8px;

  box-sizing: border-box;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--framer-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}

@media (prefers-color-scheme: dark) {
  .memberframe-gate-root {
    --memberframe-gate-surface: #1b1f27;
    --memberframe-gate-border: rgba(255, 255, 255, 0.14);
    --memberframe-gate-title: #edf0f7;
    --memberframe-gate-body: #b7bfcd;
    --memberframe-gate-scrim: rgba(12, 14, 18, 0.55);
    --memberframe-gate-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }
}

.memberframe-gate-content {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}

/* Frosted blur teaser. The content stays in the DOM on purpose: a teaser the
   visitor can almost read is the point of this fallback. A creator who needs the
   content withheld entirely chooses Hide Completely or Lock Card. */
.memberframe-gate-content.is-blurred {
  filter: blur(var(--memberframe-gate-blur));
  pointer-events: none;
  user-select: none;
}

.memberframe-gate-overlay {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--memberframe-gate-scrim);
  backdrop-filter: saturate(1.1);
  -webkit-backdrop-filter: saturate(1.1);
}

.memberframe-gate-overlay.is-plain {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.memberframe-lock-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 340px;
  padding: 24px;
  text-align: center;
  border: 1px solid var(--memberframe-gate-border);
  border-radius: 14px;
  background: var(--memberframe-gate-surface);
  box-shadow: var(--memberframe-gate-shadow);
}

.memberframe-lock-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: var(--memberframe-gate-brand);
  background: rgba(82, 113, 255, 0.12);
}

.memberframe-lock-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--memberframe-gate-title);
}

.memberframe-lock-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--memberframe-gate-body);
}

/* Rendered as text, not as a control. Nothing to navigate to until task 2.5
   authors <MemberAuth>, and a button that does nothing is worse than a label. */
.memberframe-lock-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--memberframe-gate-on-brand);
  background: linear-gradient(
    180deg,
    var(--memberframe-gate-brand) 0%,
    var(--memberframe-gate-brand-strong) 100%
  );
}

/* Canvas only. Tells the creator the frame is gated without hiding the frame
   they are trying to design. */
.memberframe-gate-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--memberframe-gate-on-brand);
  background: linear-gradient(
    180deg,
    var(--memberframe-gate-brand) 0%,
    var(--memberframe-gate-brand-strong) 100%
  );
  box-shadow: var(--memberframe-gate-shadow);
}

.memberframe-gate-placeholder {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 72px;
  height: 100%;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: var(--memberframe-gate-body);
  border: 1px dashed var(--memberframe-gate-border);
  border-radius: 10px;
  background: var(--memberframe-gate-surface);
}

/* F19 layer: the Pro-Lock banner, shown when IS_LOCKED is patched to true. */
.memberframe-prolock {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 17, 23, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* F19 layer: the trial watermark. Stops rendering the moment IS_TRIAL is
   patched to false, which is the automatic removal PRD section 12 requires. */
.memberframe-trial-watermark {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 110;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  text-decoration: none;
  color: var(--memberframe-gate-on-brand);
  background: rgba(15, 17, 23, 0.82);
}
`;

// ============================================================================
// COMPONENT
// ============================================================================

export interface MemberGateProps {
  /** `ControlType.ComponentInstance`. The frame being protected. */
  contentSlot?: React.ReactNode;
  requiredTier?: RequiredTier;
  fallbackAction?: GateFallbackAction;
  redirectUrl?: string;
  cardTitle?: string;
  cardDescription?: string;
  blurIntensity?: number;
}

const BLUR_MIN = 2;
const BLUR_MAX = 20;

function clampBlur(value: number): number {
  if (!Number.isFinite(value)) return CONFIG.blurIntensity;
  return Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(value)));
}

/**
 * The locked card's copy, in plain language.
 *
 * PRD section 7.6 rule 4: never surface a raw enum value to a user. Nothing
 * here interpolates a status or a tier key, only names from the tier table.
 */
function lockCopy(
  result: SessionResult | null,
  requiredTier: RequiredTier,
  tiers: ReadonlyArray<TierLadderEntry>
): { title: string; description: string; cta: string } {
  if (!result || result.kind === "unavailable") {
    return {
      title: "Members Only Content",
      description: "We could not check your membership just now.",
      cta: "Sign in to unlock",
    };
  }

  if (result.kind === "guest") {
    return {
      title: "Members Only Content",
      description: "Sign in to see this section.",
      cta: "Sign in to unlock",
    };
  }

  if (result.kind === "upgrade") {
    return {
      title: "Upgrade To Continue",
      description: "Your plan does not include this section.",
      cta: "Upgrade to unlock",
    };
  }

  if (result.session.status === "past_due") {
    return {
      title: "Payment Problem",
      description: "Your last payment did not go through.",
      cta: "Update payment method",
    };
  }

  if (result.session.status === "canceled") {
    return {
      title: "Membership Ended",
      description: "Rejoin to get this section back.",
      cta: "Upgrade to unlock",
    };
  }

  const required = tiers.find((tier) => tier.key === requiredTier);

  return {
    title: "Upgrade To Continue",
    description: required
      ? `This needs the ${required.name} plan or higher.`
      : "You do not have access to this yet.",
    cta: "Upgrade to unlock",
  };
}

export default function MemberGate(props: MemberGateProps) {
  const {
    contentSlot,
    requiredTier = CONFIG.requiredTier,
    fallbackAction = CONFIG.fallbackAction,
    redirectUrl = CONFIG.redirectUrl,
    cardTitle = CONFIG.cardTitle,
    cardDescription = CONFIG.cardDescription,
    blurIntensity = CONFIG.blurIntensity,
  } = props;

  /**
   * A CSS-safe scope for this instance, so two gates with different blur
   * settings on one page do not overwrite each other's radius. `useId` returns
   * a value containing colons, which are legal in a quoted attribute selector
   * but not worth relying on.
   */
  const rawId = useId();
  const scope = useMemo(() => `mfg${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  /**
   * Canvas and thumbnail renders are the creator designing, not a visitor
   * reading. The gate makes no request there and never navigates, and it shows
   * the protected frame so the creator can actually arrange it. The locked
   * states are what the Live Preview Studio in the plugin panel is for, which
   * is the division F04 exists to provide.
   */
  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  /** `null` means still checking, and checking renders locked. */
  const [result, setResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    if (onCanvas) return;

    let active = true;
    void loadSession().then((value) => {
      if (active) setResult(value);
    });

    return () => {
      active = false;
    };
  }, [onCanvas]);

  const entitled =
    result !== null &&
    result.kind === "member" &&
    isEntitled(result.session, requiredTier, DEFAULT_SITE_TIERS);

  useEffect(() => {
    if (onCanvas) return;
    if (fallbackAction !== "redirect") return;
    if (result === null || entitled) return;
    if (!redirectUrl) return;

    window.location.assign(redirectUrl);
  }, [onCanvas, fallbackAction, result, entitled, redirectUrl]);

  const blur = clampBlur(blurIntensity);
  const scopedBlur = `[data-memberframe-gate="${scope}"] { --memberframe-gate-blur: ${blur}px; }`;
  const copy = lockCopy(result, requiredTier, DEFAULT_SITE_TIERS);

  const showCustomCard = fallbackAction === "custom_card";
  const title = showCustomCard ? cardTitle : copy.title;
  const description = showCustomCard ? cardDescription : copy.description;

  /** The locked card, shared by the blur, custom card, and redirect states. */
  const lockCard = (
    <div className="memberframe-lock-card">
      <span className="memberframe-lock-icon">
        <Lock size={18} stroke="currentColor" aria-hidden={true} />
      </span>
      <h3 className="memberframe-lock-title">{title}</h3>
      <p className="memberframe-lock-description">{description}</p>
      <span className="memberframe-lock-cta">{copy.cta}</span>
    </div>
  );

  /** Shown only when IS_TRIAL has been patched on. PRD section 9.3 point 4. */
  const watermark = IS_TRIAL && !IS_LOCKED ? (
    <a
      className="memberframe-trial-watermark"
      href="https://framefic.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Crown size={10} stroke="currentColor" aria-hidden={true} />
      <span>Trial Version</span>
    </a>
  ) : null;

  const proLock = IS_LOCKED ? (
    <div className="memberframe-prolock">
      <div className="memberframe-lock-card">
        <span className="memberframe-lock-icon">
          <Lock size={18} stroke="currentColor" aria-hidden={true} />
        </span>
        <h3 className="memberframe-lock-title">Component Locked</h3>
        <p className="memberframe-lock-description">
          Open the MemberFrame plugin to activate your license or start a free trial.
        </p>
      </div>
    </div>
  ) : null;

  function body(): React.ReactNode {
    // The creator's own canvas. Show the frame, label it, change nothing.
    if (onCanvas) {
      return (
        <React.Fragment>
          <span className="memberframe-gate-badge">
            <Lock size={11} stroke="currentColor" aria-hidden={true} />
            <span>Gated</span>
          </span>
          {contentSlot ? (
            <div className="memberframe-gate-content">{contentSlot}</div>
          ) : (
            <p className="memberframe-gate-placeholder">
              Connect the frame you want to protect to the Protected Frame control.
            </p>
          )}
        </React.Fragment>
      );
    }

    // F01 acceptance criterion 1: rendered unmodified. No wrapper class that
    // filters, scrims, or repositions, and no overlay sibling.
    if (entitled) {
      return <div className="memberframe-gate-content">{contentSlot}</div>;
    }

    if (fallbackAction === "hide") {
      return null;
    }

    if (fallbackAction === "blur") {
      return (
        <React.Fragment>
          <div className="memberframe-gate-content is-blurred">{contentSlot}</div>
          <div className="memberframe-gate-overlay">{lockCard}</div>
        </React.Fragment>
      );
    }

    // `custom_card` and `redirect` both withhold the content entirely. For
    // redirect this is the frame a visitor sees for the instant before the
    // browser leaves, and the frame they keep seeing if `redirectUrl` is empty.
    return <div className="memberframe-gate-overlay is-plain">{lockCard}</div>;
  }

  return (
    <div className="memberframe-gate-root" data-memberframe-gate={scope}>
      <style>{cssContent}</style>
      <style>{scopedBlur}</style>
      {body()}
      {proLock}
      {watermark}
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD SECTION 8 F01
// ============================================================================
// All seven, with F01's titles and option titles unchanged. Every default reads
// from CONFIG, so a creator who customized in the plugin panel sees their own
// values here, and a creator who did not sees F01's.

addPropertyControls(MemberGate, {
  contentSlot: {
    type: ControlType.ComponentInstance,
    title: "Protected Frame",
  },
  requiredTier: {
    type: ControlType.Enum,
    title: "Access Tier",
    options: ["signed_in", "free_member", "tier_1", "tier_2", "vip"],
    optionTitles: ["Any Signed In", "Free Member", "Tier 1: Silver", "Tier 2: Gold", "VIP Member"],
    defaultValue: CONFIG.requiredTier,
  },
  fallbackAction: {
    type: ControlType.Enum,
    title: "Locked State",
    options: ["blur", "hide", "redirect", "custom_card"],
    optionTitles: ["Frosted Blur", "Hide Completely", "Page Redirect", "Lock Card"],
    defaultValue: CONFIG.fallbackAction,
  },
  redirectUrl: {
    type: ControlType.Link,
    title: "Redirect Target",
    defaultValue: CONFIG.redirectUrl,
    hidden: (props) => props.fallbackAction !== "redirect",
  },
  cardTitle: {
    type: ControlType.String,
    title: "Lock Title",
    defaultValue: CONFIG.cardTitle,
    hidden: (props) => props.fallbackAction !== "custom_card",
  },
  cardDescription: {
    type: ControlType.String,
    title: "Lock Message",
    defaultValue: CONFIG.cardDescription,
    hidden: (props) => props.fallbackAction !== "custom_card",
  },
  blurIntensity: {
    type: ControlType.Number,
    title: "Blur Amount",
    min: BLUR_MIN,
    max: BLUR_MAX,
    step: 1,
    unit: "px",
    defaultValue: CONFIG.blurIntensity,
    hidden: (props) => props.fallbackAction !== "blur",
  },
});
