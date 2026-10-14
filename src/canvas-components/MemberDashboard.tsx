/**
 * `<MemberDashboard>`, the member's own account page. Feature plan FP-08,
 * PRD feature F06.
 *
 * ## This file leaves the repository
 *
 * Third component after `<MemberGate>` and `<MemberAuth>`, and everything in
 * their headers applies here. It is written into the creator's Framer project
 * and runs on their published site, so it may import only `react`, `framer`,
 * and `lucide-react`, all styling goes through one `cssContent` string, and the
 * marked config block is the only region the generator rewrites.
 *
 * ## What it is actually for
 *
 * Two jobs, and the second is the one that was missing from the product.
 *
 * **It is the page a member lands on.** `afterLoginPath` points here, so it is
 * the first thing a member sees after signing in, and it has to say something
 * true and useful rather than being a blank protected frame.
 *
 * **It makes session state legible.** Until now nothing on a creator's site
 * told a visitor whether they were signed in. `<MemberGate>` shows locked or
 * unlocked content, which says something about the content and nothing about
 * the person: a visitor seeing a locked panel cannot tell whether they are
 * signed out, signed in at the wrong tier, or looking at a broken page. This
 * component names the state in words, every time, in all five cases.
 *
 * ## What it deliberately does not do yet
 *
 * FP-08 specifies billing and invoice tabs. Both need the `subscriptions` and
 * `invoices` tables, which are backend PRD phase B3 and do not exist. So the
 * billing section renders an honest "not available yet" rather than an empty
 * table or, worse, plausible-looking zeroes. A member reading "$0.00 / Next
 * billing: never" would reasonably conclude their subscription had lapsed.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { LogOut, ShieldCheck, User } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher, so the four
// lines below must keep this exact shape. PRD section 9.3 requirement 3.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid

// ============================================================================
// CONTRACTS
// ============================================================================

type MemberStatus = "active" | "trialing" | "past_due" | "canceled";

interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: string;
  status: MemberStatus;
  currentPeriodEnd: number;
  gracePeriodEndsAt: number;
  siteId: string;
}

interface TierLadderEntry {
  key: string;
  rank: number;
  name: string;
}

interface DashboardConfig {
  headline: string;
  showTier: boolean;
  showBilling: boolean;
  showSignOut: boolean;
  signedOutMessage: string;
  accentColor: string;
  borderRadius: number;
  apiBaseUrl: string;
  /** Public. Identifies the tenant; `Origin` is what authorizes. */
  siteKey: string;
  /** Where "Sign in" sends a signed-out visitor. Site-relative. */
  loginPath: string;
  /** Where signing out lands. Site-relative. */
  afterLogoutPath: string;
}

// @memberframe-config-start
const CONFIG: DashboardConfig = {
  headline: "Your account",
  showTier: true,
  showBilling: true,
  showSignOut: true,
  signedOutMessage: "Sign in to see your account.",
  accentColor: "#5271ff",
  borderRadius: 12,
  apiBaseUrl: "https://api.memberframe.framefic.com",
  siteKey: "",
  loginPath: "/login",
  afterLogoutPath: "/",
};
// @memberframe-config-end

const SESSION_PATH = "/api/member/session";
const LOGOUT_PATH = "/api/member/logout";

// ============================================================================
// SHARED HELPERS, DUPLICATED FROM THE PLUGIN
// ============================================================================
// This file is compiled by Framer alone on a published site, so it cannot
// import from this repository. Each of these has a counterpart in `src/` and
// the counterpart is the original.

/**
 * Status in words a member can read.
 *
 * PRD section 7.6 rule 4 forbids surfacing a raw enum value to a user, and
 * `past_due` is the clearest example of why: it reads as jargon to a member and
 * as an accusation to one whose card simply expired.
 */
function statusLabel(status: MemberStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "In trial";
    case "past_due":
      return "Payment failed";
    case "canceled":
      return "Canceled";
    default:
      return "Unknown";
  }
}

/**
 * A tier's display name, from the ladder the server sent.
 *
 * Falls back to the key only when the ladder does not contain it, which means
 * the member holds a tier the site has deleted. Showing the raw key there is
 * the lesser evil: it is wrong-looking, which is correct, because the situation
 * is wrong and the creator needs to notice.
 */
function tierName(key: string, tiers: ReadonlyArray<TierLadderEntry>): string {
  const match = tiers.find((tier) => tier.key === key);
  return match ? match.name : key;
}

