/**
 * The member session, in simulation mode. PRD task 1.2, feature F04.
 *
 * F04 is specified as "entirely client side. No backend calls, so it works
 * offline and during trial." There is deliberately no fetch path in this file.
 * That is what makes F04's fourth acceptance criterion, "Preview never issues a
 * network request", structurally true instead of merely observed.
 *
 * The same context serves the real session later. `source` already distinguishes
 * the two, so the canvas-side runtime hook can populate it from a JWT without
 * the consumers changing. Until then `source` is always "simulation".
 */

import React, { createContext, useContext, useMemo, useState } from "react";
import {
  DEFAULT_SITE_TIERS,
  type MemberSessionData,
  type TierLadderEntry,
} from "../types/member";

/** The five previewable states, PRD section 7.4. Local only, never persisted. */
export type SimulatedState = "guest" | "free" | "silver" | "vip" | "failed";

export const DEFAULT_SIMULATED_STATE: SimulatedState = "guest";

const DAY_SECONDS = 86_400;

/**
 * Build the fixture for one simulated state.
 *
 * Pure, and the clock is an argument so the tests can pin a moment. Every
 * timestamp is relative to `nowSeconds`, so a fixture is never stale.
 *
 * Each state exercises a different branch of `isEntitled`, which is the point:
 * a switcher whose states resolve identically is decorative. The table is in
 * `docs/development-docs/04-live-preview-studio.md` section 5.2.
 */
export function buildSimulatedSession(
  state: SimulatedState,
  nowSeconds: number = Date.now() / 1000
): MemberSessionData | null {
  if (state === "guest") return null;

  const base = {
    siteId: "site_preview",
    currentPeriodEnd: nowSeconds + 30 * DAY_SECONDS,
    gracePeriodEndsAt: nowSeconds + 7 * DAY_SECONDS,
  };

  switch (state) {
    case "free":
      return {
        ...base,
        memberId: "mem_preview_free",
        email: "free.member@example.com",
        name: "Alex Rivera",
        activeTier: "free_member",
        status: "active",
      };

    case "silver":
      return {
        ...base,
        memberId: "mem_preview_silver",
        email: "silver.member@example.com",
        name: "Jordan Okafor",
        activeTier: "tier_1",
        status: "active",
      };

    case "vip":
      return {
        ...base,
        memberId: "mem_preview_vip",
        email: "vip.member@example.com",
        name: "Priya Nair",
        activeTier: "vip",
        status: "active",
      };

    case "failed":
      return {
        ...base,
        memberId: "mem_preview_failed",
        email: "lapsed.member@example.com",
        name: "Sam Whitfield",
        activeTier: "tier_1",
        status: "past_due",
        // Deliberately in the past, and the one fixture value worth arguing
        // about. With the grace window still open the resolver would correctly
        // return true and this state would render identically to Silver, so the
        // five-state switcher would be a four-state control wearing five
        // labels. PRD section 7.4 calls the state "Expired / Payment Failed",
        // and expired is the half a creator needs to look at.
        gracePeriodEndsAt: nowSeconds - 3 * DAY_SECONDS,
        currentPeriodEnd: nowSeconds - 10 * DAY_SECONDS,
      };
  }
}

export interface MemberSessionValue {
  /** Null means signed out. Not "loading": this context never loads. */
  session: MemberSessionData | null;
  tiers: ReadonlyArray<TierLadderEntry>;
  /** Which state is being previewed. Null once a real session arrives. */
  simulatedState: SimulatedState | null;
  setSimulatedState: (state: SimulatedState) => void;
  /** Lets a consumer refuse to act on a fake session. */
  source: "simulation" | "live";
}

/**
 * No default value, so `useMemberSession` can tell "outside a provider" from
 * "inside a provider, signed out". Both would otherwise look like null and the
 * second is a legitimate state.
 */
const MemberSessionContext = createContext<MemberSessionValue | null>(null);

export interface MemberSessionProviderProps {
  initialState?: SimulatedState;
  tiers?: ReadonlyArray<TierLadderEntry>;
  children: React.ReactNode;
}

export const MemberSessionProvider: React.FC<MemberSessionProviderProps> = ({
  initialState = DEFAULT_SIMULATED_STATE,
  tiers = DEFAULT_SITE_TIERS,
  children,
}) => {
  const [simulatedState, setSimulatedState] = useState<SimulatedState>(initialState);

  // Rebuilt when the state changes, which also re-reads the clock. A panel left
  // open past a fixture boundary should not keep showing a stale window.
  const value = useMemo<MemberSessionValue>(
    () => ({
      session: buildSimulatedSession(simulatedState),
      tiers,
      simulatedState,
      setSimulatedState,
      source: "simulation",
    }),
    [simulatedState, tiers]
  );

  return React.createElement(MemberSessionContext.Provider, { value }, children);
};

export function useMemberSession(): MemberSessionValue {
  const value = useContext(MemberSessionContext);

  if (!value) {
    throw new Error(
      "useMemberSession must be used inside a MemberSessionProvider. The Builder tab mounts one around the Live Preview Studio."
    );
  }

  return value;
}

