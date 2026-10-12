/**
 * The simulated session fixtures, PRD task 1.2, feature F04.
 *
 * Layer 1 only: `buildSimulatedSession` is pure and the state list is data, so
 * both test cleanly in a node environment. `MemberSessionProvider` and
 * `useMemberSession` are NOT covered here, because rendering a provider needs a
 * DOM and `jsdom` is not installed. That is blocker B5.
 *
 * Nothing in this file imports the `framer` singleton. Per CLAUDE.md it posts
 * to a parent window that does not exist in a test, and this feature has no
 * reason to touch the SDK anyway.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIMULATED_STATE,
  SIMULATED_STATES,
  buildSimulatedSession,
  simulatedStateCaption,
  type SimulatedState,
} from "../src/hooks/useMemberSession";
import { DEFAULT_SITE_TIERS } from "../src/types/member";

const NOW = 1_760_000_000;
const DAY = 86_400;

const ALL_STATES: ReadonlyArray<SimulatedState> = ["guest", "free", "silver", "vip", "failed"];

describe("the state list", () => {
  it("offers exactly the five states PRD section 7.4 specifies", () => {
    expect(SIMULATED_STATES.map((state) => state.value)).toEqual(ALL_STATES);
  });

  it("opens on Guest, the state a creator never sees by accident", () => {
    expect(DEFAULT_SIMULATED_STATE).toBe("guest");
  });

  it("keeps every switcher label short enough for a fifth of the panel", () => {
    // Five segments share roughly 328px of content width, so about 65px each.
    // A label longer than this truncates or forces the track to overflow.
    for (const state of SIMULATED_STATES) {
      expect(state.label.length).toBeLessThanOrEqual(8);
    }
  });

  it("gives every state a caption, in prose rather than enum values", () => {
    // PRD section 7.6 rule 4, and rule 6: a sentence ends with a period.
    for (const state of SIMULATED_STATES) {
      expect(state.caption.length).toBeGreaterThan(0);
      expect(state.caption).toMatch(/\.$/);
      expect(state.caption).not.toMatch(/past_due|free_member|tier_1|tier_2/);
    }
  });

  it("resolves a caption for every state and never throws", () => {
    for (const state of ALL_STATES) {
      expect(simulatedStateCaption(state)).not.toBe("");
    }
  });
});

describe("buildSimulatedSession", () => {
  it("returns null for a guest, not an empty session object", () => {
    // A guest has no session. Returning a blank one would make `!session`
    // false inside the resolver and quietly open every signed_in gate.
    expect(buildSimulatedSession("guest", NOW)).toBeNull();
  });

  it("returns a session for each of the other four states", () => {
    for (const state of ["free", "silver", "vip", "failed"] as const) {
      expect(buildSimulatedSession(state, NOW)).not.toBeNull();
    }
  });

  it("assigns a tier key that exists in the site's tier table", () => {
    // Guards against PRD conflict B creeping back in. A fixture holding
    // `silver` instead of `tier_1` would fail every gate silently.
    const keys = DEFAULT_SITE_TIERS.map((tier) => tier.key);

    for (const state of ["free", "silver", "vip", "failed"] as const) {
      const session = buildSimulatedSession(state, NOW);
      expect(keys).toContain(session?.activeTier);
    }
  });

  it("gives every state a distinct member id, so they cannot be confused", () => {
    const ids = (["free", "silver", "vip", "failed"] as const).map(
      (state) => buildSimulatedSession(state, NOW)?.memberId
    );

    expect(new Set(ids).size).toBe(4);
  });

  it("derives every timestamp from the injected clock", () => {
    // The whole reason `nowSeconds` is a parameter. A hardcoded date would rot.
    const atEpoch = buildSimulatedSession("silver", 0);
    const atNow = buildSimulatedSession("silver", NOW);

    expect(atEpoch?.currentPeriodEnd).toBe(30 * DAY);
    expect(atNow?.currentPeriodEnd).toBe(NOW + 30 * DAY);
  });

  it("puts the three healthy states comfortably inside their period", () => {
    for (const state of ["free", "silver", "vip"] as const) {
      const session = buildSimulatedSession(state, NOW);
      expect(session?.status).toBe("active");
      expect(session?.currentPeriodEnd).toBeGreaterThan(NOW);
    }
  });

  it("puts the failed state's grace window in the past, on purpose", () => {
    // The one fixture value worth arguing about. With the window still open the
    // resolver would correctly return true and Failed would render identically
    // to Silver, leaving a five-label switcher with four distinct states.
    // Reasoning in 04-live-preview-studio.md section 5.2.
    const session = buildSimulatedSession("failed", NOW);

    expect(session?.status).toBe("past_due");
    expect(session?.gracePeriodEndsAt).toBeLessThan(NOW);
    expect(session?.currentPeriodEnd).toBeLessThan(NOW);
  });

  it("declares gracePeriodEndsAt on every session", () => {
    // PRD conflict A: section 11.3 reads this field, the F01 interface never
    // declares it. Resolved as the superset, so it must always be present or
    // the resolver's past_due branch compares against undefined.
    for (const state of ["free", "silver", "vip", "failed"] as const) {
      expect(typeof buildSimulatedSession(state, NOW)?.gracePeriodEndsAt).toBe("number");
    }
  });

  it("uses example.com addresses, so no fixture can reach a real inbox", () => {
    for (const state of ["free", "silver", "vip", "failed"] as const) {
      expect(buildSimulatedSession(state, NOW)?.email).toMatch(/@example\.com$/);
    }
  });

  it("defaults the clock to now when none is passed", () => {
    const before = Date.now() / 1000;
    const session = buildSimulatedSession("silver");

    expect(session?.currentPeriodEnd).toBeGreaterThanOrEqual(before + 30 * DAY - 5);
  });
});
