/**
 * Gateway key detection, masking, and shape checks. PRD task 2.4, feature F03.
 *
 * ## This module guides, it does not validate
 *
 * F03 specifies prefix detection: `pk_live_` or `pk_test_` is Stripe,
 * `rzp_live_` or `rzp_test_` is Razorpay, a store ID plus an API key is Lemon
 * Squeezy. That is what this implements, and the purpose is to tell a creator
 * they have pasted a key into the wrong box, and to flag a test key.
 *
 * Whether a key actually works is decided by `POST /api/site/gateway/validate`,
 * which F03's own configuration flow step 3 names. The shape checks here are
 * deliberately loose: non-empty, no whitespace, a plausible length, and a
 * prefix that does not contradict the field. Anything stricter will eventually
 * reject a real key format and tell a creator their working key is invalid,
 * which is a worse failure than accepting a broken one, because the server
 * catches the second.
 *
 * ## Nothing here persists anything
 *
 * No `localStorage`, no `sessionStorage`, no plugin data, no module-level
 * variable holding a key. A secret lives in React state for as long as the
 * creator's unsaved edit lives and then it is gone. Reasoning in
 * `docs/development-docs/03-tri-gateway-payments.md` section 3.2, and a test
 * asserts the absence of every storage API in this subtree.
 */

import type { GatewayId, GatewayMode } from "../../types/site";

/** Which field of a gateway a key belongs in. */
export type KeyRole = "publishable" | "secret" | "identifier";

export interface KeyIdentity {
  gateway: GatewayId | null;
  role: KeyRole | null;
  mode: GatewayMode | null;
}

export const UNKNOWN_KEY: KeyIdentity = { gateway: null, role: null, mode: null };

/**
 * Shortest string worth sending to the server.
 *
 * Real keys from all three gateways are far longer. This only catches a stray
 * character or a half-finished paste.
 */
const MIN_KEY_LENGTH = 8;

/**
 * What gateway, which field, and live or test.
 *
 * CONFLICT C13: F03 lists `pk_live_` and `pk_test_` as the Stripe markers.
 * Those are Stripe **publishable** key prefixes, and the vault asks for a
 * publishable key and a secret key. Stripe's secret keys begin `sk_`, and its
 * restricted keys begin `rk_`. The PRD's list is treated as incomplete rather
 * than wrong, so all three are recognised and the `role` says which field the
 * key belongs in. Pasting a secret key into the publishable field is then
 * caught as a wrong field rather than passed to the server as valid.
 */
export function detectKey(raw: string): KeyIdentity {
  const key = raw.trim();
  if (key === "") return UNKNOWN_KEY;

  const mode: GatewayMode | null = key.includes("_live_")
    ? "live"
    : key.includes("_test_")
      ? "test"
      : null;

  if (key.startsWith("rzp_")) {
    // Razorpay key ids are rzp_live_ or rzp_test_. Its secret has no prefix at
    // all, which is why an unprefixed string cannot be attributed to a gateway.
    return { gateway: "razorpay", role: "identifier", mode };
  }

  if (key.startsWith("pk_")) return { gateway: "stripe", role: "publishable", mode };
  if (key.startsWith("sk_") || key.startsWith("rk_")) {
    return { gateway: "stripe", role: "secret", mode };
  }

  return UNKNOWN_KEY;
}

/** Is this a test key? Drives the "Test mode" badge. */
export function isTestKey(raw: string): boolean {
  return detectKey(raw).mode === "test";
}

/**
 * Last four characters, for showing a saved key.
 *
 * F03: secrets are "never returned to the client, only a masked suffix". This
 * is the only function in the repository that renders any part of a key, and it
 * is bounded: four characters, and fewer than four if the string is shorter,
 * rather than leaking a short key whole.
 */
export function maskKey(raw: string): string {
  const key = raw.trim();
  if (key === "") return "";
  if (key.length <= 4) return "*".repeat(key.length);

  return `${"*".repeat(4)}${key.slice(-4)}`;
}

export type KeyProblem =
  | "whitespace"
  | "too_short"
  | "wrong_gateway"
  | "wrong_role";

export interface KeyCheck {
  problem: KeyProblem | null;
  identity: KeyIdentity;
}

/**
 * Check a pasted key against the field it was pasted into.
 *
 * An empty value is not a problem: a creator leaving a gateway unconfigured, or
 * editing one key and not another, is the normal case. The save path strips
 * empty values rather than blanking stored keys.
 *
 * An unrecognised prefix is also not a problem. Lemon Squeezy's API key and
 * Razorpay's key secret carry no prefix at all, so "I do not recognise this"
 * cannot mean "this is wrong".
 */