/**
 * Is this a path we are willing to send a visitor to?
 *
 * The same check `<MemberAuth>` carries, and the reason is the same: a value
 * that could be an absolute URL turns this component into an open redirect.
 * `//evil.com` begins with a slash and is not a path, because a browser reads
 * it as protocol-relative and leaves the site.
 */
function safePath(value: string): boolean {
  if (value === "" || !value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.indexOf("\\") !== -1) return false;
  return true;
}

function navigate(path: string): void {
  if (!safePath(path)) return;
  if (typeof window === "undefined") return;
  window.location.assign(path);
}

/**
 * Headers for every call.
 *
 * One place, so a route added later cannot forget the site key. The key is
 * omitted rather than sent blank when it is empty: the server tells "no key"
 * from "unknown key" and a blank one lands in the wrong branch.
 */
function apiHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (withBody) headers["Content-Type"] = "application/json";
  if (CONFIG.siteKey !== "") headers["X-MemberFrame-Site"] = CONFIG.siteKey;

  return headers;
}

/**
 * A CSS colour the creator picked, made safe to put in a style block.
 *
 * `ControlType.Color` hands back a string the creator controls, and it is
 * interpolated into a `<style>` element, which makes it an injection surface:
 * a value containing `}` could close the rule and open another. Only the forms
 * a colour picker actually produces are allowed through, and anything else
 * falls back to the brand colour.
 */
function safeColor(value: string, fallback: string): string {
  const trimmed = String(value ?? "").trim();

  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*[\d.\s,%/]+\)$/.test(trimmed)) return trimmed;
  if (/^hsla?\(\s*[\d.\s,%/degrad]+\)$/.test(trimmed)) return trimmed;

  return fallback;
}

// ============================================================================
// STATE
// ============================================================================

/**
 * Five states, one union, no booleans.
 *
 * The point of a union here is that "loading and also signed in" is not
 * representable, and that every branch has to be rendered for the component to
 * typecheck. A pair of booleans is how a component ends up showing a spinner
 * over a stale account.
 *
 * `unavailable` is separate from `signed_out` and that distinction is the whole
 * reason this component is worth having. A visitor who is signed out should be
 * asked to sign in; a visitor whose network failed should be told to try again.
 * Telling the first to try again, or the second to sign in, sends them down a
 * path that cannot work.
 */
type DashboardState =
  | { phase: "loading" }
  | { phase: "signed_out" }
  | { phase: "signed_in"; member: MemberSessionData; tiers: ReadonlyArray<TierLadderEntry> }
  | { phase: "unavailable" }
  | { phase: "misconfigured" };

// ============================================================================
// STYLES
// ============================================================================
// One string, injected once. PRD section 9.3 requirement 1: a canvas component
// consolidates its styling rather than using inline style objects, which the
// repository's `lint:css` gate forbids everywhere.