export function checkKey(
  raw: string,
  expectedGateway: GatewayId,
  expectedRole: KeyRole
): KeyCheck {
  const key = raw.trim();
  const identity = detectKey(key);

  if (key === "") return { problem: null, identity };

  if (/\s/.test(key)) return { problem: "whitespace", identity };
  if (key.length < MIN_KEY_LENGTH) return { problem: "too_short", identity };

  if (identity.gateway !== null && identity.gateway !== expectedGateway) {
    return { problem: "wrong_gateway", identity };
  }

  if (
    identity.gateway === expectedGateway &&
    identity.role !== null &&
    identity.role !== expectedRole
  ) {
    return { problem: "wrong_role", identity };
  }

  return { problem: null, identity };
}

const GATEWAY_NAMES: Record<GatewayId, string> = {
  stripe: "Stripe",
  lemonsqueezy: "Lemon Squeezy",
  razorpay: "Razorpay",
};

const ROLE_NAMES: Record<KeyRole, string> = {
  publishable: "publishable key",
  secret: "secret key",
  identifier: "key ID",
};

/**
 * The inline message under the field.
 *
 * F03: "An invalid key shows an inline field error under the field, not a
 * banner." Returns null when there is nothing to say, so a caller can pass it
 * straight to `Field`'s `error` prop.
 *
 * PRD section 7.6 rule 4: no raw value reaches the creator. The gateway and the
 * role are named in words, never as `lemonsqueezy` or `publishable`.
 */
export function keyProblemMessage(check: KeyCheck): string | null {
  switch (check.problem) {
    case null:
      return null;
    case "whitespace":
      return "Remove the spaces from the key.";
    case "too_short":
      return "That looks too short to be a key.";
    case "wrong_gateway":
      return check.identity.gateway
        ? `That looks like a ${GATEWAY_NAMES[check.identity.gateway]} key.`
        : "That key does not belong in this field.";
    case "wrong_role":
      return check.identity.role
        ? `That looks like a ${ROLE_NAMES[check.identity.role]}.`
        : "That key does not belong in this field.";
  }
}

/** Every field in the vault, so the UI and the validator cannot disagree. */
export interface VaultFieldSpec {
  field:
    | "stripePublishableKey"
    | "stripeSecretKey"
    | "lemonSqueezyStoreId"
    | "lemonSqueezyApiKey"
    | "razorpayKeyId"
    | "razorpayKeySecret";
  gateway: GatewayId;
  role: KeyRole;
  label: string;
  /** Secret fields render masked and never appear in a readable input. */
  secret: boolean;
  placeholder: string;
}

export const VAULT_FIELDS: ReadonlyArray<VaultFieldSpec> = [
  {
    field: "stripePublishableKey",
    gateway: "stripe",
    role: "publishable",
    label: "Publishable key",
    secret: false,
    placeholder: "pk_live_...",
  },
  {
    field: "stripeSecretKey",
    gateway: "stripe",
    role: "secret",
    label: "Secret key",
    secret: true,
    placeholder: "Paste the secret key",
  },
  {
    field: "lemonSqueezyStoreId",
    gateway: "lemonsqueezy",
    role: "identifier",
    label: "Store ID",
    secret: false,
    placeholder: "12345",
  },
  {
    field: "lemonSqueezyApiKey",
    gateway: "lemonsqueezy",
    role: "secret",
    label: "API key",
    secret: true,
    placeholder: "Paste the API key.",
  },
  {
    field: "razorpayKeyId",
    gateway: "razorpay",
    role: "identifier",
    label: "Key ID",
    secret: false,
    placeholder: "rzp_live_...",
  },
  {
    field: "razorpayKeySecret",
    gateway: "razorpay",
    role: "secret",
    label: "Key secret",
    secret: true,
    placeholder: "Paste the key secret.",
  },
];

/**
 * Which gateways are available in which phase.
 *
 * F03: "Phase 1 (Stripe), Phase 2 (Lemon Squeezy, Razorpay)". The two later
 * gateways appear in the vault now, disabled, with the task that enables them
 * named. Hiding them would misrepresent the product as Stripe-only, which is
 * the exact competitor limitation F03 exists to beat.
 */
export const GATEWAY_AVAILABILITY: ReadonlyArray<{
  gateway: GatewayId;
  available: boolean;
  task: string;
}> = [
  { gateway: "stripe", available: true, task: "2.4" },
  { gateway: "lemonsqueezy", available: false, task: "3.1" },
  { gateway: "razorpay", available: false, task: "3.2" },
];