function cssContent(accent: string, radius: number): string {
  return `
.mf-dash {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #16181d;
  background: #ffffff;
  border: 1px solid rgba(22, 24, 29, 0.1);
  border-radius: ${radius}px;
  padding: 24px;
  max-width: 560px;
  width: 100%;
  box-sizing: border-box;
}
@media (prefers-color-scheme: dark) {
  .mf-dash {
    color: #f4f5f7;
    background: #16181d;
    border-color: rgba(244, 245, 247, 0.12);
  }
}
.mf-dash-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.mf-dash-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 999px;
  background: ${accent};
  color: #ffffff;
  font-weight: 600;
  font-size: 15px;
}
.mf-dash-avatar svg { width: 20px; height: 20px; stroke: currentColor; }
.mf-dash-title { margin: 0; font-size: 17px; font-weight: 600; }
.mf-dash-sub { margin: 2px 0 0; font-size: 13px; opacity: 0.7; word-break: break-all; }
.mf-dash-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  font-size: 14px;
}
.mf-dash-row-label { opacity: 0.7; }
.mf-dash-row-value { font-weight: 500; text-align: right; }
.mf-dash-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${accent};
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
}
.mf-dash-note {
  margin: 16px 0 0;
  padding: 12px;
  border-radius: ${Math.max(0, radius - 4)}px;
  background: rgba(128, 128, 128, 0.1);
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.85;
}
.mf-dash-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 20px;
  padding: 11px 16px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: ${Math.max(0, radius - 4)}px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.mf-dash-button:hover:not(:disabled) { background: rgba(128, 128, 128, 0.12); }
.mf-dash-button:disabled { opacity: 0.55; cursor: default; }
.mf-dash-button svg { width: 16px; height: 16px; stroke: currentColor; }
.mf-dash-button-primary {
  background: ${accent};
  border-color: ${accent};
  color: #ffffff;
}
.mf-dash-button-primary:hover:not(:disabled) { filter: brightness(1.07); }
.mf-dash-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 16px 0;
}
.mf-dash-state svg { width: 26px; height: 26px; stroke: currentColor; opacity: 0.6; }
.mf-dash-state p { margin: 0; font-size: 14px; line-height: 1.5; opacity: 0.8; }
`.trim();
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 360
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function MemberDashboard(props: Partial<DashboardConfig>): React.ReactElement {
  const config: DashboardConfig = { ...CONFIG, ...props };

  const [state, setState] = useState<DashboardState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);

  const accent = useMemo(() => safeColor(config.accentColor, "#5271ff"), [config.accentColor]);
  const radius = useMemo(
    () => Math.max(0, Math.min(32, Number(config.borderRadius) || 0)),
    [config.borderRadius]
  );

  const onCanvas = RenderTarget.current() === RenderTarget.canvas;

  // ------------------------------------------------------------------------
  // Load the session
  // ------------------------------------------------------------------------

  useEffect(() => {
    // On the Framer canvas there is no visitor and no cookie, so a real request
    // would always resolve signed out and a creator would be designing against
    // an empty state they can never leave. A representative signed-in preview
    // is what they need to lay the component out.
    if (onCanvas) {
      setState({
        phase: "signed_in",
        member: {
          memberId: "preview",
          email: "member@example.com",
          name: "Jordan Okafor",
          activeTier: "tier_1",
          status: "active",
          currentPeriodEnd: 0,
          gracePeriodEndsAt: 0,
          siteId: "preview",
        },
        tiers: [
          { key: "free_member", rank: 0, name: "Free" },
          { key: "tier_1", rank: 1, name: "Silver" },
          { key: "tier_2", rank: 2, name: "Gold" },
          { key: "vip", rank: 3, name: "VIP" },
        ],
      });
      return;
    }

    // Deployed before the project was connected. Every request would fail with
    // `missing_site_key`, which would render as `unavailable` and send the
    // creator hunting for a network problem. Naming it is worth the branch.
    if (config.siteKey === "") {
      setState({ phase: "misconfigured" });
      return;
    }

    let active = true;

    void (async () => {
      try {
        const response = await fetch(`${config.apiBaseUrl}${SESSION_PATH}`, {
          // The session is an HTTP-only cookie, per PRD section 14.1 S2. This
          // component never sees it, which is the point.
          credentials: "include",
          headers: apiHeaders(false),
        });

        if (!active) return;

        // A 401 is the ordinary answer for a visitor who is not signed in, not
        // an error. Treating it as one is how a signed-out member is shown
        // "something went wrong" on a page that is working perfectly.
        if (response.status === 401) {
          setState({ phase: "signed_out" });
          return;
        }

        if (!response.ok) {
          setState({ phase: "unavailable" });
          return;
        }

        const body = (await response.json()) as {
          member?: MemberSessionData;
          tiers?: ReadonlyArray<TierLadderEntry>;
        };

        if (!active) return;

        if (!body.member) {
          setState({ phase: "signed_out" });
          return;
        }

        setState({ phase: "signed_in", member: body.member, tiers: body.tiers ?? [] });
      } catch {
        if (active) setState({ phase: "unavailable" });
      }
    })();

    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, config.siteKey, onCanvas]);

  // ------------------------------------------------------------------------
  // Sign out
  // ------------------------------------------------------------------------

  const handleSignOut = useCallback(async () => {
    if (onCanvas) return;

    setBusy(true);

    try {
      await fetch(`${config.apiBaseUrl}${LOGOUT_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(false),
      });
    } catch {
      // The cookie may already be gone, the network may have dropped. Either
      // way the member asked to be signed out, and leaving them on an account
      // page that still shows their email would be the wrong answer to a
      // failure. The local state changes regardless.
    }

    setBusy(false);
    setState({ phase: "signed_out" });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("memberframe:session-updated", { detail: { signedIn: false } })
      );
    }

    if (safePath(config.afterLogoutPath)) navigate(config.afterLogoutPath);
  }, [config.afterLogoutPath, config.apiBaseUrl, onCanvas]);

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  const style = <style>{cssContent(accent, radius)}</style>;

  if (IS_LOCKED) {
    return (
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <ShieldCheck aria-hidden={true} />
          <p>This component needs a MemberFrame license.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <p>Checking your account.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "misconfigured") {
    // Addressed to the creator, not the visitor, because only a creator can
    // fix it and only a creator sees it before the site is published.
    return (
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <ShieldCheck aria-hidden={true} />
          <p>Connect this project in the MemberFrame plugin, then add this component again.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "unavailable") {
    return (
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <p>Your account could not be loaded. Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "signed_out") {
    return (
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <User aria-hidden={true} />
          <p>{config.signedOutMessage}</p>
        </div>
        {safePath(config.loginPath) ? (
          <button
            type="button"
            className="mf-dash-button mf-dash-button-primary"
            onClick={() => navigate(config.loginPath)}
          >
            Sign in
          </button>
        ) : null}
      </div>
    );
  }

  const { member, tiers } = state;
  const displayName = member.name && member.name.trim() !== "" ? member.name : member.email;
  const initial = displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="mf-dash">
      {style}

      <div className="mf-dash-head">
        <span className="mf-dash-avatar">{initial}</span>
        <div>
          <p className="mf-dash-title">{config.headline}</p>
          <p className="mf-dash-sub">{displayName}</p>
        </div>
      </div>

      <div className="mf-dash-row">
        <span className="mf-dash-row-label">Email</span>
        <span className="mf-dash-row-value">{member.email}</span>
      </div>

      {config.showTier ? (
        <div className="mf-dash-row">
          <span className="mf-dash-row-label">Membership</span>
          <span className="mf-dash-row-value">
            <span className="mf-dash-badge">{tierName(member.activeTier, tiers)}</span>
          </span>
        </div>
      ) : null}

      <div className="mf-dash-row">
        <span className="mf-dash-row-label">Status</span>
        <span className="mf-dash-row-value">{statusLabel(member.status)}</span>
      </div>

      {config.showBilling ? (
        /*
         * Honest rather than empty. FP-08 specifies plan, renewal date, payment
         * method, and invoices, and every one of those needs the subscriptions
         * and invoices tables, which are backend PRD phase B3 and do not exist.
         * Rendering zeroes would tell a paying member their subscription had
         * lapsed.
         */
        <p className="mf-dash-note">
          Billing details and invoices arrive with payments. Your membership and access are
          shown above and are up to date.
        </p>
      ) : null}

      {config.showSignOut ? (
        <button
          type="button"
          className="mf-dash-button"
          disabled={busy}
          onClick={() => void handleSignOut()}
        >
          <LogOut aria-hidden={true} />
          {busy ? "Signing out" : "Sign out"}
        </button>
      ) : null}
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS
// ============================================================================
// Every field a creator should reach from the Framer sidebar. `apiBaseUrl` and
// `siteKey` are deliberately absent: both are properties of the connection
// rather than of the component, the generator bakes them in at deploy time, and
// a creator editing either by hand would break the component with no way to
// know why.

addPropertyControls(MemberDashboard, {
  headline: {
    type: ControlType.String,
    title: "Headline",
    defaultValue: "Your account",
  },
  showTier: {
    type: ControlType.Boolean,
    title: "Show tier",
    defaultValue: true,
  },
  showBilling: {
    type: ControlType.Boolean,
    title: "Billing note",
    defaultValue: true,
  },
  showSignOut: {
    type: ControlType.Boolean,
    title: "Sign out",
    defaultValue: true,
  },
  signedOutMessage: {
    type: ControlType.String,
    title: "Signed out",
    defaultValue: "Sign in to see your account.",
  },
  loginPath: {
    type: ControlType.String,
    title: "Login path",
    defaultValue: "/login",
  },
  afterLogoutPath: {
    type: ControlType.String,
    title: "After sign out",
    defaultValue: "/",
  },
  accentColor: {
    type: ControlType.Color,
    title: "Accent",
    defaultValue: "#5271ff",
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Corner radius",
    defaultValue: 12,
    min: 0,
    max: 32,
    unit: "px",
  },
});

void IS_TRIAL;
